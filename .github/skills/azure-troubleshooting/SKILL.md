---
name: azure-troubleshooting
description: Azure resource troubleshooting patterns including KQL templates, metric thresholds, health checks, and remediation playbooks. Use when diagnosing unhealthy Azure resources or building diagnostic workflows.
compatibility: Requires Azure CLI with resource-graph extension
---

# Azure Troubleshooting Skill

Structured diagnostic patterns for Azure resource health assessment and
remediation. Provides KQL templates, metric baselines, severity classifications,
and per-resource-type diagnostic workflows.

---

## Quick Reference

| Capability              | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| Resource Discovery      | Azure Resource Graph queries to find and inventory resources     |
| Health Checks           | Per-resource-type diagnostic commands and metric thresholds      |
| KQL Templates           | Log Analytics queries for common failure scenarios               |
| Severity Classification | Standardised impact/urgency mapping for findings                 |
| Remediation Playbooks   | Step-by-step resolution for common issues                        |

---

## Resource Discovery via Resource Graph

Find resources before diagnosing them:

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

## Diagnostic Settings Check

Verify every resource has diagnostic settings configured:

```bash
# List resources missing diagnostic settings
az monitor diagnostic-settings list \
  --resource "$resourceId" \
  --query "[].{name:name, workspace:workspaceId}" \
  --output table
```

If no diagnostic settings exist, create them using the pattern from the
`azure-bicep-patterns` skill (Diagnostic Settings section).

---

## Per-Resource Health Checks

### App Service / Web Apps

| Check                  | Command / Query                                                          | Healthy Threshold          |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------- |
| HTTP health            | `az webapp show --name {name} --query state`                             | `Running`                  |
| Response time          | KQL: `AzureMetrics \| where MetricName == "HttpResponseTime"`            | p95 < 2 seconds            |
| HTTP 5xx rate          | KQL: `AzureMetrics \| where MetricName == "Http5xx"`                     | < 1% of total requests     |
| CPU usage              | KQL: `AzureMetrics \| where MetricName == "CpuPercentage"`              | < 80% sustained            |
| Memory usage           | KQL: `AzureMetrics \| where MetricName == "MemoryPercentage"`           | < 85% sustained            |
| App Service Plan SKU   | `az appservice plan show --name {plan} --query sku`                      | Matches architecture spec  |

```kql
// App Service error rate over last 24h
AzureMetrics
| where ResourceId contains '{appName}'
| where MetricName == 'Http5xx'
| where TimeGenerated > ago(24h)
| summarize Total5xx = sum(Total) by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

### Virtual Machines

| Check             | Command / Query                                                         | Healthy Threshold        |
| ----------------- | ----------------------------------------------------------------------- | ------------------------ |
| Power state       | `az vm get-instance-view --name {name} --query instanceView.statuses`   | `PowerState/running`     |
| CPU utilisation   | KQL: `Perf \| where ObjectName == "Processor"`                          | < 85% sustained          |
| Available memory  | KQL: `Perf \| where ObjectName == "Memory"`                             | > 20% free               |
| Disk latency      | KQL: `Perf \| where CounterName == "Avg. Disk sec/Transfer"`           | < 20 ms                  |
| Boot diagnostics  | `az vm boot-diagnostics get-boot-log --name {name}`                     | No kernel panic / errors |

```kql
// VM CPU spikes in last 6h
Perf
| where Computer == '{vmName}'
| where ObjectName == 'Processor' and CounterName == '% Processor Time'
| where TimeGenerated > ago(6h)
| summarize AvgCPU = avg(CounterValue), MaxCPU = max(CounterValue) by bin(TimeGenerated, 5m)
| where MaxCPU > 85
| order by TimeGenerated desc
```

### Storage Accounts

| Check              | Command / Query                                                          | Healthy Threshold          |
| ------------------ | ------------------------------------------------------------------------ | -------------------------- |
| Availability       | KQL: `AzureMetrics \| where MetricName == "Availability"`               | > 99.9%                    |
| E2E latency        | KQL: `AzureMetrics \| where MetricName == "SuccessE2ELatency"`          | < 100 ms (hot), <1s (cool)|
| Throttling         | KQL: `StorageBlobLogs \| where StatusCode == 503`                        | 0 in normal operation      |
| Used capacity      | `az storage account show --name {name} --query primaryEndpoints`         | < 80% quota                |
| HTTPS enforcement  | `az storage account show --name {name} --query enableHttpsTrafficOnly`   | `true`                     |

### SQL Database

| Check              | Command / Query                                                          | Healthy Threshold          |
| ------------------ | ------------------------------------------------------------------------ | -------------------------- |
| DTU/vCore usage    | KQL: `AzureMetrics \| where MetricName == "dtu_consumption_percent"`     | < 80% sustained            |
| Connection failures| KQL: `AzureMetrics \| where MetricName == "connection_failed"`           | < 5 per 5-min window       |
| Deadlocks          | KQL: `AzureMetrics \| where MetricName == "deadlock"`                    | 0                          |
| Storage usage      | KQL: `AzureMetrics \| where MetricName == "storage_percent"`             | < 85%                      |
| Long queries       | `sys.dm_exec_query_stats` via Azure Portal                               | No queries > 30s           |

### Static Web Apps

| Check              | Command / Query                                                          | Healthy Threshold          |
| ------------------ | ------------------------------------------------------------------------ | -------------------------- |
| Deployment status  | `az staticwebapp show --name {name} --query defaultHostname`             | Resolves correctly         |
| Custom domain      | `az staticwebapp hostname list --name {name}`                            | SSL valid, not expired     |
| Function health    | Check managed function app logs in Log Analytics                         | No 5xx in API routes       |

---

## Severity Classification

Classify every finding with consistent severity:

| Severity | Criteria                                                                | Response Time    |
| -------- | ----------------------------------------------------------------------- | ---------------- |
| Critical | Service down, data loss risk, security breach                           | Immediate        |
| High     | Degraded performance, failing redundancy, auth issues                   | Within 4 hours   |
| Medium   | Suboptimal configuration, missing best practices, capacity warnings     | Within 24 hours  |
| Low      | Cosmetic issues, documentation gaps, minor optimisations                | Next sprint      |

---

## Diagnostic Workflow

Follow this six-phase sequence for any resource investigation:

### Phase 1 — Discovery

```bash
# Get resource details
az resource show --ids "$resourceId" --query "{name:name, type:type, location:location, sku:sku, tags:tags}"
```

### Phase 2 — Health Assessment

Run the resource-type-specific health checks from the tables above.

### Phase 3 — Log Analysis

```kql
// Generic error search — last 24h
AzureDiagnostics
| where ResourceId contains '{resourceName}'
| where TimeGenerated > ago(24h)
| where Level == 'Error' or Level == 'Warning'
| summarize Count = count() by Level, OperationName
| order by Count desc
```

### Phase 4 — Activity Log Review

```bash
# Recent operations that may have caused issues
az monitor activity-log list \
  --resource-id "$resourceId" \
  --start-time "$(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%SZ)" \
  --query "[?status.value=='Failed'].{op:operationName.localizedValue, time:eventTimestamp, status:status.value, caller:caller}" \
  --output table
```

### Phase 5 — Classification

Rate each finding using the severity table above. Include:

- **Finding**: What is wrong
- **Severity**: Critical / High / Medium / Low
- **Evidence**: KQL query result or CLI output
- **Remediation**: Specific fix steps

### Phase 6 — Report Generation

Structure the diagnostic report as:

```markdown
## Diagnostic Report: {resource-name}

**Assessment Date**: {date}
**Assessed By**: InfraOps Diagnose Agent
**Overall Health**: 🟢 Healthy | 🟡 Degraded | 🔴 Unhealthy

### Findings Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | ...     | High     | Open   |

### Detailed Findings

#### Finding 1: {title}
...

### Recommended Actions
1. ...
```

---

## Common Remediation Playbooks

### High CPU on App Service

1. Check if autoscale is configured — if not, add scale-out rule at 70% CPU
2. Review Application Insights for slow dependencies
3. Check for synchronous blocking calls in application code
4. Consider scaling up the App Service Plan SKU

### Storage Account Throttling

1. Check current request rate against [storage scalability targets](https://learn.microsoft.com/azure/storage/common/scalability-targets-standard-account)
2. Enable CDN for read-heavy blob workloads
3. Distribute across multiple storage accounts if partition limits hit
4. Switch to Premium storage for high-IOPS requirements

### SQL Database DTU Exhaustion

1. Identify top resource-consuming queries via Query Performance Insight
2. Add missing indexes suggested by Azure SQL advisor
3. Scale up DTU tier or switch to vCore for more granular control
4. Review connection pooling settings in application

---

## Learn More

For issues not covered here, query official documentation:

| Topic                    | How to Find                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| Service-specific limits  | `microsoft_docs_search(query="{service} limits quotas")`                         |
| KQL reference            | `microsoft_docs_search(query="KQL quick reference Azure Monitor")`               |
| Metric definitions       | `microsoft_docs_search(query="{service} supported metrics Azure Monitor")`       |
| Troubleshooting guides   | `microsoft_docs_search(query="{service} troubleshoot common issues")`            |
