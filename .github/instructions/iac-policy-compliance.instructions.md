---
description: "MANDATORY Azure Policy compliance rules for Bicep and Terraform code generation. Azure Policy always wins."
applyTo: "**/*.bicep, **/*.tf"
---

# IaC Policy Compliance Instructions

**First Principle: Azure Policy always wins.** Current Azure Policy
implementation cannot be changed. Code MUST adapt to policy, never
the reverse.

## Mandate

ALL IaC code generation MUST cross-reference
`04-governance-constraints.md` and `04-governance-constraints.json`
before writing templates. These artifacts contain the discovered
Azure Policy constraints for the target subscription.

## Dynamic Tag List

Tags MUST come from governance constraints, not hardcoded defaults.
The 4 baseline defaults (`Environment`, `ManagedBy`, `Project`, `Owner`)
are a **MINIMUM** — discovered policies always win. If governance
constraints specify 9 tags, the generated code MUST include all 9.

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

- [ ] Read property path and `requiredValue` from JSON
- [ ] Translate to IaC-specific argument (see implementation sections below)
- [ ] Verify the generated code sets the property to the required value
- [ ] If the property is missing, add it
- [ ] If the property value conflicts, change it to match policy

### Modify Policies

- [ ] Document expected auto-modifications in the implementation reference
- [ ] Do NOT set values that Modify policies auto-apply (avoid conflicts)

### DeployIfNotExists Policies

- [ ] Document auto-deployed resources in the implementation reference
- [ ] Include expected resources in cost estimates

### Audit Policies

- [ ] Document compliance expectations
- [ ] Set compliant values where feasible (best effort)

## Implementation: Bicep

For Deny policies, prefer `azurePropertyPath` from JSON; fall back to
`bicepPropertyPath` if absent. Translate by dropping the leading
resource-type segment (e.g., `storageAccount.`) and using the remainder
as the ARM property path.

## Implementation: Terraform

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

### Audit Policy Comment Pattern

```hcl
resource "azurerm_storage_account" "this" {
  # AUDIT: Policy "Require diagnostic settings" — compliant if Log Analytics configured
  # ...
}
```

### HCP Terraform Cloud Guardrail

**NEVER** use HCP Terraform Cloud (`terraform { cloud {} }`) or
reference `TFE_TOKEN` in generated code. State backend MUST be
Azure Storage Account. See `terraform-code-best-practices.instructions.md`.

## Enforcement Rule

**Azure Policy always wins.** A governance compliance failure is a
HARD GATE — the Code Generator MUST NOT proceed past Phase 1.5 with
unresolved policy violations.

## Anti-Patterns

| Anti-Pattern                                            | Why It Fails                                                                              | Correct Approach                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Assume 4 tags are sufficient                            | Azure Policy may enforce 9+ tags                                                          | Read `04-governance-constraints.md` for actual tag list |
| Ignore `publicNetworkAccess` constraints                | Deny policy blocks deployment                                                             | Check network policies in governance constraints        |
| Skip governance constraints reading                     | Trusting the chain means accepting architecture decisions, NOT skipping compliance checks | Always read and enforce governance constraints          |
| Hardcode security settings without checking policy      | Policy may require stricter values                                                        | Cross-reference `04-governance-constraints.json`        |
| Generate code without reading governance constraints    | Governance-blind code fails deployment                                                    | Phase 1.5 is a HARD GATE                                |
| Use `terraform { cloud {} }` or `TFE_TOKEN` (Terraform) | Vendor lock-in; violates Azure-only backend policy                                        | Use `backend "azurerm"` with Azure Storage Account      |
| Use `bicepPropertyPath` for Terraform translation       | Bicep path format is ARM-only                                                             | Use `azurePropertyPath` for Terraform argument mapping  |

## Cross-References

- **Governance constraints artifact**: `agent-output/{project}/04-governance-constraints.md`
- **Governance constraints JSON**: `agent-output/{project}/04-governance-constraints.json`
- **Governance discovery instructions**: `.github/instructions/governance-discovery.instructions.md`
- **Azure defaults (baseline tags)**: `.github/skills/azure-defaults/SKILL.md`
- **Bicep best practices**: `.github/instructions/bicep-code-best-practices.instructions.md`
- **Terraform best practices**: `.github/instructions/terraform-code-best-practices.instructions.md`
