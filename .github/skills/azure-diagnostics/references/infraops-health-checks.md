<!-- ref:health-checks-v1 -->

# Per-Resource Health Checks

Diagnostic commands and metric thresholds for each Azure resource type.

---

## Diagnostic Settings Check

Verify every resource has diagnostic settings configured:

```bash
az monitor diagnostic-settings list \
  --resource "$resourceId" \
  --query "[].{name:name, workspace:workspaceId}" \
  --output table
```

If no diagnostic settings exist, create them using the pattern from the
`azure-bicep-patterns` skill (Diagnostic Settings section).

---

## App Service / Web Apps

| Check                | Command / Query                                               | Healthy Threshold         |
| -------------------- | ------------------------------------------------------------- | ------------------------- |
| HTTP health          | `az webapp show --name {name} --query state`                  | `Running`                 |
| Response time        | KQL: `AzureMetrics \| where MetricName == "HttpResponseTime"` | p95 < 2 seconds           |
| HTTP 5xx rate        | KQL: `AzureMetrics \| where MetricName == "Http5xx"`          | < 1% of total requests    |
| CPU usage            | KQL: `AzureMetrics \| where MetricName == "CpuPercentage"`    | < 80% sustained           |
| Memory usage         | KQL: `AzureMetrics \| where MetricName == "MemoryPercentage"` | < 85% sustained           |
| App Service Plan SKU | `az appservice plan show --name {plan} --query sku`           | Matches architecture spec |

---

## Virtual Machines

| Check            | Command / Query                                                       | Healthy Threshold        |
| ---------------- | --------------------------------------------------------------------- | ------------------------ |
| Power state      | `az vm get-instance-view --name {name} --query instanceView.statuses` | `PowerState/running`     |
| CPU utilisation  | KQL: `Perf \| where ObjectName == "Processor"`                        | < 85% sustained          |
| Available memory | KQL: `Perf \| where ObjectName == "Memory"`                           | > 20% free               |
| Disk latency     | KQL: `Perf \| where CounterName == "Avg. Disk sec/Transfer"`          | < 20 ms                  |
| Boot diagnostics | `az vm boot-diagnostics get-boot-log --name {name}`                   | No kernel panic / errors |

---

## Storage Accounts

| Check             | Command / Query                                                        | Healthy Threshold          |
| ----------------- | ---------------------------------------------------------------------- | -------------------------- |
| Availability      | KQL: `AzureMetrics \| where MetricName == "Availability"`              | > 99.9%                    |
| E2E latency       | KQL: `AzureMetrics \| where MetricName == "SuccessE2ELatency"`         | < 100 ms (hot), <1s (cool) |
| Throttling        | KQL: `StorageBlobLogs \| where StatusCode == 503`                      | 0 in normal operation      |
| Used capacity     | `az storage account show --name {name} --query primaryEndpoints`       | < 80% quota                |
| HTTPS enforcement | `az storage account show --name {name} --query enableHttpsTrafficOnly` | `true`                     |

---

## SQL Database

| Check               | Command / Query                                                      | Healthy Threshold    |
| ------------------- | -------------------------------------------------------------------- | -------------------- |
| DTU/vCore usage     | KQL: `AzureMetrics \| where MetricName == "dtu_consumption_percent"` | < 80% sustained      |
| Connection failures | KQL: `AzureMetrics \| where MetricName == "connection_failed"`       | < 5 per 5-min window |
| Deadlocks           | KQL: `AzureMetrics \| where MetricName == "deadlock"`                | 0                    |
| Storage usage       | KQL: `AzureMetrics \| where MetricName == "storage_percent"`         | < 85%                |
| Long queries        | `sys.dm_exec_query_stats` via Azure Portal                           | No queries > 30s     |

---

## Static Web Apps

| Check             | Command / Query                                              | Healthy Threshold      |
| ----------------- | ------------------------------------------------------------ | ---------------------- |
| Deployment status | `az staticwebapp show --name {name} --query defaultHostname` | Resolves correctly     |
| Custom domain     | `az staticwebapp hostname list --name {name}`                | SSL valid, not expired |
| Function health   | Check managed function app logs in Log Analytics             | No 5xx in API routes   |
