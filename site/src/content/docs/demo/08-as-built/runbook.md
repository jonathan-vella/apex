---
title: "Operations Runbook"
description: "Day-2 operational procedures, incident response, and backup/disaster recovery plan for the Malta catering workload"
sidebar:
  order: 2
---

## Operations Runbook

**Version**: 1.0
**Date**: 2026-04-15
**Environment**: Development
**Region**: swedencentral

### Quick Reference

| Item                | Value                                             |
| ------------------- | ------------------------------------------------- |
| **Primary Region**  | `swedencentral`                                   |
| **Resource Group**  | `rg-malta-catering-dev`                           |
| **Support Contact** | `platform@example.com`                            |
| **Escalation Path** | Platform contact → workload owner → Azure support |

#### Critical Resources

| Resource            | Name                     | Resource Group          | Severity |
| ------------------- | ------------------------ | ----------------------- | -------- |
| Web front end       | `app-malta-catering-dev` | `rg-malta-catering-dev` | P1       |
| Storage persistence | `stmaltadevb6lg3l`       | `rg-malta-catering-dev` | P1       |
| Secret store        | `kv-malta-dev-b6lg3l`    | `rg-malta-catering-dev` | P2       |
| Container registry  | `acrmaltadevb6lg3l`      | `rg-malta-catering-dev` | P2       |

:::caution[Active Issue]
Post-deployment validation on 2026-04-15 returned `HTTP 503` from both the production and staging endpoints. Treat this as the active operational issue until resolved.
:::

### Daily Operations

#### Health Checks

**Morning Health Check:**

1. Confirm App Service plan state is `Running` and the production site state is `Running`.
2. Verify `curl -I` to production and staging no longer returns `503`.
3. Review Key Vault, Storage, and ACR private endpoint provisioning state.

**KQL Query — System Health Overview:**

```kusto
AppRequests
| where TimeGenerated > ago(24h)
| summarize Requests=count(), Failures=countif(Success == false), P95=percentile(DurationMs, 95) by bin(TimeGenerated, 1h)
| order by TimeGenerated desc
```

#### Log Review

**Priority Logs to Review:**

| Log Source                | Query Focus                             | Action Threshold                  |
| ------------------------- | --------------------------------------- | --------------------------------- |
| Application Insights      | Request failures and startup exceptions | Any sustained `5xx` rate above 5% |
| App Service platform logs | Container pull or startup failures      | Any failed container start        |
| Budget notifications      | Forecast threshold crossings            | Any forecast ≥ 80%                |

### Incident Response

#### Severity Definitions

| Severity | Definition                                            | Response Time  |
| -------- | ----------------------------------------------------- | -------------- |
| P1       | Customer-facing site unavailable or returning `503`   | 30 minutes     |
| P2       | Core dependency degraded but site partially available | 4 hours        |
| P3       | Non-blocking drift or documentation/config issue      | 1 business day |

#### Incident Response Flow

```mermaid
%%{init: {'theme':'neutral'}}%%
flowchart LR
    D["Detect"] --> T["Triage"]
    T --> E["Escalate"]
    E --> R["Resolve"]
    R --> P["Postmortem"]
    style D fill:#D83B01,color:#fff
    style R fill:#107C10,color:#fff
```

#### Runbooks by Alert

| Alert                       | Runbook                                               | Owner          |
| --------------------------- | ----------------------------------------------------- | -------------- |
| Production or slot `503`    | Restart + container verification                      | Platform owner |
| Image pull failure          | Registry and RBAC check                               | Platform owner |
| Key Vault reference failure | Verify secret and `Key Vault Secrets User` assignment | Platform owner |
| Budget threshold triggered  | Review spend and suppress nonessential usage          | Platform owner |

### Common Procedures

#### Restart App Service

```bash
az webapp restart -g rg-malta-catering-dev -n app-malta-catering-dev
az webapp restart -g rg-malta-catering-dev -n app-malta-catering-dev --slot staging
```

#### Scale Up/Out

```bash
az appservice plan update -g rg-malta-catering-dev -n asp-malta-catering-dev --sku P1v3
az appservice plan update -g rg-malta-catering-dev -n asp-malta-catering-dev --number-of-workers 2
```

#### Container Configuration Verification

```bash
az webapp config container show -g rg-malta-catering-dev -n app-malta-catering-dev -o json
az webapp config appsettings list -g rg-malta-catering-dev -n app-malta-catering-dev -o table
```

### Maintenance Windows

| Task                             | Schedule           | Duration |
| -------------------------------- | ------------------ | -------- |
| Workload maintenance window      | Sunday 02:00-06:00 | 4 hours  |
| Container refresh and validation | Monthly            | 1 hour   |
| DR procedure walkthrough         | Quarterly          | 2 hours  |

```mermaid
%%{init: {'theme':'neutral'}}%%
gantt
    title Maintenance Schedule
    dateFormat YYYY-MM-DD
    section Routine
        Weekly maintenance window :a1, 2026-04-19, 1d
        Monthly image refresh     :a2, 2026-05-01, 1d
    section DR
        DR walkthrough            :b1, 2026-06-01, 1d
```

:::tip
Complete slot validation before any production swap. Current staging RBAC is incomplete and should be remediated before using the slot for cutover.
:::

### Contacts & Escalation

| Role             | Contact                   | Phone | On-Call Rotation |
| ---------------- | ------------------------- | ----- | ---------------- |
| Platform Owner   | `platform@example.com`    | N/A   | Business hours   |
| Workload Owner   | Malta Catering demo owner | N/A   | Ad hoc           |
| Azure Escalation | Azure Support             | N/A   | N/A              |

#### Escalation Path

```mermaid
%%{init: {'theme':'neutral'}}%%
flowchart TD
    L1["L1: Platform Owner"] --> L2["L2: Workload Owner"]
    L2 --> L3["L3: Azure Support"]
    L3 --> MGMT["Management"]
```

---

## Backup & Disaster Recovery Plan

**Generated**: 2026-04-15
**Version**: 1.0
**Environment**: Development
**Primary Region**: swedencentral
**Secondary Region**: germanywestcentral (planned failover target only)

### Executive Summary

| Metric           | Current                    | Target   |
| ---------------- | -------------------------- | -------- |
| **RPO**          | Best-effort for order data | 12 hours |
| **RTO**          | 24 hours via IaC redeploy  | 24 hours |
| **Availability** | Single-region deployment   | 99.0%    |

### Recovery Objectives

#### Recovery Time Objective (RTO)

| Tier      | RTO Target | Services                                           |
| --------- | ---------- | -------------------------------------------------- |
| Critical  | 24 hours   | App Service plan, production site, storage account |
| Important | 24 hours   | Key Vault, ACR, private endpoints, DNS zones       |
| Standard  | 48 hours   | Monitoring workspace, Application Insights, budget |

#### Recovery Point Objective (RPO)

| Data Type                   | RPO Target            | Backup Strategy                       |
| --------------------------- | --------------------- | ------------------------------------- |
| App configuration           | Rebuild from IaC      | Bicep + parameter file + app settings |
| Key Vault secrets           | 7 days recoverability | Soft delete and purge protection      |
| Order data in Table Storage | Best-effort           | No automated export deployed          |

```mermaid
%%{init: {'theme':'neutral'}}%%
gantt
    title RPO / RTO Targets by Tier
    dateFormat HH:mm
    axisFormat %H:%M
    section Critical
        RPO :crit, rpo1, 00:00, 12h
        RTO :crit, rto1, 00:00, 24h
    section Important
        RPO :rpo2, 00:00, 7h
        RTO :rto2, 00:00, 24h
    section Standard
        RPO :rpo3, 00:00, 24h
        RTO :rto3, 00:00, 48h
```

### Backup Strategy

#### Azure Storage Account

| Setting        | Configuration                                     |
| -------------- | ------------------------------------------------- |
| Backup Type    | None deployed                                     |
| Retention      | Application-managed only                          |
| Geo-Redundancy | Not enabled (`Standard_LRS`)                      |
| Gap            | No automated Table Storage export or restore path |

#### Azure Key Vault

| Setting          | Configuration |
| ---------------- | ------------- |
| Soft Delete      | Enabled       |
| Purge Protection | Enabled       |

#### Azure Container Registry

| Setting          | Configuration                  |
| ---------------- | ------------------------------ |
| Tier             | Premium                        |
| Retention Policy | 15 days for untagged manifests |
| Geo-Redundancy   | Not configured                 |

### Disaster Recovery Procedures

#### Region Failover Procedure

1. Confirm a regional service event or unrecoverable platform issue in `swedencentral`.
2. Select `germanywestcentral` as the recovery region for an EU-hosted redeploy.
3. Re-run the Bicep deployment with region overrides and compliant resource-group tags.
4. Re-push or re-import the required container image into a recovery ACR if registry access is unavailable.
5. Reconfigure application secrets and validate container startup before exposing the site.
6. Restore order data only if an out-of-band export exists; otherwise communicate best-effort data loss.

#### Failback Procedure

1. Validate that `swedencentral` is stable again.
2. Compare recovery-region configuration and app settings with the source-controlled Bicep state.
3. Deploy the canonical workload back into the primary region.
4. Repoint DNS or user access paths to the primary region endpoint.
5. Decommission temporary recovery resources after verification.

### DR Testing Schedule

| Test Type                  | Frequency   | Last Test   | Next Test  |
| -------------------------- | ----------- | ----------- | ---------- |
| App configuration redeploy | Quarterly   | Not yet run | 2026-07-01 |
| Secret recovery validation | Quarterly   | Not yet run | 2026-07-01 |
| Full DR walkthrough        | Semi-annual | Not yet run | 2026-10-01 |

```mermaid
%%{init: {'theme':'neutral'}}%%
gantt
    title DR Testing Schedule
    dateFormat YYYY-MM-DD
    section Backup Validation
        Key Vault restore validation :a1, 2026-07-01, 1d
    section Failover
        Regional failover walkthrough :b1, 2026-10-01, 1d
    section Full DR
        Full DR exercise              :c1, 2027-01-15, 2d
```

### Communication Plan

| Audience          | Channel           | Template                                    |
| ----------------- | ----------------- | ------------------------------------------- |
| Demo stakeholders | Email / Teams     | Incident update and service restoration ETA |
| Platform owner    | Direct escalation | Technical failure summary                   |
| Management        | Escalation mail   | Business impact and recovery decision       |

### DR Roles and Responsibilities

| Role                | Team           | Responsibility                                 |
| ------------------- | -------------- | ---------------------------------------------- |
| Platform Owner      | Demo Platform  | Execute redeploy and infrastructure recovery   |
| Application Owner   | Malta Catering | Validate application behavior after recovery   |
| Stakeholder Contact | Demo sponsor   | Approve fallback decisions if data loss occurs |

### Dependencies

| Dependency                                       | Impact                                  | Mitigation                                                       |
| ------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| Container image in ACR                           | App cannot start without image pull     | Keep canonical image tagged and document import procedure        |
| Key Vault secret `appinsights-connection-string` | Missing secret breaks telemetry wiring  | Recover from Key Vault soft delete or recreate from App Insights |
| Table Storage order data                         | No automated restore path today         | Document best-effort recovery and prioritize export automation   |
| Private DNS and private endpoints                | Backend connectivity failure if missing | Redeploy network phase before compute validation                 |

### Recovery Runbooks

| Scenario                             | Runbook                                              | Owner          |
| ------------------------------------ | ---------------------------------------------------- | -------------- |
| Production endpoint returns `503`    | Restart app, verify container image and app settings | Platform Owner |
| Secret deletion or Key Vault lockout | Recover secret or rehydrate from source metadata     | Platform Owner |
| Regional outage                      | Rebuild to secondary EU region from Bicep            | Platform Owner |

#### Production 503 Recovery

**Trigger**: Production or staging endpoint returns `HTTP 503`
**Estimated Duration**: 30-60 minutes

1. Confirm App Service plan and site are in `Running` state.
2. Verify `linuxFxVersion`, ACR pull settings, and Key Vault reference app settings.
3. Restart the site and slot, then re-run the health probes.
4. If the issue persists, inspect application/container logs and validate image availability.

**Validation:**

```bash
curl -I -L --max-time 20 https://app-malta-catering-dev.azurewebsites.net
curl -I -L --max-time 20 https://app-malta-catering-dev-staging.azurewebsites.net
```
