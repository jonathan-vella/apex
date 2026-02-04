# Backup & Disaster Recovery Plan: static-webapp-test

**Version**: 1.0
**Date**: December 17, 2025
**Environment**: Development
**Last Tested**: N/A (new deployment)

---

## Executive Summary

| Metric               | Target    | Current Capability |
| -------------------- | --------- | ------------------ |
| **RTO**              | 4 hours   | ✅ Achievable      |
| **RPO**              | 1 hour    | ✅ Achievable      |
| **Backup Frequency** | Automatic | Daily + hourly     |
| **Geographic Scope** | Single    | swedencentral      |

---

## 1. Recovery Objectives

### 1.1 Recovery Time Objective (RTO)

| Tier     | RTO Target | Services               |
| -------- | ---------- | ---------------------- |
| Critical | 4 hours    | Full application       |
| Standard | 8 hours    | Non-critical functions |

### 1.2 Recovery Point Objective (RPO)

| Data Type        | RPO Target | Backup Strategy   |
| ---------------- | ---------- | ----------------- |
| SQL Database     | 1 hour     | Automated backup  |
| Application Code | Minutes    | GitHub repository |

---

## 2. Backup Strategy

### 2.1 Backup Overview

| Component        | Backup Method          | Frequency  | Retention | RPO     |
| ---------------- | ---------------------- | ---------- | --------- | ------- |
| SQL Database     | Azure automated backup | Continuous | 7 days    | 1 hour  |
| Application Code | GitHub repository      | On commit  | Unlimited | Minutes |
| Infrastructure   | Bicep templates (IaC)  | On commit  | Unlimited | Minutes |
| Static Content   | Built from source      | On deploy  | Unlimited | Minutes |

### 2.2 SQL Database Backup Details

| Setting                 | Value                                 |
| ----------------------- | ------------------------------------- |
| Backup Type             | Full + Differential + Transaction Log |
| Full Backup             | Weekly                                |
| Differential Backup     | Every 12-24 hours                     |
| Transaction Log Backup  | Every 5-10 minutes                    |
| Point-in-Time Retention | 7 days (Basic tier default)           |
| Geo-Redundant Backup    | No (single region deployment)         |

### 2.3 Backup Verification

**Monthly Verification Procedure:**

```bash
# List available restore points
az sql db list-restore-points \
  --server sql-staticweba-dev-{suffix} \
  --name sqldb-static-webapp-test-dev \
  --resource-group rg-static-webapp-test-dev
```

---

## 3. Disaster Recovery Procedures

### 3.1 Scenario: Database Corruption or Data Loss

**RTO**: 1-2 hours | **RPO**: Up to 1 hour

**Procedure:**

1. **Identify restore point**

   ```bash
   az sql db list-restore-points \
     --server sql-staticweba-dev-{suffix} \
     --name sqldb-static-webapp-test-dev \
     --resource-group rg-static-webapp-test-dev
   ```

2. **Restore to new database**

   ```bash
   az sql db restore \
     --dest-name sqldb-static-webapp-test-dev-restored \
     --server sql-staticweba-dev-{suffix} \
     --resource-group rg-static-webapp-test-dev \
     --name sqldb-static-webapp-test-dev \
     --time "2025-12-17T10:00:00Z"
   ```

3. **Verify restored data**
   - Connect to restored database
   - Validate data integrity
   - Run application tests

4. **Switch application to restored database**
   - Update connection string in SWA configuration
   - Or rename databases

5. **Clean up**
   - Delete corrupted database (after verification)

### 3.2 Scenario: Application Deployment Failure

**RTO**: 30 minutes | **RPO**: Minutes

**Procedure:**

1. **Identify last working deployment**
   - Check GitHub Actions history
   - Find last successful build

2. **Rollback deployment**
   - Go to GitHub Actions
   - Select last successful workflow run
   - Click "Re-run all jobs"

3. **Verify application**
   - Test application functionality
   - Check Application Insights for errors

### 3.3 Scenario: Infrastructure Failure (Full Region Outage))

**RTO**: 4 hours | **RPO**: 1 hour

**Procedure:**

1. **Assess impact**
   - Confirm regional outage via Azure Status
   - Determine expected recovery time

2. **Decision point**
   - If Azure recovery expected < 4 hours: Wait
   - If longer: Proceed with manual recovery

3. **Manual recovery to alternate region**

   ```bash
   # Update Bicep parameters for new region
   # Create new resource group
   az group create --name rg-static-webapp-test-dev \
     --location germanywestcentral

   # Deploy infrastructure
   cd infra/bicep/static-webapp
   ./deploy.ps1 -Environment dev -Location germanywestcentral

   # Restore database from geo-backup (if available)
   # Note: Basic tier doesn't support geo-restore
   # Would need to restore from local backups
   ```

4. **Update DNS/redirects**
   - Update any custom domain records
   - Notify users of new endpoint

### 3.4 Disaster Recovery Architecture

#### 3.4.1 Current Architecture (Single Region)

```
┌─────────────────────────────────────────┐
│           swedencentral                 │
│  ┌─────────────────────────────────┐   │
│  │    Static Web App (Free)         │   │
│  │    + Azure Functions             │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │    SQL Database (S0)             │   │
│  │    - Automated backups (7 days)  │   │
│  │    - No geo-redundancy           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

#### 3.4.2 Recommended Production Architecture (If Upgraded)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  swedencentral (Primary)         germanywestcentral (DR)       │
│  ┌──────────────────┐           ┌──────────────────┐          │
│  │  Static Web App  │           │  (Deploy on-demand)│          │
│  │  SQL Database    │ ═══════▶  │  from IaC          │          │
│  │  (Geo-redundant) │  backups  │                    │          │
│  └──────────────────┘           └──────────────────┘          │
│                                                                │
└────────────────────────────────────────────────────────────────┘

---

## 4. Testing Schedule

### 4.1 Service Dependencies

| Dependency   | Failure Impact             | Mitigation             |
| ------------ | -------------------------- | ---------------------- |
| Azure AD     | No authentication          | N/A (Azure-wide issue) |
| GitHub       | No deployments             | Local source available |
| SQL Database | Application non-functional | Restore from backup    |
| Azure Region | Full outage                | Manual DR (4h RTO)     |

---

## 5. Communication Plan

| Event                 | Notify           | Method         |
| --------------------- | ---------------- | -------------- |
| Planned maintenance   | All users        | Email (24h)    |
| Unplanned outage      | DevOps team      | Teams alert    |
| Extended outage (>1h) | Management       | Direct message |
| DR activation         | All stakeholders | Email + Teams  |

---

## 6. Roles and Responsibilities

| Test Type             | Frequency | Last Performed | Next Scheduled |
| --------------------- | --------- | -------------- | -------------- |
| Backup verification   | Monthly   | N/A            | January 2026   |
| Point-in-time restore | Quarterly | N/A            | March 2026     |
| Full DR drill         | Annually  | N/A            | December 2026  |

### 6.1 Backup Verification Checklist

- [ ] Confirm SQL backups are running
- [ ] Verify point-in-time restore points available
- [ ] Test restore to temporary database
- [ ] Validate data integrity
- [ ] Document any issues

### 6.2 DR Test Checklist

- [ ] Document current configuration
- [ ] Simulate failure scenario
- [ ] Execute recovery procedures
- [ ] Measure actual RTO/RPO
- [ ] Update procedures based on findings
- [ ] File test report

---

## 7. Dependencies

| Dependency   | Failure Impact             | Mitigation             |
| ------------ | -------------------------- | ---------------------- |
| Azure AD     | No authentication          | N/A (Azure-wide issue) |
| GitHub       | No deployments             | Local source available |
| SQL Database | Application non-functional | Restore from backup    |
| Azure Region | Full outage                | Manual DR (4h RTO)     |

---

## 8. Recovery Runbooks

| Runbook              | Location    | Owner       |
| -------------------- | ----------- | ----------- |
| Database restore     | Section 3.1 | DevOps Team |
| Application rollback | Section 3.2 | DevOps Team |
| Full region failover | Section 3.3 | DevOps Lead |

---

## 9. Appendix

### 9.1 Contact Information

| Role           | Contact       | Responsibility              |
| -------------- | ------------- | --------------------------- |
| DR Coordinator | DevOps Lead   | DR decision authority       |
| Technical Lead | DevOps Team   | Execute recovery procedures |
| Business Owner | Product Owner | User communication          |
| Escalation     | Eng Manager   | Resource allocation         |

### 9.2 Related Documents

- [Operations Runbook](./07-operations-runbook.md)
- [Design Document](./07-design-document.md)
- [Resource Inventory](./07-resource-inventory.md)
```
