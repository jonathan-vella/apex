<!-- ref:azure-resource-graph-v1 -->

# Azure Resource Graph Queries for Diagnostics

> **Read first**: [`.github/skills/iac-common/references/azure-resource-graph-primer.md`](../../iac-common/references/azure-resource-graph-primer.md) — shared "How to Query", "Key Tables", and KQL essentials. This file contains only the workload-specific query patterns below.

## Diagnostics Query Patterns

**Check resource health status across resources:**

```kql
HealthResources
| where type =~ 'microsoft.resourcehealth/availabilitystatuses'
| project name, availabilityState=properties.availabilityState, reasonType=properties.reasonType
```

**Find resources in unhealthy or degraded state:**

```kql
HealthResources
| where type =~ 'microsoft.resourcehealth/availabilitystatuses'
| where properties.availabilityState != 'Available'
| project name, state=properties.availabilityState, reason=properties.reasonType, summary=properties.summary
```

**Query active service health incidents:**

```kql
ServiceHealthResources
| where type =~ 'microsoft.resourcehealth/events'
| where properties.Status == 'Active'
| project name, title=properties.Title, impact=properties.Impact, status=properties.Status
```

**Find resources by provisioning state (failed/stuck deployments):**

```kql
Resources
| where properties.provisioningState != 'Succeeded'
| project name, type, resourceGroup, provisioningState=properties.provisioningState
```

**Find App Services in stopped or error state:**

```kql
Resources
| where type =~ 'microsoft.web/sites'
| where properties.state != 'Running'
| project name, state=properties.state, resourceGroup, location
```

**Find Container Apps with provisioning issues:**

```kql
Resources
| where type =~ 'microsoft.app/containerapps'
| where properties.provisioningState != 'Succeeded'
| project name, provisioningState=properties.provisioningState, resourceGroup
```

## Tips

- Use `=~` for case-insensitive type matching (resource types are lowercase)
- Navigate properties with `properties.fieldName`
- Use `--first N` to limit result count
- Use `--subscriptions` to scope to specific subscriptions
- Combine ARG health data with Azure Monitor metrics for full picture
- Check `HealthResources` before deep-diving into application logs
