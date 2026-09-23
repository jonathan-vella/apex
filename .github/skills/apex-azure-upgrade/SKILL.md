---
name: apex-azure-upgrade
user-invocable: true
disable-model-invocation: false
argument-hint: "existing app or cache, current plan or SKU, and target"
description: '**ANALYSIS SKILL** — Assess in-Azure upgrades of existing workloads: Functions Consumption to Flex Consumption, and Azure Cache for Redis to Azure Managed Redis. WHEN: "upgrade Consumption to Flex", "Flex Consumption readiness", "Linux Consumption retirement", "migrate Redis to AMR", "Redis retirement". DO NOT USE FOR: cross-cloud migration (apex-azure-cloud-migrate), deploying (07b/07t).'
license: MIT
metadata:
  author: Microsoft
  version: "1.2.1"
---

# Azure Upgrade Assessment

Adapted from upstream `azure-upgrade`. This skill assesses moving an existing
Azure workload to another plan, tier or service within Azure, and maps the
result to IaC targets. It never creates, stops or deletes resources: the new
resources ship through the APEX workflow (03-Architect decision, 05-IaC Planner,
06b/06t code, 07b/07t deployment).

The upstream automation scripts, progress file and Java SDK modernization flow
are not imported.

## Upgrade Scenarios

| Source                                              | Target                 | Reference                                                                  |
| --------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| Functions Consumption (Y1), Linux or Windows        | Flex Consumption (FC1) | [consumption-to-flex.md](references/services/functions/consumption-to-flex.md) |
| Azure Cache for Redis Basic, Standard, Premium      | Azure Managed Redis    | [redis-to-amr.md](references/services/redis/redis-to-amr.md)               |
| Azure Cache for Redis Enterprise, Enterprise Flash  | Azure Managed Redis    | [redis-to-amr.md](references/services/redis/redis-to-amr.md)               |

No matching scenario? Research the path with `mcp_azure-mcp_documentation` and
`mcp_azure-mcp_get_azure_bestpractices`, and cite Microsoft Learn.

## Rules

1. Follow the [global rules](references/global-rules.md); this skill never performs destructive actions.
2. Assess before recommending any change. Every assessment command is read-only.
3. Confirm the source and target plan or SKU with the user. 03-Architect records target SKUs in `sku-manifest.json`.
4. Never plan to stop, delete or reconfigure the original resource without explicit approval; cutover and cleanup
   are separate approved changes.
5. Inventory app setting names only; never copy values.
6. Price the target only through `cost-estimate-subagent`.
7. Take retirement dates from Microsoft Learn and cite the page.

## MCP Tools

| Tool                                    | Purpose                                         |
| --------------------------------------- | ----------------------------------------------- |
| `mcp_azure-mcp_get_azure_bestpractices` | Best practices for the target service           |
| `mcp_azure-mcp_documentation`           | Microsoft Learn lookups for upgrade scenarios   |
| `mcp_azure-mcp_functionapp`             | Function App details                            |
| `mcp_azure-mcp_appservice`              | App Service plan details                        |
| `mcp_azure-mcp_redis`                   | Azure Cache for Redis and AMR resource details  |

## Steps

1. **Identify** — Determine the source and target plans or SKUs and confirm them with the user.
2. **Assess** — Load the scenario reference. For Functions, write the report defined in
   [assessment.md](references/services/functions/assessment.md) to `agent-output/{project}/upgrade-assessment-report.md`.
3. **Map** — Record the IaC target mapping from the scenario reference for 05-IaC Planner.
4. **Hand off** — 03-Architect records the decision; 05-IaC Planner plans new resources (no in-place conversion);
   the deploy agents run the cutover with the rollback steps documented first.

## Reference Index

| Reference                                           | When to Load                                    |
| --------------------------------------------------- | ----------------------------------------------- |
| `references/global-rules.md`                        | Every upgrade assessment                        |
| `references/services/functions/assessment.md`       | Functions plan upgrade assessment report        |
| `references/services/functions/consumption-to-flex.md` | Consumption to Flex Consumption checks and IaC mapping |
| `references/services/redis/redis-to-amr.md`         | Azure Cache for Redis to Azure Managed Redis    |
