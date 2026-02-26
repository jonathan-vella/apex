---
description: "MANDATORY Azure Policy compliance rules for Terraform code generation. Azure Policy always wins."
applyTo: "**/*.tf, **/*.agent.md"
---

# Terraform Policy Compliance Instructions

**First Principle: Azure Policy always wins.** Current Azure Policy
implementation cannot be changed. Code MUST adapt to policy, never
the reverse.

## Mandate

ALL Terraform code generation MUST cross-reference
`04-governance-constraints.md` and `04-governance-constraints.json`
before writing templates. These artifacts contain the discovered
Azure Policy constraints for the target subscription.

## Dynamic Tag List

Tags MUST come from governance constraints, not hardcoded defaults.
The 4 baseline defaults in `terraform-code-best-practices.instructions.md`
(`Environment`, `ManagedBy`, `Project`, `Owner`) are a **MINIMUM** —
discovered policies always win. If governance constraints specify
9 tags, the Terraform code MUST include all 9.

### Example

```text
Defaults (azure-defaults skill):  4 tags
Governance constraints discovered: 9 tags (environment, owner,
  costcenter, application, workload, sla, backup-policy,
  maint-window, tech-contact)
Required in Terraform code:       9 tags (governance wins)
```

```hcl
# locals.tf — all 9 tags when governance requires them
locals {
  tags = merge(var.tags, {
    environment      = var.environment
    owner            = var.owner
    costcenter       = var.costcenter
    application      = var.application
    workload         = var.workload
    sla              = var.sla
    backup-policy    = var.backup_policy
    maint-window     = var.maint_window
    tech-contact     = var.tech_contact
  })
}
```

## `azurePropertyPath` Translation

For each Deny or Modify policy in `04-governance-constraints.json`,
read the `azurePropertyPath` field and translate it to the
corresponding `azurerm_*` resource argument:

### Translation Pattern

1. Split `azurePropertyPath` on `.` → `[resourceType, "properties", ...rest]`
2. Map `resourceType` to the correponding `azurerm_*` resource using the table below
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

## Policy Compliance Checklist

For every policy in `04-governance-constraints.json`:

### Deny Policies

- [ ] Read `azurePropertyPath` and `requiredValue` from JSON
- [ ] Translate `azurePropertyPath` to `azurerm_*` resource argument using the table above
- [ ] Verify the generated Terraform code sets the argument to the required value
- [ ] If the argument is missing, add it
- [ ] If the argument value conflicts, change it to match policy

### Modify Policies

- [ ] Document expected auto-modifications in the implementation reference
- [ ] Do NOT set values that Modify policies auto-apply (avoid conflicts)

### DeployIfNotExists Policies

- [ ] Document auto-deployed resources in the implementation reference
- [ ] Include expected resources in cost estimates

### Audit Policies

- [ ] Add a comment in the resource block for awareness
- [ ] Set compliant values where feasible (best effort)

### Audit Policy Comment Pattern

```hcl
resource "azurerm_storage_account" "this" {
  # AUDIT: Policy "Require diagnostic settings" — compliant if Log Analytics configured
  # ...
}
```

## Enforcement Rule

> [!CAUTION]
> **Azure Policy always wins.** Current Azure Policy implementation
> cannot be changed. Code MUST adapt to policy, never the reverse.
> A governance compliance failure is a HARD GATE — the Terraform Code
> Generator MUST NOT proceed past Phase 1.5 with unresolved
> policy violations.

## HCP Terraform Cloud Guardrail

> [!CAUTION]
> **NEVER** use HCP Terraform Cloud (`terraform { cloud {} }`) or
> reference `TFE_TOKEN` in generated code. State backend MUST be
> Azure Storage Account. See
> `terraform-code-best-practices.instructions.md` § State Backend.

## Anti-Patterns

| Anti-Pattern                                                        | Why It Fails                                                                              | Correct Approach                                        |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Use `terraform { cloud {} }` or `TFE_TOKEN`                         | Vendor lock-in; violates Azure-only backend policy                                        | Use `backend "azurerm"` with Azure Storage Account      |
| Assume 4 tags are sufficient                                        | Azure Policy may enforce 9+ tags                                                          | Read `04-governance-constraints.md` for actual tag list |
| Ignore `public_network_access_enabled` constraints                  | Deny policy blocks deployment                                                             | Check network policies in governance constraints        |
| Skip constraints reading ("trust artifact chain")                   | Trusting the chain means accepting architecture decisions, NOT skipping compliance checks | Always read and enforce governance constraints          |
| Hardcode security settings without checking policy                  | Policy may require stricter values                                                        | Cross-reference `04-governance-constraints.json`        |
| Use `bicepPropertyPath` for Terraform translation                   | Bicep path format is ARM-only                                                             | Use `azurePropertyPath` for Terraform argument mapping  |
| Generate Terraform without reading `04-governance-constraints.json` | Governance-blind code fails deployment                                                    | Phase 1.5 is a HARD GATE                                |

## Cross-References

- **Governance constraints artifact**: `agent-output/{project}/04-governance-constraints.md`
- **Governance constraints JSON**: `agent-output/{project}/04-governance-constraints.json`
- **Governance discovery instructions**: `.github/instructions/governance-discovery.instructions.md`
- **Azure defaults (baseline tags)**: `.github/skills/azure-defaults/SKILL.md`
- **Terraform best practices**: `.github/instructions/terraform-code-best-practices.instructions.md`
