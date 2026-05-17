<!-- ref:azure-resource-graph-v1 -->

# Azure Resource Graph Queries for Compliance Auditing

> **Read first**: [`.github/skills/iac-common/references/azure-resource-graph-primer.md`](../../iac-common/references/azure-resource-graph-primer.md) — shared "How to Query", "Key Tables", and KQL essentials. This file contains only the workload-specific query patterns below.

## Compliance Query Patterns

**Find resources missing a required tag:**

```kql
Resources
| where isnull(tags['Environment']) or isnull(tags['CostCenter'])
| project name, type, resourceGroup, tags
```

**Tag coverage analysis:**

```kql
Resources
| extend hasEnvTag = isnotnull(tags['Environment'])
| summarize total=count(), tagged=countif(hasEnvTag) by type
| extend coverage=round(100.0 * tagged / total, 1)
| order by coverage asc
```

**Find storage accounts without HTTPS enforcement:**

```kql
Resources
| where type =~ 'microsoft.storage/storageaccounts'
| where properties.supportsHttpsTrafficOnly == false
| project name, resourceGroup, location
```

**Find resources with public network access enabled:**

```kql
Resources
| where properties.publicNetworkAccess =~ 'Enabled'
| project name, type, resourceGroup, location
```

**Query role assignments across subscriptions:**

```kql
AuthorizationResources
| where type == 'microsoft.authorization/roleassignments'
| extend principalType = tostring(properties.principalType)
| summarize count() by principalType
```

**Find resource groups without locks:**

```kql
ResourceContainers
| where type == 'microsoft.resources/subscriptions/resourcegroups'
| project rgName=name, rgId=id
| join kind=leftanti (
    Resources
    | where type == 'microsoft.authorization/locks'
    | project rgId=tostring(properties.resourceId)
) on rgId
```

## Tips

- Use `=~` for case-insensitive type matching (resource types are lowercase)
- Navigate properties with `properties.fieldName`
- Use `--first N` to limit result count
- Use `--subscriptions` to scope to specific subscriptions
- Combine with `AdvisorResources` for security recommendations
