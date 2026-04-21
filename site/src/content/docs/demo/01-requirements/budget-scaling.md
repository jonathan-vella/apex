---
title: "Budget, NFRs & Scaling"
description: "Non-functional requirements, budget envelope, operational requirements, regional preferences, and complexity classification"
sidebar:
  order: 4
---

## Non-Functional Requirements

| WAF Pillar     | Metric             | Target                                       | Current | Gap |
| -------------- | ------------------ | -------------------------------------------- | ------- | --- |
| 🔄 Reliability | SLA                | 99.0%                                        | N/A     | —   |
| 🔄 Reliability | RTO                | 24 hours                                     | N/A     | —   |
| 🔄 Reliability | RPO                | 12 hours                                     | N/A     | —   |
| ⚡ Performance | Page Load          | < 3,000 ms                                   | N/A     | —   |
| ⚡ Performance | API Response (p95) | < 500 ms                                     | N/A     | —   |
| ⚡ Performance | Concurrent Users   | 100-1,000                                    | N/A     | —   |
| ⚡ Performance | Throughput         | 1 TPS                                        | N/A     | —   |
| 🔒 Security    | Auth Method        | Social IdP (OAuth 2.0)                       | —       | —   |
| 🔒 Security    | Encryption         | TLS 1.2 in-transit; platform-managed at-rest | —       | —   |
| 💰 Cost        | Monthly Budget     | EUR 100-500                                  | —       | —   |
| 🔧 Operations  | Uptime Monitoring  | Yes (basic)                                  | —       | —   |

### Scalability

| Dimension        | Current   | 6-Month Projection | 12-Month Projection |
| ---------------- | --------- | ------------------ | ------------------- |
| Users            | 100-1,000 | 1,000              | 2,000               |
| Data Volume      | < 100 MB  | 500 MB             | 1 GB                |
| Transactions/day | ~86,400   | ~100,000           | ~150,000            |

## Budget

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Monthly Budget  | EUR 100-500                                                |
| Annual Budget   | EUR 1,200-6,000                                            |
| Limit Type      | Soft (can negotiate within range)                          |
| Cost Model Pref | Fixed (App Service S1 always-on) + consumption for storage |

### Cost Optimization Priorities

| Priority                         | Selected | Impact |
| -------------------------------- | -------- | ------ |
| Minimize compute costs           | ☑        | High   |
| Prefer consumption-based pricing | ☑        | High   |
| Reserved instances acceptable    | ☐        | Low    |
| Spot instances for non-critical  | ☐        | Low    |

## Operational Requirements

### Monitoring & Alerting

| Capability             | Required | Tool / Service       | Notes                   |
| ---------------------- | -------- | -------------------- | ----------------------- |
| Application monitoring | ✅       | Application Insights | Basic telemetry         |
| Log aggregation        | ✅       | Log Analytics        | App Service auto-config |
| Alert notifications    | ❌       | —                    | Not required for demo   |
| Custom dashboards      | ❌       | —                    | Not required for demo   |

### Support & Maintenance

| Requirement         | Value              |
| ------------------- | ------------------ |
| Support Hours       | Best-effort        |
| On-call Requirement | No                 |
| Maintenance Windows | Any time (dev env) |
| Change Management   | Self-service       |

### Backup & Disaster Recovery

| Component          | Backup Frequency | Retention | Recovery Method |
| ------------------ | ---------------- | --------- | --------------- |
| Table Storage data | Daily            | 30 days   | Manual restore  |
| Container images   | On push to ACR   | Latest 5  | Re-deploy       |

## Regional Preferences

| Preference         | Value         | Justification                      |
| ------------------ | ------------- | ---------------------------------- |
| Primary Region     | swedencentral | EU GDPR-compliant, project default |
| Failover Region    | N/A           | Not required for dev/demo          |
| Availability Zones | Not needed    | 99.0% SLA target; single zone OK   |

## Complexity Classification

| Field      | Value                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Complexity | `simple`                                                                                                              |
| Criteria   | 7+ resource types (App Service, ACR, VNet, Private Endpoints, Storage, Key Vault, DNS Zones), single region, dev only |
| Rationale  | Small outlet, single environment, no custom policies, straightforward SPA + API                                       |
