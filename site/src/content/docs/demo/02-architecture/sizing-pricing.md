---
title: "Sizing & Pricing"
description: "Resource SKU recommendations, pricing tier comparisons, and top architecture risks for the Malta catering app"
sidebar:
  order: 2
---

## Resource SKU Recommendations

| Service            | Recommended SKU    | Configuration                  | Monthly Est. | Justification                                |
| ------------------ | ------------------ | ------------------------------ | ------------ | -------------------------------------------- |
| Virtual Network    | Standard           | 10.0.0.0/24, 2 subnets         | $0.00        | Included (no per-VNet charge)                |
| App Service Plan   | S1                 | Linux, always-on               | $73.00       | Always-on, staging slot, VNet integration    |
| Web App            | S1 Linux container | Managed identity, staging slot | Included     | Included in App Service Plan                 |
| Container Registry | Premium            | 500 GiB storage, PE            | $50.00       | Private endpoint support, sufficient storage |
| Storage Account    | Standard LRS GPv2  | Table + Blob, PE               | $8.47        | Cheapest durable option                      |
| Key Vault          | Standard           | RBAC auth, PE                  | $0.30        | Per-operation, negligible cost               |
| Private DNS Zones  | Standard           | 3 zones (KV, Storage, ACR)     | $1.50        | Required for PE name resolution              |
| Private Endpoints  | Standard           | 3 endpoints                    | $21.60       | Secures KV, Storage, ACR traffic             |
| Log Analytics      | Per-GB (free tier) | < 5 GiB/month                  | $0.00        | Free tier covers demo volume                 |
| **Total**          |                    |                                | **~$155/mo** |                                              |

## Pricing Tier Comparisons

### App Service Plan

| Tier | vCPU | RAM      | Price/mo | VNet | Staging Slot | Fits? |
| ---- | ---- | -------- | -------- | ---- | ------------ | ----- |
| B1   | 1    | 1.75 GiB | ~$13     | ❌   | ❌           | ❌    |
| S1   | 1    | 1.75 GiB | ~$73     | ✅   | ✅           | ✅    |
| P1v3 | 2    | 8 GiB    | ~$138    | ✅   | ✅           | ⚠️    |

**Selected**: S1 — VNet integration + staging slot at lowest cost. Resolves
ACA capacity blocker in swedencentral.

### Container Registry

| Tier     | Storage | Throughput  | Price/mo | PE Support | Fits? |
| -------- | ------- | ----------- | -------- | ---------- | ----- |
| Basic    | 10 GiB  | 2 webhooks  | $5.00    | ❌         | ❌    |
| Standard | 100 GiB | 10 webhooks | $21.00   | ❌         | ❌    |
| Premium  | 500 GiB | Geo-rep     | $50.00   | ✅         | ✅    |

**Selected**: Premium — required for private endpoint support.

### Storage Account

| Redundancy | Durability     | Price/GB/mo | Fits? |
| ---------- | -------------- | ----------- | ----- |
| LRS        | 11 nines local | $0.0184     | ✅    |
| ZRS        | 12 nines zonal | $0.023      | ⚠️    |
| GRS        | 16 nines geo   | $0.034      | ❌    |

**Selected**: LRS — cheapest; single region is acceptable for dev/demo.
EU-only requirement satisfied (no cross-region replication).

## Top Architecture Risks

| Risk                               | WAF Pillar     | Likelihood | Impact    | Mitigation                                          |
| ---------------------------------- | -------------- | ---------- | --------- | --------------------------------------------------- |
| Table Storage data loss            | 🔄 Reliability | 🟢 Low     | 🟡 Medium | LRS durability; prod: add export job                |
| Higher cost (~$155/mo vs ~$25/mo)  | 💰 Cost        | 🟢 Low     | 🟢 Low    | Within budget; trade-off for security + reliability |
| Social IdP token processing in US  | 🔒 Security    | 🟡 Medium  | 🟢 Low    | App data stays in EU; document assumption           |
| No CI/CD increases deployment risk | 🔧 Operations  | 🟡 Medium  | 🟢 Low    | Staging slot reduces risk; add GitHub Actions later |
