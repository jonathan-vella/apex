---
description: "Standards for Azure cost estimate documentation with architecture and business context"
applyTo: "**/03-des-cost-estimate.md, **/07-ab-cost-estimate.md, **/docs/*-cost-estimate.md"
---

# Azure Cost Estimate Documentation Standards

## Document Purpose

Cost estimates provide:

- Financial clarity for budget approvals
- Architecture context linking cost to design decisions
- Optimization guidance for reducing costs
- Fast decisions via "what changes cost" tables

## General Requirements

- Keep markdown lines <= 120 characters.
- Use ATX headings (`##`, `###`) for sections.
- Use emoji callouts consistently (see "Visual Standards").
- Prefer tables for compare-and-decide content.
- If the workload is small, keep the same sections but shorten them.

## Canonical Templates (Golden Source)

The canonical cost-estimate structure is defined in these templates:

- `.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md` (design estimate)
- `.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md` (as-built estimate)

Agents MUST start from the appropriate template and fill it in.
Do not re-embed long templates in agent bodies.

### Core Heading Contract (Stable)

Both templates MUST contain these exact H2 headings (`##`) in this order:

1. `## 💰 Cost At-a-Glance`
2. `## ✅ Decision Summary`
3. `## 🔁 Requirements → Cost Mapping`
4. `## 📊 Top 5 Cost Drivers`
5. `## Architecture Overview`
6. `## 🧾 What We Are Not Paying For (Yet)`
7. `## ⚠️ Cost Risk Indicators`
8. `## 🎯 Quick Decision Matrix`
9. `## 💰 Savings Opportunities`
10. `## Detailed Cost Breakdown`

Notes:

- Emoji + spacing must match exactly.
- Use the unicode arrow `→` (not `->`) in the Requirements heading.
- Additional H2 headings are allowed, but discouraged (prefer H3s).

## Required Header

```markdown
# Azure Cost Estimate: {Project Name}

**Generated**: {YYYY-MM-DD}
**Region**: {primary-region}
**Environment**: {Production|Staging|Development}
**MCP Tools Used**: {azure_price_search, azure_cost_estimate, azure_bulk_estimate, azure_region_recommend, azure_sku_discovery}
**Architecture Reference**: {relative link to assessment doc, if available}
```

## 💰 Cost At-a-Glance (Required)

Include immediately after the header:

````markdown
## 💰 Cost At-a-Glance

> **Monthly Total: ~$X,XXX** | Annual: ~$XX,XXX
>
> ```
> Budget: $X/month (soft|hard) | Utilization: NN% ($X of $X)
> ```
>
> | Status            | Indicator                    |
> | ----------------- | ---------------------------- |
> | Cost Trend        | ➡️ Stable                    |
> | Savings Available | 💰 $X/year with reservations |
> | Compliance        | ✅ {e.g., PCI-DSS aligned}   |
````

If no budget is provided, use:

- `Budget: No fixed budget (explain in one sentence)`

## ✅ Decision Summary (Required)

Immediately after "Cost At-a-Glance", include a 2-3 bullet decision summary:

- What's approved now
- What's deferred (intentionally not paying for yet)
- What requirement change would trigger a redesign

Also include a confidence line:

```markdown
**Confidence**: High|Medium|Low | **Expected Variance**: ±X% (1 sentence why)
```

## Visual Standards

### Status Indicators

| Status         | Indicator | Usage                                 |
| -------------- | --------- | ------------------------------------- |
| Under budget   | ✅        | < 80% utilized                        |
| Near budget    | ⚠️        | 80-100% utilized                      |
| Over budget    | ❌        | > 100% utilized                       |
| Recommendation | 💡        | Optimization suggestions              |
| Savings        | 💰        | Money saved                           |
| High risk      | 🔴        | Potential to materially increase cost |
| Medium risk    | 🟡        | Could increase cost under growth      |
| Low risk       | 🟢        | Predictable                           |

### Category Icons

| Category            | Emoji |
| ------------------- | ----- |
| Compute             | 💻    |
| Data Services       | 💾    |
| Networking          | 🌐    |
| Messaging           | 📨    |
| Security/Management | 🔐    |

### Trend Indicators

- ➡️ Stable
- 📈 Increasing
- 📉 Decreasing
- ⚠️ Volatile/unknown

## Required Sections (Recommended Order)

### 1. ✅ Decision Summary

```markdown
## ✅ Decision Summary

- ✅ Approved: {what is in-scope and funded}
- ⏳ Deferred: {what is explicitly not included yet}
- 🔁 Redesign Trigger: {what requirement change forces SKU/region redesign}

**Confidence**: High|Medium|Low | **Expected Variance**: ±X% (1 sentence why)
```

### 2. 🔁 Requirements → Cost Mapping

Map business requirements and NFRs to concrete SKU decisions.

```markdown
## 🔁 Requirements → Cost Mapping

| Requirement | Architecture Decision | Cost Impact  | Mandatory |
| ----------- | --------------------- | ------------ | --------- |
| SLA 99.9%   | Use {service/SKU}     | +$X/month 📈 | Yes       |
| RTO/RPO     | {backup/DR choice}    | +$X/month    | No        |
| Compliance  | {WAF/PE/CMK choice}   | +$X/month 📈 | Yes       |
```

### 3. 📊 Top 5 Cost Drivers

```markdown
## 📊 Top 5 Cost Drivers

| Rank | Resource | Monthly Cost | % of Total | Trend |
| ---- | -------- | ------------ | ---------- | ----- |
| 1️⃣   | ...      | $...         | ...        | ➡️    |

> 💡 **Quick Win**: One low-effort action that saves meaningful cost
```

### 4. Summary

```markdown
## Summary

| Metric              | Value             |
| ------------------- | ----------------- |
| 💵 Monthly Estimate | $X - $Y           |
| 📅 Annual Estimate  | $X - $Y           |
| 🌍 Primary Region   | swedencentral     |
| 💳 Pricing Type     | List Price (PAYG) |
| ⭐ WAF Score        | X.X/10 (or TBD)   |
| 🎯 Target Users     | N concurrent      |
```

Add a short "Business Context" narrative (2-5 lines) linking spend to outcomes.

### 5. Architecture Overview

Include both subsections:

1. Cost distribution (table + optional generated image)
2. Key design decisions affecting cost

Cost distribution is required for all workloads. Preferred format is a markdown table.
Optional: include a generated chart image (PNG/SVG) when available.

```markdown
## Architecture Overview

### Cost Distribution

| Category         | Monthly Cost (USD) | Share |
| ---------------- | -----------------: | ----: |
| 💻 Compute       |                535 |   39% |
| 💾 Data Services |                466 |   34% |
| 🌐 Networking    |                376 |   27% |

![Monthly Cost Distribution](./03-des-cost-distribution.png)
```

### Key Design Decisions Affecting Cost

| Decision | Cost Impact    | Business Rationale | Status   |
| -------- | -------------- | ------------------ | -------- |
| ...      | +$.../month 📈 | ...                | Required |

````

### 6. 🧾 What We Are Not Paying For (Yet)

Make trade-offs explicit so stakeholders see conscious deferrals.

```markdown
## 🧾 What We Are Not Paying For (Yet)

> Examples: multi-region active-active, private endpoints for all services, premium HA cache, DDoS Standard
```

### 7. ⚠️ Cost Risk Indicators

```markdown
## ⚠️ Cost Risk Indicators

| Resource | Risk Level | Issue | Mitigation |
| -------- | ---------- | ----- | ---------- |
| ... | 🔴 High | ... | ... |

> **⚠️ Watch Item**: One sentence on the biggest budget uncertainty
````

### 8. 🎯 Quick Decision Matrix

```markdown
## 🎯 Quick Decision Matrix

_"If you need X, expect to pay Y more"_

| Requirement | Additional Cost | SKU Change | Notes |
| ----------- | --------------- | ---------- | ----- |
| ...         | +$.../month     | ...        | ...   |
```

### 9. 🧩 Change Control (Top 3 Change Requests)

Standardize the 3 most likely changes and their delta.

```markdown
## 🧩 Change Control

| Change Request      | Delta     | Notes                |
| ------------------- | --------- | -------------------- |
| Add multi-region DR | +$X/month | From decision matrix |
| Add WAF             | +$X/month | From decision matrix |
| Upgrade DB tier     | +$X/month | From decision matrix |
```

### 10. 💰 Savings Opportunities

Always include a savings section.
If already optimized, say so and list what is already applied.

```markdown
## 💰 Savings Opportunities

> ### Total Potential Savings: $X/year
>
> | Commitment | Monthly Savings | Annual Savings |
> | ---------- | --------------- | -------------- |
> | 1-Year ... | $...            | $...           |

### Additional Optimization Strategies

| Strategy | Potential Savings | Effort | Notes |
| -------- | ----------------- | ------ | ----- |
| ...      | ...               | 🟢 Low | ...   |
```

### 11. Detailed Cost Breakdown

Break down by category, include subtotals.

```markdown
## Detailed Cost Breakdown

### 💻 Compute Services

| Resource | SKU | Qty | $/Hour | $/Month | Notes |
| -------- | --- | --- | ------ | ------- | ----- |

**💻 Compute Subtotal**: ~$X/month
```

### 12. 📋 Monthly Cost Summary

Include:

- A category summary table
- An ASCII bar distribution (simple, readable)

### 13. 🧮 Base Run Cost vs Growth-Variable Cost

Make variance drivers explicit.

```markdown
## 🧮 Base Run Cost vs Growth-Variable Cost

| Cost Type       | Drivers     | Examples                   | How It Scales                 |
| --------------- | ----------- | -------------------------- | ----------------------------- |
| Base run        | fixed SKUs  | App Service plan, SQL tier | step-changes (SKU upgrades)   |
| Growth-variable | usage-based | egress, logs, queries      | linear/near-linear with usage |
```

### 14. 🌍 Regional Comparison

Include the primary region and at least one alternative.
Add one sentence explaining why the primary was chosen.

### 15. 🔧 Environment Strategy (FinOps)

Explicitly state prod vs non-prod sizing rules and whether non-prod auto-shutdown is used.

```markdown
## 🔧 Environment Strategy (FinOps)

- Production: {HA/zone strategy, baseline capacity}
- Non-prod: {smaller SKUs, single instance, auto-shutdown schedule}
```

### 16. 🔄 Environment Cost Comparison

If there are multiple environments (prod/staging/dev), include the table.
If single environment, include a short table and state "single environment".

### 17. 🛡️ Cost Guardrails

Tie the estimate to operational enforcement.

```markdown
## 🛡️ Cost Guardrails

| Guardrail      | Threshold   | Action                   |
| -------------- | ----------- | ------------------------ |
| Budget alert   | 80% / 100%  | Notify / block approvals |
| DB utilization | >80%        | Review tier/queries      |
| Log ingestion  | >X GB/day   | Tune sampling/retention  |
| Egress         | >X GB/month | Investigate CDN/traffic  |
```

### 18. 📝 Testable Assumptions

List 3-5 assumptions most likely to change spend, and how to measure them.

```markdown
## 📝 Testable Assumptions

| Assumption         | Why It Matters             | How to Measure            | Threshold / Trigger |
| ------------------ | -------------------------- | ------------------------- | ------------------- |
| Egress < 100 GB/mo | keeps networking costs low | Azure Cost Mgmt + metrics | >100 GB/mo          |
| Logs < 5 GB/mo     | avoids ingestion costs     | Log Analytics usage       | >5 GB/mo            |
```

### 19. 📊 Pricing Data Accuracy

Required bullets:

- Usage basis (e.g., 730 hours/month)
- Pricing type (PAYG list price unless otherwise stated)
- Data/egress assumptions
- Prices queried date

### 19. 📊 Pricing Data Accuracy

```markdown
## 📊 Pricing Data Accuracy

> **📊 Data Source**: Prices retrieved from Azure Retail Prices API via Azure Pricing MCP
>
> ✅ **Included**: Retail list prices (PAYG)
>
> ❌ **Not Included**: EA discounts, CSP pricing, negotiated rates, Azure Hybrid Benefit
>
> 💡 For official quotes, validate with Azure Pricing Calculator
```

### 20. 🔗 References

Always include links to:

- Azure Pricing Calculator
- Azure Retail Prices API
- Any assessment/plan/docs used

## Pricing Sources (Priority Order)

1. Azure Pricing MCP (`azure_price_search`, `azure_cost_estimate`, `azure_bulk_estimate`)
2. Azure Pricing Calculator (manual validation)
3. Azure Retail Prices API (programmatic)

## Patterns to Avoid

| Anti-Pattern           | Solution                                           |
| ---------------------- | -------------------------------------------------- |
| Missing cost drivers   | Include top 5 drivers table                        |
| Missing assumptions    | Document usage and pricing basis                   |
| No "what changes cost" | Include the decision matrix                        |
| No risk callouts       | Include cost risk indicators + a watch item        |
| No savings section     | Always include savings and what is already applied |
| Stale prices           | Note query date; re-validate periodically          |
| Missing change control | Include top 3 likely change requests + delta       |
| Hidden trade-offs      | Add "What we are not paying for (yet)"             |
| Unclear variance       | Add confidence, variance, base vs variable split   |
