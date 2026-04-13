# IaC Policy Compliance

Shared policy compliance rules for Bicep and Terraform IaC generation.
Referenced by the IaC best-practices instruction files.

## Policy Compliance Mandate

All IaC code generation cross-references `04-governance-constraints.md`
and `04-governance-constraints.json` before writing templates. These
artifacts contain discovered Azure Policy constraints for the target
subscription.

## Dynamic Tag List

Tags come from governance constraints, not hardcoded defaults.
The 4 baseline defaults (`Environment`, `ManagedBy`, `Project`, `Owner`)
are a minimum — discovered policies always win. If governance
constraints specify 9 tags, the generated code includes all 9.

### Example

```text
Defaults (azure-defaults skill):  4 tags
Governance constraints discovered: 9 tags (environment, owner,
  costcenter, application, workload, sla, backup-policy,
  maint-window, tech-contact)
Required in generated code:       9 tags (governance wins)
```

## Policy Compliance Checklist

For every policy in `04-governance-constraints.json`:

### Deny Policies

1. Read property path and `requiredValue` from JSON
2. Translate to IaC-specific argument (Bicep or Terraform)
3. Verify the generated code sets the property to the required value
4. If the property is missing, add it
5. If the property value conflicts, change it to match policy

### Modify Policies

1. Document expected auto-modifications in the implementation reference
2. Do not set values that Modify policies auto-apply (avoid conflicts)

### DeployIfNotExists Policies

1. Document auto-deployed resources in the implementation reference
2. Include expected resources in cost estimates

### Audit Policies

1. Document compliance expectations
2. Set compliant values where feasible (best effort)

## Bicep Implementation

For Deny policies, prefer `azurePropertyPath` from JSON; fall back to
`bicepPropertyPath` if absent. Translate by dropping the leading
resource-type segment (e.g., `storageAccount.`) and using the remainder
as the ARM property path.

## Terraform Implementation

### `azurePropertyPath` Translation

For each Deny or Modify policy in `04-governance-constraints.json`,
read the `azurePropertyPath` field and translate it to the corresponding
`azurerm_*` resource argument:

1. Split `azurePropertyPath` on `.` → `[resourceType, "properties", ...rest]`
2. Map `resourceType` to the corresponding `azurerm_*` resource using the table below
3. Map the `properties.` path to the Terraform argument name (snake_case)

### Resource Type Mapping

| `azurePropertyPath` prefix | Terraform resource                                  |
| -------------------------- | --------------------------------------------------- |
| `storageAccount`           | `azurerm_storage_account`                           |
| `keyVault`                 | `azurerm_key_vault`                                 |
| `sqlServer`                | `azurerm_mssql_server`                              |
| `sqlDatabase`              | `azurerm_mssql_database`                            |
| `cosmosDbAccount`          | `azurerm_cosmosdb_account`                          |
| `webApp`                   | `azurerm_linux_web_app` / `azurerm_windows_web_app` |
| `appServicePlan`           | `azurerm_service_plan`                              |
| `containerRegistry`        | `azurerm_container_registry`                        |
| `aksCluster`               | `azurerm_kubernetes_cluster`                        |
| `serviceBusNamespace`      | `azurerm_servicebus_namespace`                      |
| `eventHubNamespace`        | `azurerm_eventhub_namespace`                        |
| `logAnalyticsWorkspace`    | `azurerm_log_analytics_workspace`                   |

### Property Path Mapping Examples

| `azurePropertyPath`                                  | Terraform Argument                        |
| ---------------------------------------------------- | ----------------------------------------- |
| `storageAccount.properties.minimumTlsVersion`        | `min_tls_version`                         |
| `storageAccount.properties.allowBlobPublicAccess`    | `allow_nested_items_to_be_public`         |
| `storageAccount.properties.supportsHttpsTrafficOnly` | `https_traffic_only_enabled`              |
| `sqlServer.properties.minimalTlsVersion`             | `minimum_tls_version`                     |
| `sqlServer.properties.publicNetworkAccess`           | `public_network_access_enabled`           |
| `keyVault.properties.enableSoftDelete`               | `soft_delete_retention_days` (> 0 = true) |
| `keyVault.properties.enablePurgeProtection`          | `purge_protection_enabled`                |
| `containerRegistry.properties.publicNetworkAccess`   | `public_network_access_enabled`           |
| `webApp.properties.httpsOnly`                        | `https_only`                              |

## Policy Anti-Patterns

| Anti-Pattern                                       | Correct Approach                                        |
| -------------------------------------------------- | ------------------------------------------------------- |
| Assume 4 tags are sufficient                       | Read `04-governance-constraints.md` for actual tag list |
| Ignore `publicNetworkAccess` constraints           | Check network policies in governance constraints        |
| Skip governance constraints reading                | Always read and enforce governance constraints          |
| Hardcode security settings without checking policy | Cross-reference `04-governance-constraints.json`        |
| Use `bicepPropertyPath` for Terraform translation  | Use `azurePropertyPath` for Terraform argument mapping  |

## Enforcement

Azure Policy always wins. A governance compliance failure is a gate —
the Code Generator does not proceed past Phase 1.5 with unresolved
policy violations.
