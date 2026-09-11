<!-- ref:kql-templates-v1 -->

# KQL Query Templates

Reusable KQL queries for Azure resource diagnostics and log analysis.

---

## Resource Discovery via Resource Graph

```kql
// List all resources in a resource group with their health status
resources
| where resourceGroup == '{resourceGroupName}'
| project name, type, location, properties.provisioningState
| order by type asc, name asc
```

```kql
// Find resources with non-Succeeded provisioning state
resources
| where resourceGroup == '{resourceGroupName}'
| where properties.provisioningState != 'Succeeded'
| project name, type, properties.provisioningState
```

```kql
// Inventory resources by type
resources
| where resourceGroup == '{resourceGroupName}'
| summarize count() by type
| order by count_ desc
```

---

## App Service Error Rate (last 24h)

```kql
AzureMetrics
| where ResourceId contains '{appName}'
| where MetricName == 'Http5xx'
| where TimeGenerated > ago(24h)
| summarize Total5xx = sum(Total) by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

---

## VM CPU Spikes (last 6h)

```kql
Perf
| where Computer == '{vmName}'
| where ObjectName == 'Processor' and CounterName == '% Processor Time'
| where TimeGenerated > ago(6h)
| summarize AvgCPU = avg(CounterValue), MaxCPU = max(CounterValue) by bin(TimeGenerated, 5m)
| where MaxCPU > 85
| order by TimeGenerated desc
```

---

## Generic Error Search (last 24h)

```kql
AzureDiagnostics
| where ResourceId contains '{resourceName}'
| where TimeGenerated > ago(24h)
| where Level == 'Error' or Level == 'Warning'
| summarize Count = count() by Level, OperationName
| order by Count desc
```

---

## Activity Log — Failed Operations

```bash
az monitor activity-log list \
  --resource-id "$resourceId" \
  --start-time "$(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%SZ)" \
  --query "[?status.value=='Failed'].{op:operationName.localizedValue, time:eventTimestamp, status:status.value, caller:caller}" \
  --output table
```
