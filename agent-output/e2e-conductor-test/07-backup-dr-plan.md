# Backup and Disaster Recovery Plan: e2e-conductor-test

**Generated**: 2026-02-06
**Version**: 1.0
**Environment**: Development
**Primary Region**: westeurope
**Secondary Region**: N/A (stateless application)

> [!NOTE]
> 📚 This document defines the backup strategy and disaster recovery procedures for e2e-conductor-test.

---

## Executive Summary

> [!IMPORTANT]
> This workload is a stateless static web application with source code stored in GitHub. Traditional backup/restore procedures are replaced with redeployment from source control.

| Metric           | Current     | Target      |
| ---------------- | ----------- | ----------- |
| **RPO**          | 24 hours    | 24 hours    |
| **RTO**          | 4 hours     | 4 hours     |
| **Availability** | 99.9%       | 99.9%       |

**Backup Strategy**: Source code in GitHub serves as the primary backup mechanism. No Azure-native backup required.

---

## 1. Recovery Objectives

### 1.1 Recovery Time Objective (RTO)

| Tier      | RTO Target | Services                  |
| --------- | ---------- | ------------------------- |
| Critical  | 4 hours    | Static Web App            |
| Important | 8 hours    | Log Analytics, Monitoring |
| Standard  | 24 hours   | Action Groups             |

**Rationale**: Test/demo workload with acceptable downtime window. Full recovery achieved by redeployment from Bicep templates.

### 1.2 Recovery Point Objective (RPO)

| Data Type     | RPO Target | Backup Strategy              |
| ------------- | ---------- | ---------------------------- |
| Static Assets | 24 hours   | GitHub source control        |
| Configuration | 1 hour     | Bicep templates in Git       |
| Logs          | 24 hours   | Log Analytics retention (90d)|

---

## 2. Backup Strategy

### 2.1 Azure Static Web App

| Setting                | Configuration                     |
| ---------------------- | --------------------------------- |
| **Backup Method**      | Source control (GitHub)           |
| **Backup Frequency**   | Continuous (Git commits)          |
| **Retention Period**   | Indefinite (Git history)          |
| **Recovery Procedure** | Redeploy from GitHub Actions      |

**Manual Backup Procedure** (if needed):

```bash
# Clone source repository
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops

# Verify latest commit
git log -1

# Backup branch: main
```

### 2.2 Infrastructure Configuration

| Setting                | Configuration                     |
| ---------------------- | --------------------------------- |
| **Backup Method**      | Bicep templates in Git            |
| **Backup Frequency**   | On every change (Git commits)     |
| **Retention Period**   | Indefinite (Git history)          |
| **Recovery Procedure** | Redeploy with Bicep CLI           |

**Manual Backup Procedure**:

```bash
# Export current configuration
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  > swa-config-backup-$(date +%Y%m%d).json

# Store in secure location or commit to Git
```

### 2.3 Log Analytics Data

| Setting                | Configuration                     |
| ---------------------- | --------------------------------- |
| **Backup Method**      | Log Analytics retention           |
| **Retention Period**   | 90 days (default Free tier)       |
| **Export Strategy**    | Not configured (test workload)    |
| **Recovery Procedure** | N/A (logs not business-critical)  |

**Optional Log Export** (for long-term retention):

```bash
# Export logs to Storage Account (if needed)
# This is not configured by default for cost optimization
```

---

## 3. Disaster Recovery Architecture

### 3.1 DR Strategy

**Approach**: Active-Passive with manual failover

**Failover Trigger**: Primary region outage > 4 hours

```
┌─────────────────────────────────────────────────────────────┐
│  Primary Region: westeurore (Active)                        │
│  - Static Web App (swa-e2e-conductor-test-dev)              │
│  - Log Analytics (log-e2e-conductor-test-dev)               │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    Regional Outage
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Secondary Region: northeurope (Manual Failover)            │
│  - Redeploy Bicep templates with parameter changes          │
│  - Update DNS/custom domain (if configured)                 │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Failover Decision Matrix

| Scenario                     | Response                         | Estimated RTO |
| ---------------------------- | -------------------------------- | ------------- |
| Static Web App outage < 1h   | Monitor Azure Service Health     | N/A           |
| Static Web App outage 1-4h   | Prepare failover plan            | 4 hours       |
| Static Web App outage > 4h   | Execute regional failover        | 4 hours       |
| Regional Azure outage        | Execute regional failover        | 4 hours       |
| Data center catastrophic failure | Execute regional failover    | 4 hours       |

---

## 4. Recovery Procedures

### 4.1 Full Infrastructure Recovery

**Scenario**: Complete region failure, need to redeploy in alternate region

**Prerequisites**:
- Azure CLI installed and authenticated
- Bicep CLI installed
- Access to Git repository
- Contributor role on target subscription

**Step-by-Step Procedure**:

```bash
# Step 1: Clone repository
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops/infra/bicep/e2e-conductor-test

# Step 2: Update region parameter (if needed)
# Edit main.bicepparam and change location to alternate region
# Example: location = 'northeurope' instead of 'westeurope'

# Step 3: Preview changes
az deployment sub what-if \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam

# Step 4: Deploy infrastructure
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --name dr-deployment-$(date +%Y%m%d-%H%M%S)

# Step 5: Verify deployment
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu \
  --query "{Name:name, Status:status, Hostname:defaultHostname}" -o table

# Step 6: Test static web app
curl -I https://[new-hostname].azurestaticapps.net

# Step 7: Update DNS (if custom domain configured)
# Update DNS CNAME record to point to new hostname

# Step 8: Notify stakeholders
echo "DR failover complete. New endpoint: [new-hostname]"
```

**Estimated Duration**: 60 minutes

### 4.2 Static Web App Restore

**Scenario**: Static Web App corrupted or deleted

```bash
# Step 1: Verify Static Web App is missing
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu

# Step 2: Redeploy from Bicep templates
cd infra/bicep/e2e-conductor-test
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam

# Step 3: Redeploy content from GitHub Actions
# Trigger GitHub Actions workflow manually or push commit

# Step 4: Verify recovery
curl -I https://victorious-sea-04f1fdb03.6.azurestaticapps.net
```

**Estimated Duration**: 30 minutes

### 4.3 Configuration Rollback

**Scenario**: Bad configuration deployed, need to rollback

```bash
# Step 1: Identify previous working commit
cd azure-agentic-infraops
git log --oneline infra/bicep/e2e-conductor-test/

# Step 2: Checkout previous version
git checkout <commit-hash> -- infra/bicep/e2e-conductor-test/

# Step 3: Redeploy
cd infra/bicep/e2e-conductor-test
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam

# Step 4: Verify rollback successful
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu
```

**Estimated Duration**: 20 minutes

---

## 5. Failover Procedures

### 5.1 Regional Failover

**Trigger**: Primary region (westeurope) outage > 4 hours

**Pre-Failover Checklist**:
- [ ] Verify Azure Service Health shows regional outage
- [ ] Confirm RTO threshold exceeded (4 hours)
- [ ] Notify stakeholders of failover decision
- [ ] Identify alternate region (recommend: northeurope)

**Failover Steps**:

```bash
# Step 1: Update Bicep parameter for alternate region
cd infra/bicep/e2e-conductor-test
# Edit main.bicepparam: location = 'northeurope'

# Step 2: Deploy to alternate region
az deployment sub create \
  --location northeurope \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --parameters location=northeurope \
  --name dr-failover-$(date +%Y%m%d-%H%M%S)

# Step 3: Verify new Static Web App
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-neu \
  --query "defaultHostname" -o tsv

# Step 4: Test application
NEW_HOSTNAME=$(az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-neu \
  --query "defaultHostname" -o tsv)
curl -I https://$NEW_HOSTNAME

# Step 5: Update DNS (if custom domain configured)
# Point CNAME to new hostname

# Step 6: Document failover
echo "Failover completed: $(date)" >> dr-failover-log.txt
```

**Estimated Duration**: 2 hours

### 5.2 Failback Procedure

**Trigger**: Primary region restored and stable for 24 hours

```bash
# Step 1: Verify primary region health
# Check Azure Service Health for westeurope

# Step 2: Redeploy to primary region
cd infra/bicep/e2e-conductor-test
az deployment sub create \
  --location swedencentral \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --parameters location=westeurope \
  --name dr-failback-$(date +%Y%m%d-%H%M%S)

# Step 3: Verify primary Static Web App
az staticwebapp show \
  --name swa-e2e-conductor-test-dev \
  --resource-group rg-e2e-conductor-test-dev-weu

# Step 4: Update DNS back to primary hostname
# Point CNAME to original hostname

# Step 5: Clean up secondary region resources
az group delete \
  --name rg-e2e-conductor-test-dev-neu \
  --yes --no-wait

# Step 6: Document failback
echo "Failback completed: $(date)" >> dr-failover-log.txt
```

**Estimated Duration**: 2 hours

---

## 6. Testing & Validation

### 6.1 DR Test Schedule

| Test Type           | Frequency  | Last Tested | Next Test  |
| ------------------- | ---------- | ----------- | ---------- |
| Configuration Backup| Monthly    | TBD         | 2026-03-01 |
| Full DR Failover    | Quarterly  | TBD         | 2026-04-01 |
| Failback Procedure  | Quarterly  | TBD         | 2026-04-01 |
| Recovery Time Test  | Annually   | TBD         | 2026-06-01 |

### 6.2 Test Scenarios

**Scenario 1: Configuration Rollback Test**
- Duration: 30 minutes
- Impact: None (test in dev environment)
- Success Criteria: Configuration rolled back to previous version within 15 minutes

**Scenario 2: Regional Failover Test**
- Duration: 2 hours
- Impact: Brief downtime during DNS cutover
- Success Criteria: Application accessible from alternate region within RTO (4 hours)

### 6.3 Validation Checklist

After DR exercise, verify:

- [ ] Static Web App accessible via HTTPS
- [ ] All static assets loading correctly
- [ ] Log Analytics receiving diagnostic logs
- [ ] Monitoring alerts configured and firing
- [ ] DNS resolution working (if custom domain)
- [ ] GitHub Actions deployment pipeline functional
- [ ] Resource tags applied correctly
- [ ] Cost within expected range

---

## 7. Communication Plan

### 7.1 Stakeholder Notification

**Pre-Failover**:
- Notify DevOps team via email
- Post status update in team chat
- Create incident ticket in tracking system

**During Failover**:
- Send progress updates every 30 minutes
- Maintain open communication channel
- Document all steps taken

**Post-Failover**:
- Send completion notification
- Document lessons learned
- Update runbooks with any improvements

### 7.2 Communication Templates

**Failover Notification Template**:

```
Subject: [DR] e2e-conductor-test Regional Failover - [START|PROGRESS|COMPLETE]

Status: IN PROGRESS
Region: westeurope → northeurope
Start Time: 2026-02-06 14:00 UTC
Estimated Completion: 2026-02-06 16:00 UTC
Impact: Static Web App temporarily unavailable

Actions Taken:
- [List steps completed]

Next Steps:
- [List pending actions]

Contact: devops-oncall@example.com
```

---

## 8. Roles & Responsibilities

| Role                | Responsibilities                          | Contact               |
| ------------------- | ----------------------------------------- | --------------------- |
| **Incident Manager**| Coordinate DR activities, stakeholder comms | devops@example.com    |
| **Infrastructure Lead** | Execute Bicep deployments, verify Azure resources | platform@example.com |
| **Application Owner**   | Verify application functionality post-failover | devops@example.com   |
| **Communication Lead**  | Send notifications, update status pages    | devops@example.com    |

---

## 9. Dependencies & External Services

### 9.1 External Dependencies

| Service       | Dependency      | DR Impact                     | Mitigation         |
| ------------- | --------------- | ----------------------------- | ------------------ |
| GitHub        | Source control  | Cannot redeploy if unavailable| Cache Git repo locally |
| Azure Portal  | Management UI   | Use Azure CLI instead         | CLI pre-configured |
| Azure AD      | Authentication  | Service Principal in use      | Pre-configured SP  |

### 9.2 Service Level Agreements

| Service             | Azure SLA | Our Target | Gap      |
| ------------------- | --------- | ---------- | -------- |
| Static Web Apps     | 99.95%    | 99.9%      | ✅ Met   |
| Log Analytics       | 99.9%     | 99.9%      | ✅ Met   |
| Action Groups       | 99.9%     | 99.9%      | ✅ Met   |

---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide additional DR guidance.

| Topic                          | Link                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| Azure Backup Best Practices    | [Overview](https://learn.microsoft.com/azure/backup/backup-architecture)                 |
| Azure Site Recovery            | [DR Guide](https://learn.microsoft.com/azure/site-recovery/site-recovery-overview)       |
| Business Continuity            | [Planning Guide](https://learn.microsoft.com/azure/reliability/business-continuity-management-program) |
| Static Web Apps Reliability    | [Best Practices](https://learn.microsoft.com/azure/static-web-apps/reliability)          |

---

_Backup and DR plan for e2e-conductor-test_
