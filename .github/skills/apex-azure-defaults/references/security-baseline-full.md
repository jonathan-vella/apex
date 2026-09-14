<!-- ref:security-baseline-full-v1 -->

# Security Baseline & AVM Known Pitfalls

## AVM Known Pitfalls

### Region Limitations

| Service         | Limitation                          | Workaround                     |
| --------------- | ----------------------------------- | ------------------------------ |
| Static Web Apps | 5 regions only (westus2, centralus, | Use `westeurope` for EU        |
|                 | eastus2, westeurope, eastasia)      |                                |
| Azure OpenAI    | Limited regions per model           | Check availability before plan |
| Container Apps  | Most regions but not all            | Verify `cae` in target region  |

### Parameter Type Mismatches

The language-owned [Bicep AVM catalog](../../apex-azure-bicep-patterns/references/avm-pitfalls.md#schema-drift-in-pinned-avm-versions-mandatory-pre-author-check)
owns exact-version observations. Verify the approved pinned module schema before
coding; ARM property types are not necessarily AVM parameter types. If neither
local metadata nor authorized lookup is available, the interface remains unknown:
STOP affected generation and request version validation, never guess or upgrade.

**Log Analytics Workspace** (`operational-insights/workspace`):

- The catalog records `avm/res/operational-insights/workspace:0.15.1`
  accepting `dailyQuotaGb` as a string (`'5'`), not an integer.
- This is an exact-version observation, not a rule for every AVM version.
  Confirm against the approved module metadata; do not coerce based on ARM alone.

**Container Apps Managed Environment** (`app/managed-environment`):

- Verify whether the pinned interface uses `appLogsConfiguration` or
  `logsConfiguration` and its destination shape; neither name is universal.

**Container Apps** (`app/container-app`):

- Check the pinned schema for `scaleSettings`, rules and nesting. Do not assume
  either a module-level object or a `scaleRules` array from another version.

**SQL Server** (`sql/server`):

- Resolve SKU and zone fields on the exact database/module interface, not from
  a server-wide generic object. Preserve the manifest SKU and required zone fields.

**App Service** (`web/site`):

- `APPINSIGHTS_INSTRUMENTATIONKEY` deprecated
- **DO**: Use `APPLICATIONINSIGHTS_CONNECTION_STRING` instead
- **DON'T**: Set instrumentation key directly

**Key Vault** (`key-vault/vault`):

- `softDeleteRetentionInDays` is immutable after creation
- **DO**: Set correctly on first deploy (default: 90)
- **DON'T**: Try to change after vault exists

**Static Web App** (`web/static-site`):

- Free SKU may not be deployable via ARM in all regions
- **DO**: Verify the approved SKU/region combination; propose changes through the owner and approval gates
- **DON'T**: Assume Free tier works everywhere via Bicep

**Container Registry** (`container-registry/registry`, AVM ≥ 0.12.x):

- AVM defaults `networkRuleBypassOptions: 'AzureServices'` and
  `networkRuleSetDefaultAction: 'Deny'`, which are Premium-only properties.
  With `acrSku: 'Basic'` and `publicNetworkAccess: 'Enabled'`, the rendered
  ARM still contains `networkRuleSet` and apply fails with
  `NetworkRuleNotSupported` — even though `bicep build`, lint, and what-if
  pass.
- **DO**: Verify the exact pinned interface and governance requirements. An
  `Allow` default or Premium upgrade is a proposed change, never an automatic
  fix; keep required private networking and route SKU changes for approval.
- **DON'T**: Rely on `what-if` to catch SKU/feature mismatches — see the
  `SKU-Default Mismatch` section in
  [`../../apex-azure-bicep-patterns/references/avm-pitfalls.md`](../../apex-azure-bicep-patterns/references/avm-pitfalls.md)
  for the generic pattern and detection rule.

## Service Lifecycle Validation

### AVM Default Trust

When using AVM modules with default SKU parameters:

- Validate defaults against the approved SKU manifest, effective policy,
  region availability and current lifecycle evidence just like explicit values.
- AVM provenance does not prove SKU compatibility or current service support.
- Missing lifecycle evidence stays unknown and blocks affected production choices.

### Deprecation Research (For Non-AVM or Custom SKUs)

| Source            | Query Pattern                            | Reliability |
| ----------------- | ---------------------------------------- | ----------- |
| Azure Updates     | `azure.microsoft.com/updates/?query=...` | High        |
| Microsoft Learn   | Check "Important" callouts on pages      | High        |
| Azure CLI         | `az provider show --namespace {prov}`    | Medium      |
| Resource Provider | Check available SKUs in target region    | High        |

### Known Deprecation Patterns

| Pattern                    | Status            | Replacement           |
| -------------------------- | ----------------- | --------------------- |
| "Classic" anything         | DEPRECATED        | ARM equivalents       |
| CDN `Standard_Microsoft`   | DEPRECATED 2027   | Azure Front Door      |
| App Gateway v1             | DEPRECATED        | App Gateway v2        |
| "v1" suffix services       | Likely deprecated | Check for v2          |
| Old API versions (2020-xx) | Outdated          | Use latest stable API |

### What-If Deprecation Signals

Deploy agent should scan what-if output for:
`deprecated|sunset|end.of.life|no.longer.supported|classic.*not.*supported|retiring`

If detected, STOP and report before deployment.
