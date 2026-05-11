<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Bicep Patterns Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Quick Reference

| Pattern                  | When to Use                                      | Reference                                                          |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| Hub-Spoke Networking     | Multi-workload environments with shared services | [hub-spoke-pattern](references/hub-spoke-pattern.md)               |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  | [private-endpoint-pattern](references/private-endpoint-pattern.md) |
| Diagnostic Settings      | Every deployed resource (mandatory)              | [common-patterns](references/common-patterns.md)                   |
> _See SKILL.md for full content._

## Canonical Example — Module Interface

Every Bicep module in this repo follows the same input/output contract:

- **Inputs (required)**: `name`, `location`, `tags`, `logAnalyticsWorkspaceName`
- **Outputs (required)**: `resourceId`, `resourceName`, `principalId` (use `.?principalId ?? ''` so modules without managed identity still expose the output)
> _See SKILL.md for full content._

## Steps

Applying a pattern in a Bicep template:

1. **Identify the pattern** — match your need to a row in [Quick Reference](#quick-reference) (hub-spoke, private endpoint, diagnostics, conditional, identity, budget)
2. **Load the reference** — read the linked `references/*.md` for the chosen pattern; do not load all at once
3. **Compose the module** — follow the Module Interface contract above (`name`/`location`/`tags`/`logAnalyticsWorkspaceName` in; `resourceId`/`resourceName`/`principalId` out)
> _See SKILL.md for full content._

## Rules

- **Hub-Spoke**: Hub holds shared infra; spokes peer to hub only; NSGs per subnet
- **Private Endpoints**: Always wire PE + DNS Zone Group + DNS Zone; see group ID table in reference
- **Diagnostics**: `categoryGroup: 'allLogs'` + `AllMetrics`; pass workspace **name** not ID
- **Conditional**: `bool` params with defaults; guard outputs with ternary
- **Identity**: `guid()` for idempotent role names; `principalType: 'ServicePrincipal'`; scope narrowly
> _See SKILL.md for full content._

## Gotchas

- **AVM output shapes vary across modules** — Different AVM modules expose different
  outputs. Always check the module README before referencing outputs.
- **Tag merging in AVM modules** — Some AVM modules merge tags internally.
  Verify deployed tags include all required policy tags after deployment.
- **What-If red flags** — Watch for unexpected deletes, SKU downgrades,
> _See SKILL.md for full content._
