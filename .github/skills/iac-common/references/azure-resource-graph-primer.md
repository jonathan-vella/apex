<!-- ref:azure-resource-graph-primer-v1 -->

# Azure Resource Graph — Shared Primer

Azure Resource Graph (ARG) enables fast, cross-subscription resource
querying using KQL via `az graph query`. This primer is the canonical
shared head for all skill-specific `azure-resource-graph.md` references
in `.github/skills/{azure-compliance,azure-cost-optimization,azure-diagnostics}/`.

## How to Query

Use the `extension_cli_generate` MCP tool to generate `az graph query` commands:

```yaml
mcp_azure-mcp_extension_cli_generate
  intent: "query Azure Resource Graph to <describe what you want to do>"
  cli-type: "az"
```

Or construct directly:

```bash
az graph query -q "<KQL>" --query "data[].{name:name, type:type}" -o table
```

> ⚠️ **Prerequisite:** `az extension add --name resource-graph`

## Key Tables

| Table                    | Contains                                                   |
| ------------------------ | ---------------------------------------------------------- |
| `Resources`              | All ARM resources (name, type, location, properties, tags) |
| `ResourceContainers`     | Subscriptions, resource groups, management groups          |
| `AuthorizationResources` | Role assignments and role definitions                      |
| `AdvisorResources`       | Azure Advisor recommendations (cost, performance, security) |

## KQL Essentials

| Operator      | Purpose                                                      |
| ------------- | ------------------------------------------------------------ |
| `where`       | Filter rows                                                  |
| `project`     | Select / shape columns                                       |
| `extend`      | Add computed columns                                         |
| `summarize`   | Group + aggregate                                            |
| `join kind=`  | Inner/left/right joins across tables                         |
| `mv-expand`   | Unpivot arrays (e.g., NSG rules, tag bags)                   |
| `tostring()`  | Cast dynamic values to string for grouping                   |

## Cross-Subscription Scope

`az graph query` runs across **all subscriptions the principal can read**
by default. Scope with `--subscriptions <id1> <id2>` or `--management-groups <name>`.

## Skill-Specific Pattern Refs

Workload-specific query libraries live in each skill:

- Compliance audits, tag drift, expired Key Vault items → [`.github/skills/azure-compliance/references/azure-resource-graph.md`](../../azure-compliance/references/azure-resource-graph.md)
- Cost optimisation, rightsizing, orphaned resources → [`.github/skills/azure-cost-optimization/references/azure-resource-graph.md`](../../azure-cost-optimization/references/azure-resource-graph.md)
- Diagnostics, runtime health checks → [`.github/skills/azure-diagnostics/references/azure-resource-graph.md`](../../azure-diagnostics/references/azure-resource-graph.md)
- Inventory and visualisation → [`.github/skills/azure-resources/references/azure-resource-graph.md`](../../azure-resources/references/azure-resource-graph.md)
