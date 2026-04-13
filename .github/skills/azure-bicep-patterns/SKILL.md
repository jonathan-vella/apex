---
name: azure-bicep-patterns
description: "Reusable Azure Bicep patterns: hub-spoke, private endpoints, diagnostics, AVM composition. USE FOR: Bicep template design, hub-spoke networking, private endpoint patterns, AVM modules. DO NOT USE FOR: Terraform code, architecture decisions, troubleshooting, diagram generation."
compatibility: Requires Azure CLI with Bicep extension
---

# Azure Bicep Patterns Skill

Reusable infrastructure patterns for Azure Bicep templates. Complements
`iac-bicep-best-practices.instructions.md` (style) and `azure-defaults` skill (naming, tags, regions).

---

## Quick Reference

| Pattern                  | When to Use                                      | Reference                                                          |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| Hub-Spoke Networking     | Multi-workload environments with shared services | [hub-spoke-pattern](references/hub-spoke-pattern.md)               |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  | [private-endpoint-pattern](references/private-endpoint-pattern.md) |
| Diagnostic Settings      | Every deployed resource (mandatory)              | [common-patterns](references/common-patterns.md)                   |
| Conditional Deployment   | Optional resources controlled by parameters      | [common-patterns](references/common-patterns.md)                   |
| Module Composition       | Breaking main.bicep into reusable modules        | [common-patterns](references/common-patterns.md)                   |
| Managed Identity Binding | Any service-to-service authentication            | [common-patterns](references/common-patterns.md)                   |
| Budget & Cost Monitoring | Every deployment (mandatory)                     | [budget-pattern](references/budget-pattern.md)                     |
| What-If / AVM Pitfalls   | Pre-deployment validation & AVM gotchas          | [avm-pitfalls](references/avm-pitfalls.md)                         |

---

## Canonical Example — Module Interface

```bicep
// modules/storage.bicep — every module follows this contract
@description('Storage account name')
param name string
param location string
param tags object
param logAnalyticsWorkspaceName string

output resourceId string = storageAccount.id
output resourceName string = storageAccount.name
output principalId string = storageAccount.identity.?principalId ?? ''
```

Accept `name`, `location`, `tags`, `logAnalyticsWorkspaceName`; output `resourceId`, `resourceName`, `principalId`.

---

## Key Rules Summary

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

---

## Reference Index

| File                                                                  | Content                                                               |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [hub-spoke-pattern.md](references/hub-spoke-pattern.md)               | Hub-spoke VNet orchestration with peering                             |
| [private-endpoint-pattern.md](references/private-endpoint-pattern.md) | PE wiring + DNS zone groups + group ID table                          |
| [common-patterns.md](references/common-patterns.md)                   | Diagnostics, conditional deploy, module composition, managed identity |
| [budget-pattern.md](references/budget-pattern.md)                     | Consumption budget, forecast alerts, anomaly detection                |
| [avm-pitfalls.md](references/avm-pitfalls.md)                         | What-if interpretation, AVM gotchas, learn more links                 |

---

## Learn More

| Topic                | How to Find                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| AVM module catalog   | `microsoft_docs_search(query="Azure Verified Modules registry Bicep")`    |
| Resource type schema | `microsoft_docs_search(query="{resource-type} Bicep template reference")` |
