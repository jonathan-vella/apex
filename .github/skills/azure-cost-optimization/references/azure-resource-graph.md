<!-- ref:azure-resource-graph-v1 -->

# Azure Resource Graph Queries for Cost Optimization

> **Read first**: [`.github/skills/iac-common/references/azure-resource-graph-primer.md`](../../iac-common/references/azure-resource-graph-primer.md) — shared "How to Query", "Key Tables", and KQL essentials. This file contains only the workload-specific query patterns below.

## Cost Optimization Query Patterns

**Required canonical query read:** Before orphan discovery, you MUST read only these named patterns in
[Orphaned Resource Patterns](../../azure-resources/references/azure-resource-graph.md#orphaned-resource-patterns):

- **Unattached managed disks**
- **Unused public IP addresses**
- **Orphaned network interfaces**

Use their exact KQL, including projected fields. Do not proceed if the patterns cannot be loaded.
Do not invoke the `azure-resources` skill or run its inventory workflow; return here for the cost-only queries below.
Discovery alone is not savings evidence: correlate findings with actual Cost Management data and utilization metrics.
Continue the [cost, pricing, metrics, report, and audit procedure](detailed-workflow-steps.md#step-4-query-actual-costs).

**Resource count by SKU/tier (spot oversized resources):**

```kql
Resources
| where isnotempty(sku.name)
| summarize count() by type, tostring(sku.name)
| order by count_ desc
```

**Tag coverage for cost allocation:**

```kql
Resources
| extend hasCostCenter = isnotnull(tags['CostCenter'])
| summarize total=count(), tagged=countif(hasCostCenter) by type
| extend coverage=round(100.0 * tagged / total, 1)
| order by total desc
```

**Find idle load balancers (no backend pools):**

```kql
Resources
| where type =~ 'microsoft.network/loadbalancers'
| where array_length(properties.backendAddressPools) == 0
| project name, resourceGroup, location, sku=sku.name
```

**Get Advisor cost recommendations:**

```kql
AdvisorResources
| where properties.category == 'Cost'
| project name, impact=properties.impact, description=properties.shortDescription.solution
```

## Tips

- Use `=~` for case-insensitive type matching (resource types are lowercase)
- Navigate properties with `properties.fieldName`
- Use `--first N` to limit result count
- Use `--subscriptions` to scope to specific subscriptions
- Cross-reference orphaned resources with cost data from Cost Management API
