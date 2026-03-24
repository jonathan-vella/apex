<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Bicep Patterns Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Quick Reference

| Pattern                 | When to Use                                      | Reference                                                          |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Hub-Spoke Networking    | Multi-workload environments with shared services | [hub-spoke-pattern](references/hub-spoke-pattern.md)               |
| Private Endpoint Wiring | Any PaaS service requiring private connectivity  | [private-endpoint-pattern](references/private-endpoint-pattern.md) |
| Diagnostic Settings     | Every deployed resource (mandatory)              | [common-patterns](references/common-patterns.md)                   |
| Conditional Deployment  | Optional resources controlled by parameters      | [common-patterns](references/common-patterns.md)                   |

> _See SKILL.md for full content._

## Canonical Example — Module Interface

```bicep
// modules/storage.bicep — every module follows this contract
@description('Storage account name')
param name string
param location string
param tags object
```

## Key Rules Summary

- **Hub-Spoke**: Hub holds shared infra; spokes peer to hub only
- **Private Endpoints**: PE + DNS Zone Group + DNS Zone; see group ID table
- **Diagnostics**: `categoryGroup: 'allLogs'` + `AllMetrics`; pass workspace **name** not ID
- **Identity**: `guid()` for idempotent role names; scope narrowly

> _See SKILL.md for full content._

## Reference Index

| File                                                                  | Content                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [hub-spoke-pattern.md](references/hub-spoke-pattern.md)               | Hub-spoke VNet orchestration with peering                             |
| [private-endpoint-pattern.md](references/private-endpoint-pattern.md) | PE wiring + DNS zone groups + group ID table                          |
| [common-patterns.md](references/common-patterns.md)                   | Diagnostics, conditional deploy, module composition, managed identity |
| [avm-pitfalls.md](references/avm-pitfalls.md)                         | What-if interpretation, AVM gotchas, learn more links                 |

> _See SKILL.md for full content._
