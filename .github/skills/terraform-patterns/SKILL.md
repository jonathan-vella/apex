---
name: terraform-patterns
description: "Reusable Azure Terraform patterns: hub-spoke, private endpoints, diagnostics, AVM-TF modules. USE FOR: Terraform template design, hub-spoke networking, AVM modules, plan interpretation. DO NOT USE FOR: Bicep code, architecture decisions, troubleshooting, diagram generation."
compatibility: Requires Terraform >= 1.9, azurerm ~> 4.0, Azure CLI
---

# Azure Terraform Patterns Skill

Composable architecture building blocks for Azure Terraform. Complements
`iac-terraform-best-practices.instructions.md` (style) and `azure-defaults` skill (naming, tags, regions).

---

## Quick Reference

| Pattern                  | When to Use                                      | Reference                                  |
| ------------------------ | ------------------------------------------------ | ------------------------------------------ |
| Hub-Spoke Networking     | Multi-workload environments with shared services | `references/hub-spoke-pattern.md`          |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  | `references/private-endpoint-pattern.md`   |
| Diagnostic Settings      | Every deployed resource (mandatory)              | `references/common-patterns.md`            |
| Conditional Deployment   | Optional resources controlled by variables       | `references/common-patterns.md`            |
| Module Composition       | Calling multiple AVM modules in root module      | See inline example below                   |
| Managed Identity         | Any service-to-service authentication            | `references/common-patterns.md`            |
| Budget & Cost Monitoring | Every deployment (mandatory)                     | `references/budget-pattern.md`             |
| Plan Interpretation      | Pre-deployment validation and change analysis    | `references/plan-interpretation.md`        |
| AVM Pitfalls             | Set-type diffs, provider pins, 4.x changes       | `references/avm-pitfalls.md`               |
| AVM Authoring            | AVM certification requirements, compliance       | `references/avm-authoring-requirements.md` |
| Module Refactoring       | Monolith → module extraction, state migration    | `references/refactor-module.md`            |

---

## Canonical Example — Module Composition

Wire AVM child modules by passing outputs as inputs; never hardcode IDs:

```hcl
module "resource_group" {
  source  = "Azure/avm-res-resources-resourcegroup/azurerm"
  version = "~> 0.1"
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.tags
}

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"
  name                = local.kv_name
  resource_group_name = module.resource_group.name  # ← output wiring
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}
```

---

## Key Rules

- **AVM-first**: Use `Azure/avm-res-*` registry modules over raw `azurerm_*` resources
- **Hub-spoke**: Spokes peer to hub only; never spoke-to-spoke
- **Private endpoints**: Three resources per service — PE, DNS zone, VNet link
- **Diagnostics**: Every resource MUST have a diagnostic setting → Log Analytics
- **Conditional**: Use `for_each` (keyed) over `count` (indexed) for named resources
- **Identity**: SystemAssigned managed identity + RBAC; avoid keys/connection strings
- **Provider pin**: `~> 4.0` (allows 4.x patches, blocks 5.0)
- **Telemetry**: Set `enable_telemetry = false` in restricted-network environments
- **Moved blocks**: Use `moved {}` when renaming resources to prevent destroy/recreate
- **Budget**: 3 forecast thresholds (80%/100%/120%); amount and emails MUST be variables

---

## Reference Index

| File                                       | Contents                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `references/hub-spoke-pattern.md`          | Full hub & spoke VNet + peering HCL                               |
| `references/private-endpoint-pattern.md`   | PE + DNS zone + VNet link HCL, subresource table                  |
| `references/common-patterns.md`            | Diagnostics, conditional deployment, module composition, identity |
| `references/budget-pattern.md`             | Consumption budget, forecast alerts, anomaly detection            |
| `references/plan-interpretation.md`        | Plan commands, change symbols, red flags, summary script          |
| `references/avm-pitfalls.md`               | Set-type diffs, provider pins, tag ignore, moved blocks, 4.x      |
| `references/tf-best-practices-examples.md` | Best-practice code examples, formatting, code review checklist    |
| `references/bootstrap-backend-template.md` | Backend bootstrap template                                        |
| `references/deploy-script-template.md`     | Deployment script template                                        |
| `references/project-scaffold.md`           | Project scaffolding structure                                     |
| `references/avm-authoring-requirements.md` | AVM certification: 37 requirements, compliance checklist          |
| `references/refactor-module.md`            | Module extraction, state migration, refactoring patterns          |
