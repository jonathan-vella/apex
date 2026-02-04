# Operations Runbook: static-webapp-test

**Version**: 1.0
**Date**: December 17, 2025
**Environment**: Development

---

## Quick Reference

| Item            | Value                             |
| --------------- | --------------------------------- |
| Primary Region  | swedencentral                     |
| Resource Group  | rg-static-webapp-test-dev         |
| Support Contact | DevOps Team                       |
| Escalation Path | DevOps Lead → Engineering Manager |

---

## 1. Daily Operations

### 1.1 Health Checks

**Automated Monitoring** - Application Insights handles continuous monitoring.

**Manual Verification (if needed):**

```bash
# Check Static Web App status
az staticwebapp show --name stapp-static-webapp-test-dev --query "state"

# Check SQL Database status
az sql db show --server sql-staticweba-dev-{suffix} \
  --name sqldb-static-webapp-test-dev \
  --resource-group rg-static-webapp-test-dev \
  --query "status"
```

### 1.2 Log Review

**Application Insights Query - Errors in last 24h:**

```kusto
requests
| where timestamp > ago(24h)
| where success == false
| summarize count() by resultCode, bin(timestamp, 1h)
| render timechart
```

**SQL Performance Query:**

```kusto
AzureDiagnostics
| where ResourceType == "SERVERS/DATABASES"
| where TimeGenerated > ago(24h)
| summarize avg(dtu_consumption_percent_s) by bin(TimeGenerated, 1h)
```

---

## 2. Incident Response

### 2.1 Severity Definitions

| Severity | Definition           | Response Time     | Example                    |
| -------- | -------------------- | ----------------- | -------------------------- |
| Sev 1    | Complete outage      | 1 hour            | Site unreachable           |
| Sev 2    | Major feature broken | 4 hours           | Database connection failed |
| Sev 3    | Minor issue          | Next business day | Slow performance           |
| Sev 4    | Cosmetic             | Backlog           | UI alignment issue         |

---

## 3. Common Procedures

### 3.1 Common Issues & Resolutions

#### Issue: Static Web App Not Loading

**Symptoms**: 404 or 500 errors

**Resolution**:

1. Check GitHub Actions deployment status
2. Verify build succeeded in SWA portal
3. Check Application Insights for errors

```bash
# Check deployment status
az staticwebapp show --name stapp-static-webapp-test-dev \
  --query "defaultHostname"
```

#### Issue: Database Connection Errors

**Symptoms**: API returns 500 errors, connection timeouts

**Resolution**:

1. Verify SQL Server firewall allows Azure services
2. Check managed identity configuration
3. Verify connection string in SWA configuration

```bash
# Check firewall rules
az sql server firewall-rule list \
  --server sql-staticweba-dev-{suffix} \
  --resource-group rg-static-webapp-test-dev
```

#### Issue: High DTU Usage

**Symptoms**: Slow queries, timeouts

**Resolution**:

1. Check current DTU consumption in portal
2. Identify expensive queries in Query Performance Insight
3. Consider scaling to S1 (20 DTU) if sustained

```bash
# Check DTU metrics
RESOURCE_ID="/subscriptions/{sub}/resourceGroups/rg-static-webapp-test-dev"
RESOURCE_ID+="/providers/Microsoft.Sql/servers/sql-staticweba-dev-{suffix}"
RESOURCE_ID+="/databases/sqldb-static-webapp-test-dev"

az monitor metrics list \
  --resource "$RESOURCE_ID" \
  --metric "dtu_consumption_percent" \
  --interval PT1H
```

### 3.2 Scaling Procedures

#### Scale Up SQL Database

**When**: DTU consistently >80% for extended periods

```bash
# Scale from S0 to S1
az sql db update \
  --server sql-staticweba-dev-{suffix} \
  --name sqldb-static-webapp-test-dev \
  --resource-group rg-static-webapp-test-dev \
  --service-objective S1

# Cost impact: $14.52/mo → ~$30/mo
```

### 4.2 Upgrade Static Web App

**When**: Need custom domains, staging environments, or higher limits

```bash
# Upgrade to Standard tier
az staticwebapp update \
  --name stapp-static-webapp-test-dev \
  --resource-group rg-static-webapp-test-dev \
  --sku Standard

# Cost impact: $0/mo → $9/mo
```

### 3.3 Deployment Procedures

#### Standard Deployment

Deployments are **automatic via GitHub Actions** when code is pushed to main branch.

**Manual deployment (if needed):**

```bash
# Trigger deployment from CLI
az staticwebapp deploy \
  --name stapp-static-webapp-test-dev \
  --source ./build
```

#### Infrastructure Changes

```bash
# Navigate to Bicep directory
cd infra/bicep/static-webapp

# Preview changes
./deploy.ps1 -WhatIf

# Apply changes
./deploy.ps1
```

#### Rollback Procedures

**Application Rollback:**

1. Go to GitHub Actions
2. Find last successful deployment
3. Re-run the workflow

**Infrastructure Rollback:**

```bash
# Redeploy from previous known-good state
git checkout {previous-commit}
cd infra/bicep/static-webapp
./deploy.ps1
```

---

## 4. Maintenance Windows

### 4.1 Patching Schedule

| Component       | Patching                     |
| --------------- | ---------------------------- |
| Static Web App  | Automatic (Azure-managed)    |
| Azure Functions | Automatic (consumption plan) |
| SQL Database    | Automatic (Azure-managed)    |

**No manual patching required** - all services are PaaS with automatic updates.

### 4.2 Weekly Maintenance Tasks

| Task                    | Procedure                             |
| ----------------------- | ------------------------------------- |
| Review Application Logs | Check App Insights for anomalies      |
| Verify Backup Status    | Confirm SQL automated backups running |
| Check Resource Health   | Azure Portal → Resource Health        |

### 4.3 Monthly Maintenance Tasks

| Task               | Procedure                             |
| ------------------ | ------------------------------------- |
| Cost Review        | Check cost vs $50/month budget        |
| Security Updates   | Review Azure Security Center findings |
| Performance Review | Analyze DTU usage trends              |

---

## 5. Contacts & Escalation

| Role              | Contact          | Escalation     |
| ----------------- | ---------------- | -------------- |
| Primary On-Call   | DevOps Team      | Teams channel  |
| Secondary On-Call | Dev Team         | Email          |
| Management        | Engineering Lead | Direct message |

### 5.1 Useful Commands

```bash
# List all resources in the project
az resource list --resource-group rg-static-webapp-test-dev -o table

# Get Static Web App URL
az staticwebapp show --name stapp-static-webapp-test-dev --query "defaultHostname" -o tsv

# View recent Application Insights traces
az monitor app-insights query \
  --app appi-static-webapp-test-dev \
  --analytics-query "traces | take 10"

# Check SQL server connectivity
az sql db show-connection-string \
  --server sql-staticweba-dev-{suffix} \
  --name sqldb-static-webapp-test-dev \
  --client ado.net
```

---

## 6. Change Log

| Date       | Version | Author        | Change Description       |
| ---------- | ------- | ------------- | ------------------------ |
| 2025-12-17 | 1.0     | Copilot Agent | Initial runbook creation |
