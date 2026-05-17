<!-- ref:azure-resource-graph-v1 -->

# Azure Resource Graph Queries for Cost Optimization

> **Read first**: [`.github/skills/iac-common/references/azure-resource-graph-primer.md`](../../iac-common/references/azure-resource-graph-primer.md) — shared "How to Query", "Key Tables", and KQL essentials. This file contains only the workload-specific query patterns below.

## Cost Optimization Query Patterns

**Find orphaned (unattached) managed disks:**

```kql
Resources
| where type =~ 'microsoft.compute/disks'
| where isempty(managedBy)
| project name, resourceGroup, location, diskSizeGb=properties.diskSizeGB, sku=sku.name
```

**Find unattached public IP addresses:**

```kql
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where isempty(properties.ipConfiguration)
| project name, resourceGroup, location, sku=sku.name
```

**Find orphaned network interfaces:**

```kql
Resources
| where type =~ 'microsoft.network/networkinterfaces'
| where isempty(properties.virtualMachine)
| project name, resourceGroup, location
```

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
