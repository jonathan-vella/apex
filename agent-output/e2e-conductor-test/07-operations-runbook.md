# Operations Runbook: e2e-conductor-test

**Version**: 1.0
**Date**: 2026-02-06
**Environment**: Development
**Region**: westeurope

> [!NOTE]
> 📚 This runbook provides day-to-day operational procedures for the e2e-conductor-test workload.

---

## Quick Reference

| Item                | Value                                |
| ------------------- | ------------------------------------ |
| **Primary Region**  | westeurope                           |
| **Resource Group**  | rg-e2e-conductor-test-dev-weu        |
| **Support Contact** | devops-team@example.com              |
| **Escalation Path** | Team Lead → Platform Engineering     |

### Critical Resources

| Resource                | Name                        | Resource Group                |
| ----------------------- | --------------------------- | ----------------------------- |
| Static Web App          | swa-e2e-conductor-test-dev  | rg-e2e-conductor-test-dev-weu |
| Log Analytics Workspace | log-e2e-conductor-test-dev  | rg-e2e-conductor-test-dev-weu |
| Action Group            | ag-e2e-conductor-test-dev   | rg-e2e-conductor-test-dev-weu |

---

## 1. Daily Operations

### 1.1 Health Checks

**Morning Health Check:**

1. ✅ Verify Static Web App is responding (HTTP 200)
2. ✅ Check Log Analytics ingestion (logs appearing)
3. ✅ Review any alert notifications from past 24 hours

**Quick Health Validation:**

```bash
# Test Static Web App accessibility
curl -I https://victorious-sea-04f1fdb03.6.azurestaticapps.net

# Check resource status
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --query "{Name:name, Status:status}" -o table
```

**KQL Query - System Health Overview:**

```kusto
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.WEB"
| where TimeGenerated > ago(24h)
| summarize 
    TotalRequests = count(),
    ErrorCount = countif(sc_status_s >= "400"),
    AvgDuration = avg(time_taken_d)
  by bin(TimeGenerated, 1h)
| project TimeGenerated, TotalRequests, ErrorCount, AvgDuration
| order by TimeGenerated desc
```

### 1.2 Log Review

**Priority Logs to Review:**

```kusto
// HTTP errors in last 24 hours
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.WEB"
| where sc_status_s >= "400"
| where TimeGenerated > ago(24h)
| project TimeGenerated, sc_status_s, cs_uri_stem_s, cs_host_s
| order by TimeGenerated desc
| take 50
```

---

## 2. Incident Response

### 2.1 Severity Definitions

| Severity | Description                  | Response Time | Escalation          |
| -------- | ---------------------------- | ------------- | ------------------- |
| **P1**   | Complete service outage      | 15 minutes    | Immediate           |
| **P2**   | Degraded performance         | 1 hour        | After 2 hours       |
| **P3**   | Non-critical issue           | 4 hours       | Next business day   |
| **P4**   | Cosmetic/documentation       | Best effort   | None                |

### 2.2 Common Issues

#### Issue: Static Web App Not Responding

**Symptoms**: HTTP 503 errors, site unreachable

**Diagnosis**:

```bash
# Check Static Web App status
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --query "status" -o tsv

# Check recent deployments
az staticwebapp list-functions \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu
```

**Resolution**:
1. Check Azure Service Health for platform issues
2. Review recent GitHub Actions deployments
3. Redeploy from GitHub Actions if needed
4. Contact Azure Support for platform incidents

#### Issue: Slow Response Times

**Symptoms**: Page load time > 2 seconds

**Diagnosis**:

```kusto
// Response time analysis
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.WEB"
| where TimeGenerated > ago(1h)
| summarize 
    AvgDuration = avg(time_taken_d),
    P95Duration = percentile(time_taken_d, 95),
    P99Duration = percentile(time_taken_d, 99)
  by bin(TimeGenerated, 5m)
| order by TimeGenerated desc
```

**Resolution**:
1. Check for large static assets (compress images, minify CSS/JS)
2. Verify cache-control headers configured correctly
3. Review Static Web App performance metrics in Azure Portal

#### Issue: Alert Fatigue

**Symptoms**: Too many low-priority alerts

**Resolution**:

```bash
# Adjust alert threshold
az monitor metrics alert update \
  --name swa-health-alert \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --evaluation-frequency 5m \
  --window-size 15m
```

---

## 3. Common Operational Procedures

### 3.1 Restart Static Web App

**When to Use**: After configuration changes or troubleshooting

```bash
# Note: Static Web Apps don't require manual restarts
# Changes take effect automatically on next deployment
echo "Static Web Apps are serverless - no restart needed"
```

### 3.2 Scale Static Web App

**When to Use**: Increased traffic expected

```bash
# Note: Free tier auto-scales automatically
# To upgrade to Standard tier for more capacity:
az staticwebapp update \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --sku Standard
```

### 3.3 Review Deployment History

```bash
# List recent Static Web App deployments
az staticwebapp environment list \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  -o table
```

### 3.4 Update Custom Domain (Future)

```bash
# Add custom domain (when needed)
az staticwebapp hostname set \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --hostname www.example.com
```

### 3.5 Review Log Analytics Costs

```kusto
// Log ingestion volume by day
Usage
| where TimeGenerated > ago(30d)
| where DataType == "AzureDiagnostics"
| summarize DataVolumeGB = sum(Quantity) / 1024 by bin(TimeGenerated, 1d)
| order by TimeGenerated desc
```

### 3.6 Export Static Web App Configuration

```bash
# Export resource configuration for backup
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  > swa-config-backup-$(date +%Y%m%d).json
```

### 3.7 Validate Monitoring Alerts

```bash
# Test alert notification
az monitor metrics alert update \
  --name swa-health-alert \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --description "Test alert - $(date)"
```

---

## 4. Maintenance Windows

### 4.1 Scheduled Maintenance

**Monthly Tasks** (First Monday of month):
- Review log retention settings
- Validate backup/restore procedures (source code in GitHub)
- Review cost trends in Azure Cost Management
- Update documentation with any configuration changes

**Quarterly Tasks** (First week of quarter):
- Review Azure Service Health advisories
- Validate DR procedures (test redeployment)
- Review RBAC permissions
- Update runbook procedures

### 4.2 Patching Strategy

**Static Web App**: Automatically patched by Azure (serverless)
**Log Analytics**: Automatically updated by Azure

No customer-managed patching required.

---

## 5. Monitoring & Alerting

### 5.1 Key Performance Indicators

| Metric               | Target    | Alert Threshold | Action              |
| -------------------- | --------- | --------------- | ------------------- |
| Availability         | 99.9%     | < 99%           | Page DevOps team    |
| Response Time (P95)  | < 100ms   | > 500ms         | Investigate         |
| Error Rate           | < 0.1%    | > 1%            | Investigate         |
| Log Ingestion Volume | < 5 GB/mo | > 8 GB/mo       | Review retention    |

### 5.2 Alert Rules Configured

| Alert Name          | Condition                  | Severity | Action Group             |
| ------------------- | -------------------------- | -------- | ------------------------ |
| swa-health-alert    | Availability < 99%         | High     | ag-e2e-conductor-test-dev|

### 5.3 Dashboard Links

- **Azure Portal**: [Resource Group](https://portal.azure.com/#@/resource/subscriptions/YOUR-SUB-ID/resourceGroups/rg-e2e-conductor-test-dev-weu)
- **Static Web App**: [Portal Link](https://portal.azure.com/#@/resource/subscriptions/YOUR-SUB-ID/resourceGroups/rg-e2e-conductor-test-dev-weu/providers/Microsoft.Web/staticSites/swa-e2e-conductor-test-dev)
- **Log Analytics**: [Logs View](https://portal.azure.com/#@/resource/subscriptions/YOUR-SUB-ID/resourceGroups/rg-e2e-conductor-test-dev-weu/providers/Microsoft.OperationalInsights/workspaces/log-e2e-conductor-test-dev/logs)

---

## 6. Contact Information

### On-Call Schedule

| Role               | Primary Contact         | Backup Contact       |
| ------------------ | ----------------------- | -------------------- |
| DevOps Engineer    | devops@example.com      | platform@example.com |
| Platform Engineer  | platform@example.com    | architecture@example.com |

### Escalation Matrix

1. **L1 Support**: DevOps Team (respond within 15 minutes for P1)
2. **L2 Support**: Platform Engineering (escalate after 1 hour)
3. **L3 Support**: Azure Support (vendor escalation for platform issues)

---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide additional operational guidance.

| Topic                          | Link                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Static Web Apps Operations     | [Management Guide](https://learn.microsoft.com/azure/static-web-apps/apis)               |
| Azure Monitor KQL Reference    | [Query Language](https://learn.microsoft.com/azure/data-explorer/kusto/query/)           |
| Troubleshooting Guide          | [Common Issues](https://learn.microsoft.com/azure/static-web-apps/troubleshooting)       |
| Log Analytics Best Practices   | [Query Optimization](https://learn.microsoft.com/azure/azure-monitor/logs/query-optimization) |

---

_Operations runbook for e2e-conductor-test_
