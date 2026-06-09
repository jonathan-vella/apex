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

## Schema Drift in Pinned AVM Versions (mandatory pre-author check)

The single biggest cause of repeated `bicep build` failures in Step 5 is
**param-shape drift between AVM minor versions**. Param names you "know" from
documentation, prior projects, or training data are frequently wrong for the
exact pinned version. The plan's `04-iac-contract.json` pins the version; the
schema inside the cached MCR tarball is the only source of truth.

### Mandatory pre-author rule

For every AVM module pinned in `04-iac-contract.json`, before writing the
module call, **inspect the compiled JSON schema** in the local MCR cache:

```bash
# Cache path follows: ~/.bicep/br/mcr.microsoft.com/bicep$<module-path-$-encoded>/<version>$/main.json
python3 - <<'EOF'
import json, sys
target = '/home/vscode/.bicep/br/mcr.microsoft.com/bicep$avm$res$<module>/$<version>$/main.json'
d = json.load(open(target))
# Top-level params:
for k, v in d['parameters'].items():
    print(f"  {k}: type={v.get('type')} nullable={v.get('nullable', False)}")
# Nested object types:
for tn, td in d.get('definitions', {}).items():
    print(f"\n=== {tn} ===")
    for k, v in td.get('properties', {}).items():
        print(f"  {k}: {json.dumps(v)[:120]}")
EOF
```

If the cache file does not exist, run a throwaway `bicep build` of a one-line
module call to force MCR to populate it, then re-inspect.

### Catalogue of drift we have hit (extend on every new occurrence)

| Module | Pinned version | Wrong (from docs/older versions) | Correct |
|---|---|---|---|
| `avm/res/key-vault/vault` | `0.13.3` | `enabledForDeployment` / `enabledForTemplateDeployment` / `enabledForDiskEncryption` | `enableVaultForDeployment` / `enableVaultForTemplateDeployment` / `enableVaultForDiskEncryption` |
| `avm/res/web/site` | `0.23.0` | `virtualNetworkSubnetId` | `virtualNetworkSubnetResourceId` |
| `avm/res/web/site` | `0.23.0` | `appSettingsKeyValuePairs: { ... }` | `configs: [{ name: 'appsettings', properties: { ... } }]` |
| `avm/res/web/site` | `0.23.0` | `authSettingV2Configuration: { ... }` on the module | Module has no auth-v2 param — author raw `Microsoft.Web/sites/config@authsettingsV2` child resource (see [Bicep `parent:` BCP120](#bicep-parent-bcp120-static-name-required-on-child-resources) below) |
| `avm/res/sql/server` | `0.21.2` | `administrators: { ..., azureAdOnlyAuthentication: true }` (missing `principalType`) | Add `principalType: 'User'` (required by AVM schema) |
| `avm/res/sql/server` | `0.21.2` | `databaseType: { ..., transparentDataEncryption: { state: 'Enabled' } }` | Remove — TDE is enabled by default; not in the AVM `databaseType` schema |
| `avm/res/sql/server` | `0.21.2` | `databaseType: { ... }` without `availabilityZone` | `availabilityZone` is **required** (allowed values `-1`/`1`/`2`/`3`; use `-1` when zone-redundancy is not needed) |
| `avm/res/sql/server` | `0.21.2` | Server-level `diagnosticSettings: [ ... ]` on the module | Not a server-level param — wire diagnostics on the database via `databaseType.diagnosticSettings` |
| `avm/res/operational-insights/workspace` | `0.15.1` | `dailyQuotaGb: 1` (int) | `dailyQuotaGb: '1'` (string; default `'-1'`) |
| `avm/res/insights/scheduled-query-rule` | `0.6.0` | `criteria: { allOf: [...] }` | `criterias: { allOf: [...] }` (pluralised) |
| `avm/res/consumption/budget` | `0.3.8` | Nested `notifications`, `budgetCategory`, `timeGrain`, `filters` | Flat structure: `category`, `resetPeriod`, `thresholds: [int, int]`, `thresholdType: 'Actual' \| 'Forecasted'` (one per module instance), `actionGroups`, `contactEmails`, `contactRoles`, `operator`. To cover Actual + Forecasted, deploy **two budget module instances**. `startDate` has a built-in `utcNow()` default — do not pass it. |
| `avm/res/consumption/budget` | `0.3.8` | Called from an RG-scoped module without `scope:` | Requires `scope: subscription()` on the module call |
| `avm/res/db-for-my-sql/flexible-server` | `0.10.3` | `delegatedSubnetResourceId` into a shared PE subnet; `aad_auth_only` via `configurations[]` | Use `privateEndpoints[]` (`service: 'mysqlServer'`) — mutually exclusive with delegated subnet; `aad_auth_only` is read-only (enforce post-deploy). See [MySQL section](#mysql-flexible-server-apply-time-gotchas) |
| `avm/res/automation/automation-account` | `0.19.1` | runbook `runbookType` + inline `content`/`publishContentLink`; `jobSchedules` to a draft runbook | runbook `type` (no inline content; `uri` only); create `jobSchedules` post-deploy after publishing. See [Automation section](#automation-account-runbook-and-jobschedule) |

### Why what-if and lint don't catch this

`bicep build` catches roughly half of these (missing required props,
wrong types). The rest only fail during actual deploy or `what-if`. The
**only deterministic guard** is the pre-author schema inspection above.

### How to avoid in the future

1. **Add a Phase 1 step** to the agent: for each AVM module in the contract,
   inspect the cached `main.json` and emit a one-line param-shape summary
   into `04-preflight-check.md`. Authors copy from that summary, not from docs.
2. **Never copy param names** from older project codebases, training-data
   defaults, or AVM README files written for a different minor version.
3. **When a build error fires**, add a new row to the table above before
   moving on — the next project will hit the same wall.

---

## Bicep Language Constraints (compiler-level, not AVM)

These trip every project the first time. None are AVM-specific.

### `utcNow()` is only valid as a parameter default

```bicep
// ❌ FAILS — BCP065: utcNow can only be used in parameter default values
var now = utcNow('yyyy-MM-dd')

// ✅ OK — parameter default
param scheduleStartDate string = utcNow('yyyy-MM-dd')
```

Use this when emitting `Microsoft.CostManagement/scheduledActions` or any
resource that needs a "today" date stamp. For an end-date that does not
need to be dynamic, hard-code the literal (e.g. `'2027-01-01'`) rather
than compute it.

### Bicep `parent:` (BCP120) — static name required on child resources

```bicep
// ❌ FAILS — BCP120: parent property must be calculable at deployment start
resource existingWebApp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: webApp.outputs.name   // module output ≠ static
}
resource authSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: existingWebApp
  name: 'authsettingsV2'
  properties: { ... }
}

// ✅ OK — static name, explicit dependsOn for ordering
resource existingWebApp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: 'app-web-${projectName}-${env}'   // statically computable from params
}
resource authSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: existingWebApp
  name: 'authsettingsV2'
  properties: { ... }
  dependsOn: [ webAppModule ]   // make ordering explicit since the existing ref is decoupled
}
```

This pattern is needed whenever an AVM module does not expose a child-resource
param (e.g. `Microsoft.Web/sites/config@authsettingsV2` is not in `avm/res/web/site`).

### Subscription-scope sub-modules need `scope:` on the caller

Anomaly-detection alerts (`Microsoft.CostManagement/insights/...`), budgets,
policy assignments at subscription scope, and management-group resources
**must** be in modules with `targetScope = 'subscription'`. If called from an
RG-scoped parent, the parent must add `scope: subscription()`:

```bicep
module anomalyAlert 'modules/costmonitoring-anomaly.bicep' = {
  name: 'anomaly'
  scope: subscription()   // required — module declares targetScope = 'subscription'
  params: { ... }
}
```

This is also why we split `costmonitoring.bicep` (RG-scope: Action Group +
Budgets) from `costmonitoring-anomaly.bicep` (sub-scope: InsightAlert).

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

## Log Analytics Ingestion-Cap Alerts — KQL Column Safety

A common Phase 1 (Observability) anti-pattern: authoring an
ingestion-cap `Microsoft.Insights/scheduledQueryRules` whose KQL body
references columns from the **wrong** Log Analytics table. The
template builds, lints, and `what-if`-validates cleanly. Apply then
fails at the resource provider with:

```text
BadRequest: 'where' operator: Failed to resolve column or scalar
expression named 'OperationName'
```

(also seen for `Message`). The deployment is left in a partial state.

### Rule

For Log Analytics **ingestion / workspace meta** alerts (daily-cap
warnings at 70/90/100%), query the workspace's own meta-table
`_LogOperation` — never `AzureActivity`, `AzureDiagnostics`, or any
data-plane table that happens to expose `OperationName` or `Message`
for unrelated reasons.

### Correct shape

```bicep
module la 'br/public:avm/res/operational-insights/workspace:<latest>' = {
  // ...
}

// Each cap alert (70% / 90% / 100%) uses the same KQL skeleton
var workspaceResourceId = la.outputs.resourceId
var capQuery = '_LogOperation | where Category == "Ingestion" | where _ResourceId =~ "${workspaceResourceId}" | where TimeGenerated > ago(1d) | summarize Count = count()'

module capAlert70 'br/public:avm/res/insights/scheduled-query-rule:<latest>' = {
  params: {
    name: 'sqr-la-cap-70'
    criterias: {
      allOf: [
        {
          query: capQuery
          threshold: <70%-of-cap>
          operator: 'GreaterThan'
        }
      ]
    }
    scopes: [ workspaceResourceId ]
  }
}
```

### Why build + what-if don't catch it

- `bicep build` only validates the resource shape; the KQL body is an
  opaque string.
- `bicep lint` does not parse KQL.
- `az deployment ... what-if` evaluates ARM-level idempotency; the
  Log Analytics query parser only runs at create time.

### Deterministic guard

For every `Microsoft.Insights/scheduledQueryRules` resource in the
rendered template, the 06b validator + 07b deploy agent must grep the
KQL body for:

| Token           | Allowed table(s)                                            | Action if mismatched                       |
| --------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `OperationName` | `AzureActivity`, `AzureDiagnostics` (some resource types)   | Reject when KQL targets `_LogOperation`    |
| `Message`       | `AppTraces`, `AppExceptions`, `Syslog`, `Event`             | Reject when KQL targets `_LogOperation`    |
| `_LogOperation` | Workspace meta (`Operation`, `Category`, `Detail`)          | Allowed columns only — see Microsoft docs  |

The deploy-side preflight is captured in
[`deploy-validation-checklist.md` § KQL alert queries](../../iac-common/references/deploy-validation-checklist.md#kql-alert-queries-reference-valid-columns).

---

## SQL Entra Admin Object ID Resolution

A frequent Phase 3 (Data) deploy-time failure mode:
`Microsoft.Sql/servers.administrators.sid` is bound to a parameter
(`sqlEntraAdminObjectId`) that Step 5 CodeGen left as a placeholder
GUID, an empty string, or a stale ID copied from another project. The
deployment fails at the SQL nested deployment with:

```text
InvalidExternalAdministratorSid: The provided ID '<value>' is not a
valid Microsoft Entra ID.
```

### Rule

`sqlEntraAdminObjectId` (and any analogous `*EntraAdminObjectId` /
`*PrincipalId` param) MUST be resolved to a live Entra object ID at
deploy time — never at code-gen time. CodeGen declares it as a
required input in `04-environment-manifest.json` (shape:
`entra-object-id`); it must not be baked into the bicepparam file.

### Resolution recipes

```bash
# Deployer (works in dev and CI signed-in contexts)
az ad signed-in-user show --query id -o tsv

# Specific user by UPN
az ad user show --id alice@contoso.com --query id -o tsv

# Security group by display name
az ad group show --group "FreshConnect SQL Admins" --query id -o tsv

# Write back into the azd environment so subsequent deploys reuse it
azd env set SQL_ADMIN_OBJECT_ID <resolved-guid>
```

### Why this lives at deploy time, not code-gen time

- The signed-in deployer changes between developer machines and CI
  service principals; the right SID is environment-specific.
- Hard-coding a GUID in `04-environment-manifest.json` would tie the
  IaC tree to one operator and fail other deployers fast.
- Step 5 CodeGen has no Entra read permission by contract; only the
  deploy agent runs in the human's CLI context.

### Deterministic guard

The deploy preflight (07b Phase 1.5) MUST call `az ad ... show` for
every param flagged as `entra-object-id` in
`04-environment-manifest.json` and fail-closed on empty / non-GUID
responses. See
[`deploy-validation-checklist.md` § Entra principal object IDs](../../iac-common/references/deploy-validation-checklist.md#entra-principal-object-ids-are-real).

---

## AKS Managed Cluster apply-time gotchas

`bicep build`, `bicep lint`, and `what-if` all pass; the AKS resource provider rejects these
only at apply time. All three were hit on a single AKS platform deployment.

### Outbound type must match the egress topology

When a **NAT Gateway is attached to the AKS node subnet** (BYO-VNet), the cluster `outboundType`
MUST be `userAssignedNATGateway` — not `userDefinedRouting`. UDR requires a `0.0.0.0/0` route
table pointing at a firewall/NVA you manage; with no such route table and restricted public
network access (e.g. API Server VNet Integration), the RP fails:

```text
BadRequest: UserDefinedRouting is not supported when Cluster has public network access set to Disabled.
```

| Egress topology                              | Correct `outboundType`   |
| -------------------------------------------- | ------------------------ |
| NAT Gateway on the node subnet (BYO-VNet)    | `userAssignedNATGateway` |
| AKS-managed NAT Gateway                      | `managedNATGateway`      |
| 0.0.0.0/0 UDR to a firewall/NVA you operate  | `userDefinedRouting`     |
| Default public load balancer                 | `loadBalancer`           |

### BYO-VNet clusters need Network Contributor on the VNet

A user-assigned control-plane identity joining a **pre-existing** VNet must hold `Network
Contributor` on that VNet (or the node/API-server subnets) — otherwise node join and API Server
VNet Integration fail. Assign it via the AVM virtual-network module `roleAssignments`, scoped to
the VNet, using the control-plane identity `principalId`.

### Fixed-size node pools must not set minCount/maxCount

`minCount`/`maxCount` are valid only when `enableAutoScaling: true`. For a fixed-size pool, both
MUST be `null`, or the RP rejects the pool:

```text
InvalidParameter: AgentPool 'user' has 'agentPoolProfile.minCount' set which requires that
'agentPoolProfile.enableAutoscaling' is true and it is false
```

```bicep
var userPoolAutoscale = environmentName == 'prod' ? true : false
var userPoolMinCount  = userPoolAutoscale ? 1 : null   // null when autoscaling is off
var userPoolMaxCount  = userPoolAutoscale ? 5 : null
```

---

## Application Gateway backend pool (no loopback)

App Gateway rejects a loopback backend address at apply time:

```text
ApplicationGatewayBackendAddressLoopbackAddressIsInvalid: Backend Address 127.0.0.1 ... cannot be a loopback address.
```

When the real backend (e.g. an AKS internal load balancer) does not exist until after the cluster
is up, author an **empty** backend pool and let AGIC (or a post-deploy update) populate it. An
empty backend pool is valid; a placeholder `127.0.0.1` is not.

```bicep
param aksBackendFqdn string = ''   // empty at first deploy
var backendAddresses = empty(aksBackendFqdn) ? [] : [{ fqdn: aksBackendFqdn }]
```

---

## MySQL Flexible Server apply-time gotchas

A single MySQL Flexible Server deployment surfaced five distinct apply-time issues. AVM module:
`br/public:avm/res/db-for-my-sql/flexible-server:0.10.3`.

### Private endpoint vs delegated subnet are mutually exclusive

If the architecture uses the `privatelink.mysql.database.azure.com` DNS zone and a **shared**
private-endpoint subnet (alongside Key Vault / Storage / ACR), MySQL must use a **private
endpoint** — not `delegatedSubnetResourceId` (VNet injection). They are mutually exclusive, and a
shared PE subnet cannot also be delegated to `Microsoft.DBforMySQL/flexibleServers`:

```text
VnetSubnetMissingDelegation: The subnet name as 'snet-pe-dev' is missing required delegations
'Microsoft.DBforMySQL/flexibleServers'.
```

```bicep
// ❌ delegatedSubnetResourceId: peSubnetId   // VNet injection needs a DEDICATED /29 delegated subnet
// ✅ private endpoint into the shared snet-pe (consistent with KV/Storage/ACR)
privateEndpoints: [{
  name: 'pe-mysql-${env}'
  subnetResourceId: peSubnetId
  service: 'mysqlServer'
  privateDnsZoneGroup: { privateDnsZoneGroupConfigs: [{ privateDnsZoneResourceId: privateDnsZoneMysqlId }] }
}]
```

### `aad_auth_only` is read-only — enforce Entra-only post-deploy

Setting the `aad_auth_only` server parameter via the AVM `configurations[]` array fails:

```text
ConfigurationReadOnly: The configuration(s) 'aad_auth_only' is(are) read-only for ... version 8.4.7.
```

AVM 0.10.3 exposes no `authConfig` parameter. In Bicep set only the valid TLS parameter
(`require_secure_transport: ON`); enforce the Entra admin + AAD-only as a **post-deploy** step
(`az mysql flexible-server ad-admin create`, then set `aad_auth_only`). Record it in the
deployment summary post-deploy task list.

### storageAutoGrow must be Enabled when HA is ZoneRedundant

The AVM module requires `storageAutoGrow: 'Enabled'` whenever `highAvailability: 'ZoneRedundant'`.
Gate it on the same condition as HA:

```bicep
storageAutoGrow: environmentName == 'prod' ? 'Enabled' : 'Disabled'
```

### Engine version — pin the latest GA LTS, not 8.0

Per the [MySQL version support policy](https://learn.microsoft.com/azure/mysql/concepts-version-policy),
set `version: '8.4'` (latest GA LTS — Azure resolves it to the latest `8.4.x` patch, e.g. `8.4.7`
at time of writing). MySQL 8.0 standard support ends 2026-04-30; 9.x is an **innovation release**
(no HA, replicas, or automated backups, 30-day server lifecycle) and must not be used for durable
workloads. The AVM `version` param takes the `major.minor` string — do not pin a patch. This value
is **not** environment-specific: dev and prod both deploy the same `8.4.x` patch. The same "latest
GA, avoid innovation/preview" rule applies to any engine version field (PostgreSQL, Redis, AKS
Kubernetes version, etc.) — confirm against the service's version-support policy at plan time
rather than copying a literal from an older template.

### Major-version change must be the ONLY property changed

A major-version change on an **existing** server is an isolated operation. Re-sending the full
property bag (as AVM does on every deploy) collides:

```text
UpdateServerVersionTogetherWithOtherPropertiesNotAllowed: It's not allowed to update the other
properties while updating server version.
```

- **Non-prod**: delete + recreate at the new version (clean).
- **Prod**: run the in-place Major Version Upgrade (MVU) flow as a separate, version-only
  operation — do not change the version in the same redeploy that touches other properties.
- **Deleting a server orphans its private endpoint** (`Disconnected`). A redeploy then fails with
  `PrivateEndpointCannotBeUpdatedInDisconnectedState`; delete the orphaned PE so it recreates
  `Approved`.

---

## Cost Management InsightAlert viewId scope

A subscription-scoped `Microsoft.CostManagement/scheduledActions` (kind `InsightAlert`) needs a
`viewId` **scope-matched** to the action. A tenant-level `/providers/...` path is rejected:

```text
InvalidView: The specified view '/providers/Microsoft.CostManagement/views/ms:DailyAnomalyBySubscription'
is invalid. Please specify either a private view ID or a view ID with the same scope ...
```

```bicep
// ✅ subscription-scoped action → subscription-scoped view
viewId: '${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup'
```

`InsightAlert` is available only at subscription scope, daily frequency. Author the module with
`targetScope = 'subscription'` and call it with `scope: subscription()`.

---

## Automation Account runbook and jobSchedule

AVM `br/public:avm/res/automation/automation-account:0.19.1`:

- The runbook object uses `type` (e.g. `'PowerShell72'`), **not** `runbookType`, and accepts **no
  inline `content`/`publishContentLink`** — only an optional `uri`. An empty draft runbook is valid.
- A `jobSchedules` entry links a schedule to a runbook but **requires the runbook to have a
  published version**. An empty draft has none, so apply fails:

```text
BadRequest: The runbook does not have a published version.
```

Author the schedule, omit `jobSchedules` from Bicep, and create the schedule↔runbook link
**post-deploy** after publishing the runbook content (`az automation runbook replace-content`
then `az automation job-schedule create`). Record both as post-deploy tasks.

---

## Learn More

| Topic                | How to Find                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| AVM module catalog   | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "Azure Verified Modules registry Bicep"`    |
| Resource type schema | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "{resource-type} Bicep template reference"` |
| Networking patterns  | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "Azure hub-spoke network topology Bicep"`   |
| Security baseline    | `mcp_azure-mcp_documentation` — `command: "microsoft_docs_search"`, `query: "{service} security baseline"`              |
