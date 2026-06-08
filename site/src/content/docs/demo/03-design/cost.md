---
title: "Cost Estimate"
description: "Detailed Azure cost breakdown, savings opportunities, and 6-month projection for the Malta catering online ordering app"
sidebar:
  order: 2
---

**Generated**: 2026-04-14
**Region**: swedencentral
**Environment**: Development
**Architecture Reference**: [02-architecture-assessment](../../02-architecture/waf-assessment/)

## Cost At-a-Glance

> **Monthly Total: ~$154.87** | Annual: ~$1,858.44

| Metric            | Value                                                   |
| ----------------- | ------------------------------------------------------- |
| Budget            | EUR 100-500/month (soft) — Utilization: ~31% of $500    |
| Cost Trend        | ➡️ Stable (fixed App Service Plan dominates)            |
| Savings Available | 1-year RI on App Service could save ~36% on compute     |
| Compliance        | ✅ GDPR-aligned (swedencentral, EU-only data residency) |

## Decision Summary

- ✅ **Approved**: App Service S1 + ACR Premium + Table Storage LRS + Key Vault Standard + Private Endpoints + Private DNS Zones
- ⏳ **Deferred**: CDN/Front Door, CI/CD pipeline, alerting
- 🔁 **Redesign Trigger**: If traffic exceeds 10K daily users or data > 10 GiB, revisit storage tier and App Service scaling

**Confidence**: Medium | **Expected Variance**: ±15%

## Requirements → Cost Mapping

| Requirement        | Architecture Decision        | Cost Impact   | Mandatory |
| ------------------ | ---------------------------- | ------------- | --------- |
| 99.0% SLA          | App Service S1               | +$73.00/month | Yes       |
| GDPR compliance    | swedencentral region         | +$0/month     | Yes       |
| 1 TPS throughput   | App Service S1 (always-on)   | incl. above   | Yes       |
| Order persistence  | Table Storage (Standard LRS) | +$8.47/month  | Yes       |
| Secrets management | Key Vault Standard           | +$0.30/month  | Yes       |
| Image management   | ACR Premium                  | +$50.00/month | Yes       |
| Network security   | Private Endpoints (3×)       | +$21.60/month | Yes       |
| DNS resolution     | Private DNS Zones (3×)       | +$1.50/month  | Yes       |
| Monitoring         | Log Analytics (free tier)    | +$0.00/month  | No        |

## Top 5 Cost Drivers

| Rank | Resource            | Monthly Cost | % of Total | Trend | Optimization              |
| ---- | ------------------- | ------------ | ---------- | ----- | ------------------------- |
| 1    | App Service Plan S1 | $73.00       | 47.1%      | ➡️    | 1-year RI saves ~36%      |
| 2    | ACR Premium         | $50.00       | 32.3%      | ➡️    | None (fixed Premium unit) |
| 3    | Private Endpoints   | $21.60       | 13.9%      | ➡️    | Fixed cost per endpoint   |
| 4    | Storage Account     | $8.47        | 5.5%       | ➡️    | Minimize write operations |
| 5    | Private DNS Zones   | $1.50        | 1.0%       | ➡️    | Fixed cost                |

:::tip[Quick Win]
Apply a 1-year Reserved Instance to the App Service Plan S1
to save ~$26/month (~36% of compute cost).
:::

## Cost Distribution

| Category      | Monthly Cost (USD) | Share |
| ------------- | -----------------: | ----: |
| Compute       |             $73.00 | 47.1% |
| Data Services |             $58.47 | 37.7% |
| Networking    |             $23.10 | 14.9% |
| Security/Mgmt |              $0.30 |  0.2% |
| Monitoring    |              $0.00 |  0.0% |

![Monthly Cost Distribution](/demo/03-des-cost-distribution.png)

## 6-Month Cost Projection

![6-Month Cost Projection](/demo/03-des-cost-projection.png)

Projection assumes fixed App Service S1 cost with 5% monthly growth
in transaction-based services. Costs are stable as fixed compute dominates.

## Key Design Decisions Affecting Cost

| Decision               | Cost Impact   | Business Rationale                              | Status   |
| ---------------------- | ------------- | ----------------------------------------------- | -------- |
| App Service S1 plan    | +$73/month    | Always-on, staging slot, VNet integration       | Required |
| ACR Premium over Basic | +$45/month    | Private endpoint support, geo-replication ready | Required |
| Private Endpoints (3×) | +$21.60/month | Secure traffic over VNet backbone               | Required |
| Private DNS Zones (3×) | +$1.50/month  | DNS resolution for PE-connected services        | Required |
| LRS over ZRS           | -$2/month     | Single-region dev/demo                          | Required |
| No CDN/Front Door      | -$25/month    | < 1K users, demo scope                          | Optional |

## Not Paying For (Yet)

- Multi-region active-active failover
- Azure Front Door or CDN for static asset delivery (~$25+/month)
- Azure Monitor alerts and action groups
- CI/CD pipeline (GitHub Actions free tier covers it)
- WAF or DDoS Standard protection

## Cost Risk Indicators

| Resource        | Risk Level | Issue                             | Mitigation                                  |
| --------------- | ---------- | --------------------------------- | ------------------------------------------- |
| App Service S1  | 🟢 Low     | Fixed cost regardless of load     | RI commitment saves ~36%                    |
| Storage Account | 🟢 Low     | Write-heavy patterns inflate cost | Batch operations; monitor transaction count |
| Log Analytics   | 🟡 Medium  | Verbose logging exceeds 5 GiB     | Configure log levels; set daily cap         |

:::caution[Watch Item]
Log Analytics ingestion — if app service logs are verbose,
ingestion may exceed the 5 GiB free tier, adding ~$2.76/GiB.
:::

## Quick Decision Matrix

_"If you need X, expect to pay Y more"_

| Requirement           | Additional Cost | SKU Change         | Verdict    | Notes                   |
| --------------------- | --------------- | ------------------ | ---------- | ----------------------- |
| 99.9% SLA             | +$0/month       | Already covered    | 🟢 Go      | App Service S1: 99.95%  |
| Reserved Instance     | -$26/month      | 1-year RI on S1    | 🟢 Go      | 36% compute savings     |
| CDN for static assets | +$25/month      | Add Azure CDN      | 🟡 Monitor | Defer until > 1K users  |
| Multi-region failover | +$80-120/month  | Add ASP + PE in DR | 🔴 Defer   | Not needed for demo     |
| Automated backups     | +$5-10/month    | Add Azure Function | 🟡 Monitor | Address REQ-001 in prod |

## Savings Opportunities

The App Service Plan S1 is the dominant cost driver at $73.00/month (47.1%).
A **1-year Reserved Instance** commitment reduces compute cost by ~36%,
saving approximately **$26/month** ($312/year).

| Commitment  | Monthly Compute | Savings vs Pay-as-you-go |
| ----------- | --------------- | ------------------------ |
| None (PAYG) | $73.00          | —                        |
| 1-year RI   | ~$46.70         | ~36% (~$26/month)        |

Other services (ACR Premium, Private Endpoints, Storage ops, Key Vault)
are either fixed-rate or pay-per-use with no RI/SP eligibility.

## Detailed Cost Breakdown

### Assumptions

- Hours: 730 hours/month (always-on App Service Plan)
- Network egress: negligible (< 1 GiB/month, within free tier)
- Storage growth: < 1 GiB in month 1, growing to ~1 GiB over 12 months

### Line Items

| Category      | Service            | SKU / Meter                | Quantity / Units            | Est. Monthly |
| ------------- | ------------------ | -------------------------- | --------------------------- | -----------: |
| Compute       | App Service        | S1 Plan (1 vCPU, 1.75 GiB) | 730 hours/month (always-on) |       $73.00 |
| Data Services | Container Registry | Premium Registry Unit      | 30 days                     |       $50.00 |
| Networking    | Private Endpoints  | PE for Storage, KV, ACR    | 3 endpoints × $7.20         |       $21.60 |
| Data Services | Storage Account    | Table LRS Write Ops        | 260 × 10K ops (2.6M/month)  |        $8.45 |
| Data Services | Storage Account    | Hot LRS Data Stored (Blob) | 1 GiB-month                 |        $0.02 |
| Networking    | Private DNS Zones  | 3 zones (blob, vault, acr) | 3 zones × $0.50             |        $1.50 |
| Security/Mgmt | Key Vault          | Standard Operations        | 10 × 10K ops (100K/month)   |        $0.30 |
| Monitoring    | Log Analytics      | Data Ingestion (free tier) | 1 GiB/month (< 5 GiB free)  |        $0.00 |
| **Total**     |                    |                            |                             |  **$154.87** |

:::note
All prices sourced from Azure Pricing MCP (`pricing_get` with swedencentral filters).
1-year RI on App Service Plan could reduce total to ~$128.87/month.
:::
