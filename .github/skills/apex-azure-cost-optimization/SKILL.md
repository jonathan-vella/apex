---
name: apex-azure-cost-optimization
user-invocable: true
disable-model-invocation: false
argument-hint: "subscription scope and analysis period"
description: '**ANALYSIS SKILL** — Query, forecast and optimize Azure costs via cost + utilization analysis. WHEN: "optimize Azure costs", "find cost savings", "what did we spend", "cost forecast", "rightsize VMs", "find orphaned resources", "optimize Redis costs". DO NOT USE FOR: deploying (apex-azure-deploy), general diagnostics (apex-azure-diagnostics), security issues (apex-azure-compliance).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cost Optimization Skill

Analyze Azure subscriptions to identify cost savings through orphaned resource cleanup, rightsizing, and optimization recommendations based on actual usage data.

## Routing

| User intent                           | Workflow                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| Understand current or historical cost | [Cost query](references/cost-query/workflow.md) (`query_costs`)    |
| Reduce costs or find waste            | [Instructions](#instructions) below                               |
| Project future cost                   | [Cost forecast](references/cost-forecast/workflow.md) (`forecast_costs`) |

## Scope Reference (Shared Across All Workflows)

- Subscription: `/subscriptions/<id>`
- Resource group: `/subscriptions/<id>/resourceGroups/<name>`
- Management group: `/providers/Microsoft.Management/managementGroups/<id>`
- Billing account: `/providers/Microsoft.Billing/billingAccounts/<id>`

## When to Use This Skill

Use this skill when the user asks to:

- Optimize Azure costs or reduce spending
- Analyze Azure subscription for cost savings
- Generate cost optimization report
- Find orphaned or unused resources
- Rightsize Azure VMs, containers, or services
- Identify where they're overspending in Azure
- **Optimize Redis costs specifically** - See [Azure Redis Cost Optimization](./references/azure-redis.md) for Redis-specific analysis
- **Review storage tiers and lifecycle** - See [Azure Storage Cost Review](./references/azure-storage-tiers.md)

## Rules

- **Read-only analysis first** — never delete or modify resources during the assessment phase; remediation is a separate user-approved step
- **Validate prerequisites** before starting (Azure CLI authenticated, `costmanagement` + `resource-graph` extensions, `azqr` installed, Cost Management Reader + Monitoring Reader + Reader roles)
- **Use real data** — recommendations must be grounded in actual cost queries and utilization metrics, not assumptions
- **Cite sources** — every savings estimate must reference the underlying cost query or pricing API result (audit trail in `agent-output/{project}/cost-query-result<timestamp>.json`)
- **Classify safely** — mark recommendations as Safe / Review / Risky; never auto-apply destructive operations
- **Show the total bill** — present savings next to the scope's total actual cost for the same period, so each saving reads against the whole bill
- **Redis-specific scope** — when the user asks about Redis only, follow [Azure Redis Cost Optimization](./references/azure-redis.md) instead of the general subscription workflow
- **Save artifacts** to `agent-output/{project}/costoptimizereport<timestamp>.md` and the audit trail JSON; without a project, ask for its name before writing
- **Out of scope**: deploying resources (use `apex-azure-deploy`), security issues (use `apex-azure-compliance`), general diagnostics (use `apex-azure-diagnostics`)

## Instructions

High-level step list (full procedure in
[`references/workflow-steps.md`](./references/workflow-steps.md)):

|   # | Step                                                                                           | Reference                                                               |
| --: | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
|   0 | Validate prerequisites (Azure CLI, `costmanagement` + `resource-graph` extensions, azqr, RBAC) | [`workflow-steps.md`](./references/workflow-steps.md)                   |
|   1 | Load Azure cost-optimization best practices via `mcp_azure-mcp_get_azure_bestpractices`        | [`workflow-steps.md`](./references/workflow-steps.md)                   |
| 1.5 | (Conditional) Redis-specific analysis branch                                                   | [`azure-redis.md`](./references/azure-redis.md)                         |
| 1.6 | (Redis branch) Choose analysis scope (subscription / prefix / tenant-wide)                     | [`azure-redis.md`](./references/azure-redis.md)                         |
|   2 | Run Azure Quick Review (`extension_azqr`) for orphaned-resource discovery                      | [`azure-quick-review.md`](./references/azure-quick-review.md)           |
|   3 | Discover resources cross-subscription via Azure Resource Graph                                 | [`azure-resource-graph.md`](./references/azure-resource-graph.md)       |
| 4–9 | Cost queries, pricing validation, metrics, report, audit trail, cleanup                        | [`detailed-workflow-steps.md`](./references/detailed-workflow-steps.md) |

> **Branching rule**: use Redis-only analysis only for an explicitly Redis-only request.
> Mixed-service or subscription-wide requests retain the general workflow and add
> Redis analysis for those resources. An ambiguous Redis mention never narrows scope;
> clarify intent while preserving all requested services.

## Output

The skill generates:

1. **Cost Optimization Report** (`agent-output/{project}/costoptimizereport<timestamp>.md`)
   - Executive summary with total costs and top drivers
   - Detailed cost breakdown with Azure Portal links
   - Prioritized recommendations with actual data and estimated savings
   - Implementation commands with safety warnings

2. **Cost Query Results** (`agent-output/{project}/cost-query-result<timestamp>.json`)
   - Audit trail of all cost queries and responses
   - Validation evidence for recommendations

## Important Notes

📋 **Reference**: Read `references/best-practices-notes.md` for data classification labels, best practices, common pitfalls, and safety requirements.

## SDK Quick References

- **Redis Management**: [.NET](references/sdk/azure-resource-manager-redis-dotnet.md)

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                               | When to Load                                                       |
| --------------------------------------- | ------------------------------------------------------------------ |
| `../apex-entra-app-registration/references/auth-best-practices.md` | Auth Best Practices                                                |
| `references/azure-quick-review.md`      | Azure Quick Review                                                 |
| `references/azure-redis.md`             | Azure Redis                                                        |
| `references/azure-resource-graph.md`    | Azure Resource Graph                                               |
| `references/workflow-steps.md`          | Steps 0–3: prerequisites, best practices, azqr, resource discovery |
| `references/detailed-workflow-steps.md` | Steps 4-9: cost queries, pricing, metrics, report, audit, cleanup  |
| `references/best-practices-notes.md`    | Data classification, best practices, pitfalls, safety              |
| `references/cost-query/workflow.md`     | Cost breakdowns, trends and totals; guardrails and 429 handling    |
| `references/cost-forecast/workflow.md`  | Forecasts; training-data and time-window guardrails                |
| `references/azure-storage-tiers.md`     | Storage access tiers, lifecycle tiering and review signals         |
