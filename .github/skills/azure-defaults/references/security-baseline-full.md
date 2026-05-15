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

Known issues when using AVM modules — verify before coding:

**Log Analytics Workspace** (`operational-insights/workspace`):

- `dailyQuotaGb` is `int` in AVM, not `string`
- **DO**: `dailyQuotaGb: 5`
- **DON'T**: `dailyQuotaGb: '5'`

**Container Apps Managed Environment** (`app/managed-environment`):

- `appLogsConfiguration` deprecated in newer versions
- **DO**: Use `logsConfiguration` with destination object
- **DON'T**: Use `appLogsConfiguration.destination: 'log-analytics'`

**Container Apps** (`app/container-app`):

- `scaleSettings` is an object, not array of rules
- **DO**: Check AVM schema for exact object shape
- **DON'T**: Assume `scaleRules: [...]` array format

**SQL Server** (`sql/server`):

- `sku` parameter is a typed object `{name, tier, capacity}`
- **DO**: Pass full SKU object matching schema
- **DON'T**: Pass just string `'S0'`
- `availabilityZone` requires specific format per region

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
- **DO**: Use `Standard` SKU for reliable ARM deployment
- **DON'T**: Assume Free tier works everywhere via Bicep

**Container Registry** (`container-registry/registry`, AVM ≥ 0.12.x):

- AVM defaults `networkRuleBypassOptions: 'AzureServices'` and
  `networkRuleSetDefaultAction: 'Deny'`, which are Premium-only properties.
  With `acrSku: 'Basic'` and `publicNetworkAccess: 'Enabled'`, the rendered
  ARM still contains `networkRuleSet` and apply fails with
  `NetworkRuleNotSupported` — even though `bicep build`, lint, and what-if
  pass.
- **DO**: Pass `networkRuleSetDefaultAction: 'Allow'` explicitly when the SKU
  is `Basic`, or upgrade to Premium.
- **DON'T**: Rely on `what-if` to catch SKU/feature mismatches — see the
  `SKU-Default Mismatch` section in
  [`../../azure-bicep-patterns/references/avm-pitfalls.md`](../../azure-bicep-patterns/references/avm-pitfalls.md)
  for the generic pattern and detection rule.

## Service Lifecycle Validation

### AVM Default Trust

When using AVM modules with default SKU parameters:

- Trust the AVM default — Microsoft maintains these
- No additional deprecation research needed for defaults
- If overriding SKU parameter, run deprecation research

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
