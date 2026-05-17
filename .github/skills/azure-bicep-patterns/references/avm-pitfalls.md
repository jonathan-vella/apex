<!-- ref:avm-pitfalls-v1 -->

# AVM Pitfalls & What-If Interpretation

Known gotchas when using Azure Verified Modules and pre-deployment validation.

---

## What-If Interpretation

Before deploying, always run what-if to preview changes:

```bash
az deployment group what-if \
  --resource-group "$rgName" \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --no-pretty-print
```

### Result Interpretation

| Change Type | Icon   | Action Required                              |
| ----------- | ------ | -------------------------------------------- |
| Create      | green  | New resource — verify name and configuration |
| Modify      | yellow | Property change — check for breaking changes |
| Delete      | red    | Resource removal — confirm intentional       |
| NoChange    | grey   | Idempotent — no action needed                |
| Deploy      | blue   | Child resource deployment                    |
| Ignore      | grey   | Read-only property change — safe to ignore   |

Red flags to catch: unexpected deletes, SKU downgrades, public access changes,
authentication mode changes, or identity removal.

---

## AVM Known Gotchas

- **Version pinning**: Always pin AVM module versions (`br/public:avm/res/...:{version}`).
  Unpinned references may break on upstream updates.
- **Wrapper modules**: When AVM defaults conflict with project policy, wrap the AVM module
  in a thin project module that overrides defaults rather than forking.
- **Output shapes**: AVM outputs vary between modules — always check the module README for
  available outputs before referencing in parent templates.
- **Tag merging**: Some AVM modules merge tags internally. Pass your `tags` object and verify
  the deployed tags include all required policy tags.
- **Diagnostic settings**: Not all AVM modules wire diagnostics automatically. Always verify
  and add a `diagnosticSettings` resource if the module doesn't support the parameter.

---

## Identity ↔ RBAC Circular Dependency

A frequent Phase 2 (Security) anti-pattern: placing the role assignment **inside**
`identity.bicep` so the identity module needs the Key Vault / Storage / SQL resource
ID, while those resource modules need the managed identity `principalId`. The two
modules end up depending on each other's outputs and the Bicep compiler emits a
circular dependency error.

### Symptom

```text
Error BCP073: The output "keyVaultId" cannot be referenced because the module
"identity" depends on it (BCP176 cyclical dependency).
```

or (more subtly) `what-if` succeeds because the cycle is across module boundaries,
but `bicep build` fails at compile time.

### Rule

**RBAC role assignments live in the *target resource's* module**, never in
`identity.bicep`. The identity module's only job is to create the User Assigned
Managed Identity and surface its `id`, `principalId`, and `clientId` outputs.

### Correct shape

```bicep
// identity.bicep — creation-only, no role assignments
module mi 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  params: { name: name, location: location, tags: tags }
}
output managedIdentityPrincipalId string = mi.outputs.principalId
```

```bicep
// keyvault.bicep — RBAC scoped to THIS vault, after the vault exists
module kv 'br/public:avm/res/key-vault/vault:0.13.3' = { ... }

resource rbacMiKv 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv  // explicit; depends_on is implicit via scope
  name: guid(kv.id, managedIdentityPrincipalId, 'KeyVaultSecretsUser')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

Same rule applies to Storage Blob Data Contributor, SQL contained users, ACR pull,
and any other data-plane RBAC: assign it in the resource module after creation.

---

## Runtime Managed Identity ≠ Data-Plane Admin

A dangerous Phase 3 (Data) anti-pattern: using the application's shared User
Assigned Managed Identity as the **Azure SQL Entra admin** (or Cosmos
`Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments` admin, or any
other data-plane admin role). It passes what-if but grants the runtime
workload full DDL/DML, firewall, and admin-rotation rights over the data plane.

### Rule

- **Admin principal** = dedicated Entra security group or deployment principal
  (not the app MI), passed in as `sqlEntraAdminObjectId` + `sqlEntraAdminLogin`.
- **Runtime identity** = the app MI, added as a **contained database user** with
  least-privilege roles after the database exists.

### Correct shape (SQL)

```bicep
// database.bicep — dedicated admin, NOT the app MI
module sql 'br/public:avm/res/sql/server:0.21.2' = {
  params: {
    administrators: {
      administratorType: 'ActiveDirectory'
      login: sqlEntraAdminLogin         // param
      sid: sqlEntraAdminObjectId        // param
      tenantId: tenant().tenantId
      azureAdOnlyAuthentication: true
    }
  }
}
```

Then a **post-deploy** step (deployment script, az CLI, or pipeline task) runs
T-SQL against the database to grant the app MI least-privilege access:

```sql
CREATE USER [id-{project}-{env}] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [id-{project}-{env}];
ALTER ROLE db_datawriter ADD MEMBER [id-{project}-{env}];
GRANT EXECUTE ON SCHEMA::dbo TO [id-{project}-{env}];
```

This step cannot be expressed in Bicep before the DB exists — record it in the
`04-implementation-plan.md` post-deploy section and in the
`06-deployment-summary.md` operations list.

### Why this matters

If the runtime MI is Entra admin, a compromised app principal can drop tables,
rotate the SQL Entra admin, and (with `azureAdOnlyAuthentication: true`) lock
out human operators. Splitting admin from runtime preserves a clean break-glass
path via the dedicated admin group.

---

## SKU-Default Mismatch (Premium-Only Properties on Lower SKUs)

Many AVM modules ship with parameter defaults shaped for the **Premium** tier and
render those properties unconditionally. Source lint, `bicep build`, and even
`what-if` will pass; Azure ARM rejects the resource at **apply** time with
`Feature ... not supported for the SKU ...`. This is the most common cause of
“validation green, deployment red” loops on AVM-backed resources.

### Symptoms

- `bicep build` + `bicep lint` clean.
- `validate:iac-security-baseline` clean.
- `what-if` succeeds with non-zero changes.
- `az deployment ... create` fails on the resource with `NetworkRuleNotSupported`,
  `FeatureNotSupportedForTier`, `SkuDoesNotSupport...`, or similar.

### Mechanism

The AVM Bicep wrapper does not always guard SKU-sensitive properties with a SKU
conditional. Common pattern in the compiled ARM:

```json
"networkRuleSet": "[if(variables('shouldConfigureNetworkRuleSet'), createObject('defaultAction', parameters('networkRuleSetDefaultAction'), ...), null())]"
```

When the gating variable evaluates `true` for _any_ SKU (because both defaults
and caller input meet the condition), the property is emitted for **Basic**
resources that Azure does not accept.

### Canonical example: Container Registry Basic + AVM ≥ 0.12.x

`br/public:avm/res/container-registry/registry` defaults to
`networkRuleBypassOptions = 'AzureServices'` and `networkRuleSetDefaultAction =
'Deny'`. With `publicNetworkAccess: 'Enabled'`, the internal
`shouldConfigureNetworkRuleSet` evaluates `true`, so the compiled ARM contains
`networkRuleSet.defaultAction = 'Deny'` and `networkRuleBypassOptions = 'AzureServices'`.
ACR **Basic** does not support `networkRuleSet`, so apply fails even though
what-if and lint pass.

**Fix** (when keeping Basic):

```bicep
module registry 'br/public:avm/res/container-registry/registry:0.12.1' = {
  params: {
    name: name
    location: location
    tags: tags
    acrSku: 'Basic'
    acrAdminUserEnabled: false
    publicNetworkAccess: publicNetworkAccess
    // Force the gating variable to false so AVM does NOT emit networkRuleSet
    // for Basic SKU (Premium-only ARM feature).
    networkRuleSetDefaultAction: 'Allow'
  }
}
```

Alternate fixes: upgrade to **Premium**, or replace the AVM wrapper with a
minimal raw `Microsoft.ContainerRegistry/registries` resource (document the
AVM exception per [AGENTS.md](../../../../infra/bicep/AGENTS.md)).

### Generic detection rule

For every AVM module call with a non-default SKU/tier, do one of:

1. **Inspect the compiled ARM** (`bicep build` then grep) for properties whose
   AVM schema description says _“requires the 'sku' to be 'Premium'”_ (or
   similar) before running what-if. If any are present, treat the template as
   broken.
2. **Pass an explicit override** that forces the AVM gating variable to `false`
   (the ACR fix above is the pattern). Add a code comment naming the AVM
   default that triggered it.
3. **Use a thin raw wrapper** when (1) and (2) are not feasible, and document
   the AVM-exception in the module header.

### What-if escape hatch is not enough

`what-if` evaluates ARM templates against the cloud as it expects to be after
deployment; it does not run the SKU/feature compatibility check that the
resource provider runs at create time. Render-level inspection (#1 above) is
the only deterministic guard between `bicep build` and `az deployment create`.

### Mechanical check (lift this into bicep-validate-subagent)

For each AVM module call where the SKU is **not** Premium, fail validation if
the compiled ARM contains any of these Premium-only registry properties:

- `networkRuleSet`
- `networkRuleBypassOptions`
- `dataEndpointEnabled: true`
- `zoneRedundancy: 'Enabled'`
- `policies.quarantinePolicy.status: 'enabled'`
- `policies.trustPolicy.status: 'enabled'`

The same pattern applies to other AVM modules with SKU-gated properties — extend
the check per resource family as new cases are discovered.

---

## Learn More

| Topic                | How to Find                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| AVM module catalog   | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "Azure Verified Modules registry Bicep"`    |
| Resource type schema | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "{resource-type} Bicep template reference"` |
| Networking patterns  | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "Azure hub-spoke network topology Bicep"`   |
| Security baseline    | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "{service} security baseline"`              |
