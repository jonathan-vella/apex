---
title: "Budget, NFRs & Scaling"
sidebar:
  order: 4
---

## ⚡ Non-Functional Requirements (NFRs)

| WAF Pillar     | Metric             | Target                     | Current | Gap                          |
| -------------- | ------------------ | -------------------------- | ------- | ---------------------------- |
| 🔄 Reliability | SLA                | 99.9%                      | N/A     | Full build required          |
| 🔄 Reliability | RTO                | 24 hours                   | N/A     | Relaxed — acceptable for MVP |
| 🔄 Reliability | RPO                | 12 hours                   | N/A     | Relaxed — acceptable for MVP |
| ⚡ Performance | Page Load          | <3000 ms                   | N/A     | Full build required          |
| ⚡ Performance | API Response (p95) | <500 ms                    | N/A     | Full build required          |
| ⚡ Performance | Concurrent Users   | <100 (peak)                | N/A     | Full build required          |
| 🔒 Security    | Auth Method        | Entra External ID + Social | —       | —                            |
| 🔒 Security    | Encryption         | At-rest + In-transit       | —       | —                            |
| 💰 Cost        | Monthly Budget     | <€1,000                    | —       | —                            |
| 🔧 Operations  | Uptime Monitoring  | Yes                        | —       | —                            |

### Scalability

| Dimension        | Current     | 6-Month Projection | 12-Month Projection |
| ---------------- | ----------- | ------------------ | ------------------- |
| Users            | ~10,500     | ~20,000            | ~50,000             |
| Data Volume      | ~5 GB       | ~20 GB             | ~50 GB              |
| Transactions/day | ~500 orders | ~1,500 orders      | ~3,000 orders       |

## 🔧 Operational Requirements

### Monitoring & Alerting

| Capability             | Required | Tool / Service       | Notes                     |
| ---------------------- | -------- | -------------------- | ------------------------- |
| Application monitoring | ✅       | Application Insights | Request tracking, errors  |
| Log aggregation        | ✅       | Log Analytics        | Centralized log workspace |
| Alert notifications    | ✅       | Email                | CTO and operations team   |
| Custom dashboards      | ❌       | —                    | Not required for MVP      |

### Support & Maintenance

| Requirement         | Value                          |
| ------------------- | ------------------------------ |
| Support Hours       | Business hours (Stockholm CET) |
| On-call Requirement | No                             |
| Maintenance Windows | Weekends, 02:00-06:00 CET      |
| Change Management   | Team approval via GitHub PRs   |

### Backup & Disaster Recovery

| Component          | Backup Frequency | Retention | Recovery Method  |
| ------------------ | ---------------- | --------- | ---------------- |
| Azure SQL Database | Daily            | 30 days   | Automated (PITR) |
| Storage Account    | LRS replication  | 30 days   | Automated        |
| App Configuration  | IaC re-deploy    | N/A       | Bicep redeploy   |

## 🌍 Regional Preferences

| Preference         | Value         | Justification                              |
| ------------------ | ------------- | ------------------------------------------ |
| Primary Region     | swedencentral | EU GDPR-compliant, closest to Stockholm    |
| Failover Region    | N/A           | Not required — relaxed recovery objectives |
| Availability Zones | Not needed    | Cost optimization — single zone sufficient |

---

## 📊 Complexity Classification

| Field      | Value                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity | `standard`                                                                                                                                                                                                                                        |
| Criteria   | 5+ resource types (App Service, SQL, KV, Storage, App Insights, VNet, Private Endpoints, Entra External ID, Log Analytics), multi-environment (Dev + Prod), GDPR + PCI-DSS compliance pressure                                                    |
| Rationale  | Although an MVP, the workload involves PII, payment-scoped data, multiple external integrations, private networking, consumer-facing identity, and dual environments — exceeding the ≤3 resource / single-env threshold for simple classification |

---



## 💰 Budget

> [!NOTE]
> The Azure Pricing MCP server generates detailed cost estimates during
> architecture assessment (Step 2). Provide an approximate budget here.

| Field              | Value                                   |
| ------------------ | --------------------------------------- |
| 💰 Monthly Budget  | <€1,000/month (Azure platform only)     |
| 📅 Annual Budget   | ~€12,000 (Azure platform only)          |
| 🚦 Limit Type      | 🔴 Hard = startup runway constraints    |
| 📊 Cost Model Pref | Consumption — pay only for what is used |

### Budget Envelopes

| Category                | Monthly Envelope | Notes                                         |
| ----------------------- | ---------------- | --------------------------------------------- |
| Compute (App Service)   | ~€200-400        | Web + API; must support autoscale in peak     |
| Database (Azure SQL)    | ~€150-250        | Orders, inventory, users                      |
| Identity (Entra Ext ID) | ~€50-100         | MAU-based pricing for consumers               |
| Networking (PE + DNS)   | ~€50-100         | Private endpoints, private DNS zones          |
| Observability           | ~€50-100         | Log Analytics ingestion + App Insights        |
| Storage + Key Vault     | ~€20-50          | Blobs, secrets, certificates                  |
| **Total Azure**         | **<€1,000**      | Hard cap; Step 2 must validate feasibility    |
| 3rd-party SaaS          | Separate budget  | Payment gateway, maps, email/SMS — not in cap |

> [!IMPORTANT]
> Step 2 must estimate both steady-state and peak-season (3×) costs, including
> private networking overhead, log ingestion volume, and identity MAU charges.
> Third-party SaaS costs are tracked separately but must be surfaced in the
> cost estimate for total operational awareness.

### Cost Optimization Priorities

| Priority                         | Selected | Impact |
| -------------------------------- | -------- | ------ |
| Minimize compute costs           | ☑        | High   |
| Prefer consumption-based pricing | ☑        | High   |
| Reserved instances acceptable    | ☐        | Low    |
| Spot instances for non-critical  | ☐        | Low    |
