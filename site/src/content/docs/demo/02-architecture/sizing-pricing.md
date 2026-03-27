---
title: "Sizing & Pricing"
sidebar:
  order: 2
---

## 📦 Resource SKU Recommendations

| Service              | Recommended SKU | Configuration                      | Monthly Est. | Justification                                                      |
| -------------------- | --------------- | ---------------------------------- | -----------: | ------------------------------------------------------------------ |
| App Service Plan     | S1              | Linux, 2 instances, autoscale 2→3  |      $146.00 | Min 2 instances for availability; autoscale to 3 for seasonal peak |
| App Service          | S1 (on plan)    | VNet integration, HTTPS-only, MI   |            — | Web + API on single app; VNet for PE access                        |
| Azure SQL Database   | S0 (10 DTU)     | TLS 1.2, Azure AD auth, geo-backup |       $14.73 | 500 orders/day, <100 concurrent; upgrade path to S1 if needed      |
| Key Vault            | Standard        | RBAC auth, purge protection        |        $0.00 | Low operation count; Standard tier sufficient                      |
| Storage Account      | Standard LRS    | HTTPS-only, no public blob, MI     |        $2.25 | Product images, assets; 50 GB initial                              |
| Application Insights | Pay-per-GB      | Connected to App Service           |        $4.60 | 2 GB/month ingestion; workspace-based                              |
| Log Analytics        | Pay-per-GB      | 30-day retention                   |        $0.00 | 3 GB/month within 5 GB free tier                                   |
| Virtual Network      | Standard        | 3 subnets (app, data, PE)          |         Free | Network isolation for private endpoints                            |
| Private Endpoint     | Standard (×2)   | SQL + Storage                      |       $14.60 | GDPR/PCI compliance; no public data access                         |
| Private DNS Zone     | Private (×2)    | SQL + Storage privatelink zones    |        $1.00 | PE name resolution                                                 |

| Tier | vCPU | RAM     | Price/mo | Autoscale | Fits?                  |
| ---- | ---- | ------- | -------: | --------- | ---------------------- |
| B1   | 1    | 1.75 GB |   $13.14 | ❌ No     | ❌ No autoscale for 3× |
| S1   | 1    | 1.75 GB |   $73.00 | ✅ Yes    | ✅ Selected            |
| P1v3 | 2    | 8 GB    |    ~$138 | ✅ Yes    | ⚠️ Over-spec for MVP   |

**Selected**: S1 — minimum tier with autoscale support; required for seasonal 3× peak handling. B1 used for Dev environment only.

| Tier  | DTU | Storage | Price/mo | Fits?                       |
| ----- | --- | ------- | -------: | --------------------------- |
| Basic | 5   | 2 GB    |    $4.90 | ❌ Too limited for joins    |
| S0    | 10  | 250 GB  |   $14.73 | ✅ Selected                 |
| S1    | 20  | 250 GB  |     ~$30 | ⚠️ Upgrade path if DTU >80% |

**Selected**: S0 — adequate for <100 concurrent users and ~500 orders/day; Basic reserved for Dev environment. Monitor DTU; upgrade to S1 at sustained >80%.

---
