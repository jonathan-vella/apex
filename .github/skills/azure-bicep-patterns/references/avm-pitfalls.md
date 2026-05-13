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

| Topic                | How to Find                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| AVM module catalog   | `microsoft_docs_search(query="Azure Verified Modules registry Bicep")`    |
| Resource type schema | `microsoft_docs_search(query="{resource-type} Bicep template reference")` |
| Networking patterns  | `microsoft_docs_search(query="Azure hub-spoke network topology Bicep")`   |
| Security baseline    | `microsoft_docs_search(query="{service} security baseline")`              |
