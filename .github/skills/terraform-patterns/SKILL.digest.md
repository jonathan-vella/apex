<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Terraform Patterns Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Quick Reference

| Pattern                 | When to Use                                      | Reference                                |
| ----------------------- | ------------------------------------------------ | ---------------------------------------- |
| Hub-Spoke Networking    | Multi-workload environments with shared services | `references/hub-spoke-pattern.md`        |
| Private Endpoint Wiring | Any PaaS service requiring private connectivity  | `references/private-endpoint-pattern.md` |
| Diagnostic Settings     | Every deployed resource (mandatory)              | `references/common-patterns.md`          |
| Conditional Deployment  | Optional resources controlled by variables       | `references/common-patterns.md`          |
| Module Composition      | Calling multiple AVM modules in root module      | See inline example below                 |
| Managed Identity        | Any service-to-service authentication            | `references/common-patterns.md`          |

> _See SKILL.md for full content._

## Canonical Example — Module Composition

Wire AVM child modules by passing outputs as inputs; never hardcode IDs:

```hcl
module "resource_group" {
  source  = "Azure/avm-res-resources-resourcegroup/azurerm"
  version = "~> 0.1"
  name     = "rg-${var.project}-${var.environment}"
  location = var.location

> _See SKILL.md for full content._

## Key Rules

- **AVM-first**: Use `Azure/avm-res-*` registry modules over raw `azurerm_*` resources
- **Hub-spoke**: Spokes peer to hub only; never spoke-to-spoke
- **Private endpoints**: Three resources per service — PE, DNS zone, VNet link
- **Diagnostics**: Every resource MUST have a diagnostic setting → Log Analytics
- **Conditional**: Use `for_each` (keyed) over `count` (indexed) for named resources
- **Identity**: SystemAssigned managed identity + RBAC; avoid keys/connection strings
- **Provider pin**: `~> 4.0` (allows 4.x patches, blocks 5.0)
- **Telemetry**: Set `enable_telemetry = false` in restricted-network environments

> _See SKILL.md for full content._

## Reference Index

| File                                       | Contents                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `references/hub-spoke-pattern.md`          | Full hub & spoke VNet + peering HCL                               |
| `references/private-endpoint-pattern.md`   | PE + DNS zone + VNet link HCL, subresource table                  |
| `references/common-patterns.md`            | Diagnostics, conditional deployment, module composition, identity |
| `references/plan-interpretation.md`        | Plan commands, change symbols, red flags, summary script          |
| `references/avm-pitfalls.md`               | Set-type diffs, provider pins, tag ignore, moved blocks, 4.x      |
| `references/tf-best-practices-examples.md` | Best-practice code examples, formatting, code review checklist    |

> _See SKILL.md for full content._
