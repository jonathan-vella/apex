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

Wire AVM child modules by passing outputs as inputs; never hardcode IDs.
See `references/common-patterns.md` for full examples.

## Key Rules

- **AVM-first**: Use `Azure/avm-res-*` registry modules over raw `azurerm_*`
- **Hub-spoke**: Spokes peer to hub only; **Private endpoints**: PE + DNS zone + VNet link
- **Diagnostics**: Every resource → Log Analytics; **Identity**: SystemAssigned + RBAC
- **Provider pin**: `~> 4.0`; **Conditional**: `for_each` over `count`

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
