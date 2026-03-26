---
title: "WAF Assessment"
sidebar:
  order: 1
---

## 🏛️ WAF Pillar Assessment

### Overall Scores

| Pillar                    | Score | Confidence | Summary                                                          |
| ------------------------- | ----- | ---------- | ---------------------------------------------------------------- |
| 🔒 Security               | 7/10  | High       | Strong identity + network isolation; WAF and DDoS deferred       |
| 🔄 Reliability            | 6/10  | High       | Single-region acceptable for MVP; automated backups in place     |
| ⚡ Performance            | 6/10  | Medium     | Autoscale handles 3× peak; no CDN or cache (deferred)            |
| 💰 Cost Optimization      | 8/10  | High       | 87% under budget; right-sized SKUs; consumption-based monitoring |
| 🔧 Operational Excellence | 7/10  | High       | Bicep IaC + App Insights APM; basic alerting only                |

**Primary Pillar Optimized**: 💰 Cost Optimization
**Trade-offs Accepted**: Reduced reliability (single region, no AZ) and performance (no cache/CDN) in exchange for staying well within startup budget constraints.

![WAF Pillar Scores](/azure-agentic-infraops/demo/02-waf-scores.png)

### Service Maturity Assessment

| Service              | GA Status | AVM Available | Region Support   | Notes                                              |
| -------------------- | --------- | ------------- | ---------------- | -------------------------------------------------- |
| App Service (Linux)  | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/web/site`                       |
| App Service Plan     | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/web/serverfarm`                 |
| Azure SQL Database   | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/sql/server`                     |
| Key Vault            | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/key-vault/vault`                |
| Storage Account      | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/storage/storage-account`        |
| Application Insights | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/insights/component`             |
| Log Analytics        | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/operational-insights/workspace` |
| Virtual Network      | ✅ GA     | ✅ Yes        | swedencentral ✅ | `br/public:avm/res/network/virtual-network`        |
| Private Endpoints    | ✅ GA     | N/A (inline)  | swedencentral ✅ | Configured within parent resource AVM              |
| Entra External ID    | ✅ GA     | N/A (SaaS)    | Global           | MAU-based; not IaC-provisioned                     |

---

### 🔒 Security Assessment (7/10)

**Strengths:**

- Managed Identity for all service-to-service authentication (no keys in code)
- Private Endpoints for Azure SQL and Storage Account in production with **public network access explicitly disabled** (`publicNetworkAccess: 'Disabled'` on SQL Server; `publicNetworkAccess: 'Disabled'` and default-deny firewall on Storage)
- TLS 1.2 minimum enforced on all services
- Key Vault with RBAC authorization, purge protection, and **private endpoint or firewall** (public network access restricted with trusted-services bypass)
- Microsoft Entra External ID for **consumer/restaurant identities only** (successor to Azure AD B2C); workforce/admin access via organizational Entra tenant with MFA + PIM
- HTTPS-only enforcement on App Service and Storage Account
- PCI-DSS scope minimized via **hosted payment fields / redirect tokenization** (cardholder data never reaches App Service); payment endpoint body/header logging disabled; token storage segregated in dedicated SQL table
- VNet integration for App Service outbound traffic to private resources
- Network Security Groups on data and PE subnets; private endpoint network policies enabled on PE subnet
- App Service Managed Identity with **least-privilege data-plane roles**: Key Vault Secrets User, SQL db_datareader/db_datawriter (contained user), Storage Blob Data Contributor

**GDPR Processor Compliance Matrix:**

| Processor                 | Data Location                               | Transfer Mechanism | DPA/SCC       | Article 17 Erasure                         |
| ------------------------- | ------------------------------------------- | ------------------ | ------------- | ------------------------------------------ |
| Entra External ID         | EU (tenant configured for EU data boundary) | N/A (EU-only)      | Microsoft DPA | Delete user via Graph API                  |
| Payment Gateway           | Must confirm EU processing                  | SCC if non-EU      | Required      | Token deletion; gateway manages card data  |
| Maps/Routing API          | Must confirm EU processing                  | SCC if non-EU      | Required      | Address data ephemeral (not stored)        |
| Email/SMS Provider        | Must confirm EU processing                  | SCC if non-EU      | Required      | Contact data deletion on user erasure      |
| Social Identity Providers | Must confirm EU data handling               | SCC if non-EU      | Required      | Federated auth only; profile data in Entra |

> [!WARNING]
> Each external processor MUST be validated for EU data residency before production launch. If any processor cannot confirm EU-only processing or provide an approved transfer mechanism (SCC/DPA), an alternative must be sourced.

**Gaps:**

- No WAF/Application Gateway (deferred to post-MVP; compensating control: App Service IP restrictions + rate limiting)
- No Azure DDoS Protection Standard (compensating: App Service built-in DDoS Basic)
- No Microsoft Defender for Cloud integration (recommend enabling post-MVP)
- Bot protection limited to App Service built-in basic detection
- Azure Policy compliance is **provisional** — live governance discovery required before implementation approval (Step 4)

**Recommendations:**

1. Enable Microsoft Defender for App Service and SQL post-MVP (adds ~$15/month per resource)
2. Add Azure Application Gateway with WAF v2 when user base exceeds 5,000 concurrent users
3. Configure App Service IP restrictions and rate limiting as compensating controls for MVP
4. Implement Content Security Policy headers in the web application
5. Validate all external processor DPA/SCC compliance before production launch
6. Configure Entra External ID tenant with EU data boundary; verify no telemetry or backup data leaves EU

### 🔄 Reliability Assessment (6/10)

**Strengths:**

- App Service S1 provides 99.95% SLA; **production minimum set to 2 instances** for availability during deployments and instance failures
- Azure SQL automated backups with Point-in-Time Restore (30-day retention); geo-backup available for cross-region restore
- Storage Account LRS provides 99.9% SLA with 3× local redundancy
- Relaxed RTO 24h / RPO 12h is appropriate and achievable with PITR + IaC redeploy
- Bicep IaC enables rapid environment reconstruction if needed
- **External integration resilience**: strict timeouts (5s), bounded retries with jitter (3 max), circuit breaker pattern for payment/maps/email APIs; non-critical integrations (email/SMS, maps) decoupled via async queue processing (Azure Storage Queue)
- **SLO/Error Budget model**: 99.9% = 43.8 min/month downtime budget; critical path: App Service → SQL only; non-critical (maps, email) isolated from availability budget

**Disaster Recovery Runbook (germanywestcentral):**

| Component               | Recovery Action                                                              | Est. Time      | RPO Impact            |
| ----------------------- | ---------------------------------------------------------------------------- | -------------- | --------------------- |
| App Service             | Redeploy via Bicep to failover region                                        | 2-4 hours      | None (stateless)      |
| Azure SQL               | Geo-restore from automated geo-backup                                        | 4-8 hours      | Up to 1 hour          |
| Storage Account         | Redeploy empty + restore from backup export (or switch to GRS pre-emptively) | 2-4 hours      | Up to 24 hours (LRS)  |
| Key Vault               | Redeploy via Bicep; secrets re-provisioned                                   | 1-2 hours      | None (IaC managed)    |
| DNS Cutover             | Update App Service custom domain                                             | 30 min         | N/A                   |
| **Total estimated RTO** |                                                                              | **8-16 hours** | **Within 24h target** |

> [!NOTE]
> LRS storage does not provide cross-region recovery. If storage RPO < 24h is required post-MVP, upgrade to GRS (+~$1.50/month). Current LRS is acceptable given relaxed 12h RPO for non-SQL data.

**Gaps:**

- Single region deployment (swedencentral) — no automatic failover
- No Availability Zone redundancy (cost optimization trade-off)
- No multi-region active-passive or active-active
- DR runbook requires periodic validation through tabletop and live restore drills

**Recommendations:**

1. Enable App Service Health Check probes (`/health` endpoint) with 5-check threshold for automatic unhealthy instance replacement
2. Run DR drill (tabletop) before peak season; live restore drill within 6 months of launch
3. Define reliability escalation gates: if monthly uptime < 99.9% or ≥2 incidents in 30 days → evaluate AZ redundancy; if ≥3 region incidents → evaluate multi-region
4. Plan failover to germanywestcentral region post-MVP when user base justifies the cost

### ⚡ Performance Assessment (6/10)

**Strengths:**

- App Service S1 autoscale (2→3 instances in prod; min 2 for availability) handles seasonal 3× peak load
- Target <3s page load achievable with S1 plan and co-located services in swedencentral
- Target <500ms API p95 achievable for SQL queries against S0 (10 DTU) at current transaction volume
- VNet integration keeps App Service to SQL latency under 1ms within the same region

**Gaps:**

- No CDN for static assets (product images served directly from Storage via App Service)
- No Redis Cache for inventory hot-path data (real-time stock levels)
- No read replicas for SQL Database
- Performance under sustained 3× seasonal load (1,500 orders/day) requires load testing validation — SQL S0 (10 DTU) may need upgrade to S1 (20 DTU, +~$15/month)

**Recommendations:**

1. **Mandatory pre-peak load test**: conduct load testing at projected 3× traffic before June using Azure Load Testing; validate API p95 < 500ms under sustained load
2. Configure **multi-metric autoscale**: CPU > 70% OR average response time > 2s; scheduled pre-scale to 3 instances for known peak windows (June-August, December)
3. Monitor SQL DTU utilization; upgrade to S1 (20 DTU) if sustained usage exceeds 80%
4. Implement application-level caching for inventory data (5-minute cache aligns with farm update frequency)
5. Add Azure Front Door or CDN Standard if page load times exceed 3s target after launch

### 💰 Cost Assessment (8/10)

| Service              | SKU              | Monthly Cost | Notes                                                 |
| -------------------- | ---------------- | -----------: | ----------------------------------------------------- |
| App Service Plan     | S1 (2 instances) |      $146.00 | Linux; min 2 for availability; autoscale to 3 at peak |
| Azure SQL Database   | S0 (10 DTU)      |       $14.73 | Includes 250 GB storage                               |
| Key Vault            | Standard         |        $0.00 | ~1K ops/month; effectively free                       |
| Storage Account      | Standard LRS     |        $2.25 | ~50 GB hot storage                                    |
| Application Insights | Pay-per-GB       |        $4.60 | ~2 GB/month ingestion                                 |
| Log Analytics        | Pay-per-GB       |        $0.00 | ~3 GB/month (within 5 GB free tier)                   |
| Private Endpoint ×2  | Standard         |       $14.60 | SQL + Storage; $7.30/endpoint                         |
| Private DNS Zone ×2  | Private          |        $1.00 | $0.50/zone                                            |
| **Prod Total**       |                  |  **$183.18** | Steady-state (min 2 instances)                        |
| Dev Environment      | B1 + SQL Basic   |       $20.79 | Reduced SKUs for development                          |
| **Grand Total**      |                  |  **$203.97** | Prod + Dev steady-state                               |

**Peak Season (3× autoscale)**: ~$256/month (App Service S1 × 3 instances + variable meters)

> [!NOTE]
> Peak estimate covers compute scaling only. Variable meters (SQL DTU bursting, Log Analytics ingestion spikes, Storage transactions) may add $10-30/month during sustained peaks. See the [Design cost estimate](../03-design/#cost-estimate) for p50/p90 cost bands.

**Budget Status**: $203.97 of ~$1,000 budget = **20% utilization** — well within budget with significant headroom.

**Cost Optimization Applied:**

- S1 over P1v3 saves ~$200/month while meeting performance requirements
- SQL S0 (10 DTU) over S1 (20 DTU) saves ~$15/month at current load
- Pay-per-GB monitoring over fixed commitment saves at low ingestion volumes
- Entra External ID free tier covers 50K MAU (current: ~10.5K)
- LRS over GRS saves ~$1.50/month (acceptable given relaxed DR requirements)
- B1 plan for Dev environment saves ~$60/month vs. S1

### 🔧 Operational Excellence Assessment (7/10)

**Strengths:**

- Infrastructure as Code via Bicep — fully reproducible, version-controlled deployments
- Application Insights provides request tracking, dependency mapping, error analytics
- Log Analytics centralizes logs from all Azure resources
- GitHub PR-based change management with team approval
- Automated SQL backups with PITR (30-day retention)
- Alert notifications via email to CTO and operations team
- Budget alerts at 90% threshold (€900)

**Gaps:**

- No custom operational dashboards (not required for MVP)
- No formal incident response runbooks
- No automated remediation workflows (Azure Automation)
- Basic alerting only (email) — no PagerDuty/Teams integration
- No synthetic monitoring / availability tests

**Recommendations:**

1. Configure Application Insights availability tests for key endpoints (order API, web portal)
2. Create basic alert rules for: App Service response time >3s, SQL DTU >80%, error rate >5%
3. Document incident response procedures before peak season
4. Integrate alerts with Teams channel post-MVP for faster response

---
