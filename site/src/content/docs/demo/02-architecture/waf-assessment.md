---
title: "WAF Assessment"
description: "Well-Architected Framework pillar assessment for the Malta catering architecture — Security, Reliability, Performance, Cost, and Operations"
sidebar:
  order: 1
---

## Overall WAF Scores

| Pillar                    | Score | Confidence | Summary                                           |
| ------------------------- | ----- | ---------- | ------------------------------------------------- |
| 🔒 Security               | 8/10  | High       | MI + KV + TLS 1.2; VNet + private endpoints       |
| 🔄 Reliability            | 7/10  | High       | 99.95% platform SLA; always-on, no cold start     |
| ⚡ Performance            | 9/10  | High       | 1 TPS is trivial; always-on eliminates cold start |
| 💰 Cost Optimization      | 7/10  | High       | ~$126/mo; within budget, higher than consumption  |
| 🔧 Operational Excellence | 7/10  | High       | Staging slot, built-in logging; no CI/CD yet      |

**Primary Pillar Optimized**: Security

**Trade-offs Accepted**: Higher cost (~$126/mo vs ~$25/mo) for VNet + private
endpoints. No WAF, no multi-region. Data loss explicitly accepted for demo
(ARC-001). GDPR erasure pattern defined (ARC-003). Staff access via Entra ID
(ARC-005).

![WAF Pillar Scores](/demo/02-waf-scores.png)

## Security Assessment (8/10)

**Strengths:**

- Managed Identity for App Service → Key Vault and Storage (no keys in code)
- Key Vault Standard with RBAC authorization for secrets management
- TLS 1.2+ enforced on App Service (managed certificates)
- **VNet integration** with dedicated /24 address space (10.0.0.0/24)
- **Private endpoints** for Key Vault, Storage, and ACR — no public data plane exposure
- Platform-managed encryption at rest for Storage and Key Vault
- No PCI scope — payment is strictly cash on delivery
- App Service built-in auth supports social IdP (Google, Microsoft) via Easy Auth

**Gaps:**

- ⚠️ No WAF/DDoS protection — low traffic does not justify cost
- ⚠️ Social IdP data processing may cross EU boundaries (noted in REQ-002)
- ⚠️ Staff authentication requires a dedicated trust boundary (ARC-005 — see below)

### GDPR Data Erasure Pattern (ARC-003)

Table Storage entities must separate PII from order facts to support right-to-erasure:

| Partition       | Row Key     | Contains PII    | Erasure Action              |
| --------------- | ----------- | --------------- | --------------------------- |
| `customer_{id}` | `profile`   | Yes             | Delete entire entity        |
| `order_{date}`  | `{orderId}` | No (anonymized) | Retain (customer_id → hash) |

On erasure request: delete `customer_*` entities, replace `customer_id` with
a one-way hash in order entities. Orders are retained for business records
with no reversible PII.

### Staff Access Trust Boundary (ARC-005)

Staff operations (view orders, update status) must use a separate
authentication path with verified role claims:

1. Staff authenticate via Microsoft Entra ID (work accounts) —
   separate from customer social login
2. App Service built-in auth validates `roles` claim in the JWT
3. API enforces role-based access at the route level (`/api/staff/*`
   requires `Staff` role)
4. Customer routes (`/api/orders`) require only a valid social IdP token

This creates two trust boundaries: customers (social IdP, low privilege)
and staff (Entra ID, elevated privilege).

**Recommendations:**

1. Use App Service built-in authentication for social login (zero-cost)
2. ✅ Private endpoints implemented for Key Vault, Storage, and ACR
3. Document that social IdP identity tokens are processed by the IdP outside EU;
   only application data stays in swedencentral
4. ARC-004 resolved: VNet + private endpoints replace public endpoints

## Reliability Assessment (7/10)

**Strengths:**

- App Service S1 SLA: 99.95% (exceeds 99.0% target)
- Always-on eliminates cold start — consistent response times
- Staging slot enables blue-green deployments with zero-downtime swaps
- Storage Account LRS: 11 nines durability within swedencentral
- ACR Premium stores images durably with geo-redundant metadata
- Built-in health probes and auto-restart on App Service
- Single region is acceptable for dev/demo with relaxed RTO (24h)

**Gaps:**

- ❌ No automated backup for Table Storage (REQ-001/ARC-001) — **explicitly accepted for demo** (see below)
- ⚠️ No failover region configured

### ARC-001 Resolution — Table Storage Backup

**Decision**: For this dev/demo environment, data loss is **explicitly accepted**.
The 12h RPO requirement from Step 1 is **relaxed to best-effort** for the demo.
Table Storage LRS provides 11 nines durability against hardware failure but
does **not** protect against accidental deletion or application-level corruption.

**Production path**: Before promoting to production, add a scheduled Azure
Function (timer trigger, daily) that exports all Table Storage entities to
Blob Storage as JSON. Estimated additional cost: ~$1-2/month.

**Recommendations:**

1. ✅ Demo: accept data loss risk (RPO relaxed to best-effort)
2. ⚠️ Production: implement daily export job before go-live
3. ✅ Always-on enabled — no cold start concerns
4. For production: consider GRS storage or Cosmos DB for geo-redundancy

## Performance Assessment (9/10)

**Strengths:**

- 1 TPS is negligible for App Service S1 (handles thousands of TPS)
- Always-on eliminates cold start — consistent sub-second response times
- Table Storage supports 20,000 entities/second per account — 1 TPS is trivial
- React SPA delivers fast client-side rendering after initial load

**Gaps:**

- ⚠️ No CDN for static assets (acceptable for demo with < 1K users)

**Recommendations:**

1. 30-second polling interval for order status is acceptable for demo
2. For production: add Azure CDN or Front Door for static asset caching
3. ✅ Always-on eliminates cold start — no min-replicas tuning needed

## Cost Assessment (7/10)

| Metric           | Value                                     |
| ---------------- | ----------------------------------------- |
| Monthly Estimate | ~$155/month                               |
| Annual Estimate  | ~$1,858/year                              |
| Budget Status    | ✅ Within budget (25-126% of EUR 100-500) |
| Confidence       | High (App Service S1 pricing confirmed)   |

**Cost Optimization Applied:**

- App Service S1 with always-on (~$73/mo — eliminates cold starts)
- ACR Premium (~$50/mo — supports private endpoints, 500 GiB storage)
- VNet + private endpoints (~$23/mo — secures data plane traffic)
- Standard LRS storage (cheapest durable option)
- Log Analytics free tier (< 5 GiB/month ingestion)
- Key Vault per-operation pricing (negligible at low TPS)
- Staging slot included in S1 tier (zero additional cost)

Full cost breakdown available in the [Sizing & Pricing](../sizing-pricing/) page.

## Operational Excellence Assessment (7/10)

**Strengths:**

- App Service auto-configures Log Analytics integration
- Staging slot enables blue-green deployments with zero-downtime swaps
- Managed TLS certificates eliminate renewal burden
- Familiar App Service platform with extensive tooling support
- Bicep IaC ensures repeatable infrastructure

**Gaps:**

- ⚠️ No CI/CD pipeline defined (manual container pushes)
- ⚠️ No custom alerts or dashboards
- ⚠️ No runbook automation for incident response
- ⚠️ Best-effort support model (no SLA for operational response)

### ARC-002 Resolution — Application Monitoring

Application Insights is added to the architecture (free tier, 5 GiB/month).
This addresses the monitoring gap identified in the requirements:

- Application Insights provides request timing, dependency tracing, and
  application-level failure diagnostics (beyond platform logs)
- Auto-instrumentation via App Service
- Free tier (5 GiB/month) is sufficient for demo traffic
- Shares the same Log Analytics workspace as the backend

**Recommendations:**

1. Define a GitHub Actions workflow for CI/CD in a later phase
2. Add basic Azure Monitor alerts for 5xx errors and high latency
3. Document a simple operational runbook for container restart procedures
4. Configure Application Insights connection string via Key Vault
