---
name: azure-bicep-patterns
description: '**UTILITY SKILL** — Reusable Azure Bicep patterns: hub-spoke, private endpoints, diagnostics, AVM composition. WHEN: "hub-spoke Bicep", "private endpoint module", "diagnostic settings", "AVM Bicep composition". USE FOR: Bicep template design, hub-spoke networking, private endpoint patterns, AVM modules. DO NOT USE FOR: Terraform code (use terraform-patterns), architecture decisions (use azure-adr), troubleshooting, diagram generation (use drawio).'
compatibility: Requires Azure CLI with Bicep extension
---

# Azure Bicep Patterns Skill

Reusable infrastructure patterns for Azure Bicep templates. Complements
`iac-bicep-best-practices.instructions.md` (style) and `azure-defaults` skill (naming, tags, regions).

## Quick Reference

| Pattern                  | When to Use                                      | Reference                                                              |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Hub-Spoke Networking     | Multi-workload environments with shared services | [hub-spoke-pattern](references/hub-spoke-pattern.md)                   |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  | [private-endpoint-pattern](references/private-endpoint-pattern.md)     |
| Diagnostic Settings      | Every deployed resource (mandatory)              | [common-patterns](references/common-patterns.md)                       |
| Conditional Deployment   | Optional resources controlled by parameters      | [common-patterns](references/common-patterns.md)                       |
| Module Composition       | Breaking main.bicep into reusable modules        | [common-patterns](references/common-patterns.md)                       |
| Managed Identity Binding | Any service-to-service authentication            | [common-patterns](references/common-patterns.md)                       |
| Budget & Cost Monitoring | Every deployment (mandatory)                     | [budget-pattern](references/budget-pattern.md)                         |
| What-If / AVM Pitfalls   | Pre-deployment validation & AVM gotchas          | [avm-pitfalls](references/avm-pitfalls.md)                             |
| Batch Bicep Formatting   | After generating/editing the Bicep tree          | `npm run format:bicep -- infra/bicep/{project}` (wraps `bicep format`) |

## Canonical Example — Module Interface

Every Bicep module in this repo follows the same input/output contract:

- **Inputs (required)**: `name`, `location`, `tags`, `logAnalyticsWorkspaceName`
- **Outputs (required)**: `resourceId`, `resourceName`, `principalId` (use `.?principalId ?? ''` so modules without managed identity still expose the output)

Full code sample and rationale: [`references/module-interface.md`](references/module-interface.md).

## Steps

Applying a pattern in a Bicep template:

1. **Identify the pattern** — match your need to a row in [Quick Reference](#quick-reference) (hub-spoke, private endpoint, diagnostics, conditional, identity, budget)
2. **Load the reference** — read the linked `references/*.md` for the chosen pattern; do not load all at once
3. **Compose the module** — follow the Module Interface contract above (`name`/`location`/`tags`/`logAnalyticsWorkspaceName` in; `resourceId`/`resourceName`/`principalId` out)
4. **Pin AVM versions** — when using AVM modules, pin to a specific published version; verify via MCR tag listing if helpers fail
5. **Add diagnostics + budget** — every deployed resource gets a diagnostic setting; every deployment gets a budget with 80%/100%/120% forecast alerts
6. **What-if before deploy** — run `az deployment group what-if` and review for unexpected deletes, SKU downgrades, or auth changes
7. **Validate** — `bicep build` + `bicep lint` + `npm run validate:iac-security-baseline`

## Rules

- **Hub-Spoke**: Hub holds shared infra; spokes peer to hub only; NSGs per subnet
- **Private Endpoints**: Always wire PE + DNS Zone Group + DNS Zone; see group ID table in reference
- **Diagnostics**: `categoryGroup: 'allLogs'` + `AllMetrics`; pass workspace **name** not ID
- **Conditional**: `bool` params with defaults; guard outputs with ternary
- **Identity**: `guid()` for idempotent role names; `principalType: 'ServicePrincipal'`; scope narrowly
- **Budget**: 3 forecast thresholds (80%/100%/120%); amount and emails MUST be parameters
- **What-If**: Run before every deploy; watch for unexpected deletes and SKU downgrades
- **AVM**: Always pin versions; wrap modules to override defaults; verify outputs in README
- **AVM Version Fallback**: When AVM version helpers are incomplete, query public MCR tag listings
  (`mcr.microsoft.com/v2/bicep/{module}/tags/list`) to discover authoritative published versions

## Gotchas

- **AVM output shapes vary across modules** — Different AVM modules expose different
  outputs. Always check the module README before referencing outputs.
- **Tag merging in AVM modules** — Some AVM modules merge tags internally.
  Verify deployed tags include all required policy tags after deployment.
- **What-If red flags** — Watch for unexpected deletes, SKU downgrades,
  public access changes, authentication mode changes, or identity removal.
  Always run what-if before deploy.
- **MCR version discovery** — When AVM version helpers are incomplete,
  query `mcr.microsoft.com/v2/bicep/{module}/tags/list` for authoritative
  published versions.

## Reference Index

| File                                                                  | Content                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [hub-spoke-pattern.md](references/hub-spoke-pattern.md)               | Hub-spoke VNet orchestration with peering                             |
| [private-endpoint-pattern.md](references/private-endpoint-pattern.md) | PE wiring + DNS zone groups + group ID table                          |
| [common-patterns.md](references/common-patterns.md)                   | Diagnostics, conditional deploy, module composition, managed identity |
| [budget-pattern.md](references/budget-pattern.md)                     | Consumption budget, forecast alerts, anomaly detection                |
| [avm-pitfalls.md](references/avm-pitfalls.md)                         | What-if interpretation, AVM gotchas, learn more links                 |
| [module-interface.md](references/module-interface.md)                 | Canonical module input/output contract                                |

## Learn More

| Topic                | How to Find                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| AVM module catalog   | `microsoft_docs_search(query="Azure Verified Modules registry Bicep")`    |
| Resource type schema | `microsoft_docs_search(query="{resource-type} Bicep template reference")` |
