<!-- ref:cost-estimate-sections-v1 -->

# Cost Estimate — Section Templates

Full templates and examples for `cost-estimate-standards.md`.
Rules and enforcement live in the instruction file.

## Required Header Template

```markdown
# Azure Cost Estimate: {Project Name}

**Generated**: {YYYY-MM-DD}
**Region**: {primary-region}
**Environment**: {Production|Staging|Development}
**MCP Tools Used**: {azure_price_search, azure_cost_estimate,
azure_bulk_estimate, azure_region_recommend, azure_sku_discovery}
**Architecture Reference**: {relative link to assessment doc}
```

## Cost At-a-Glance Template

Include immediately after the header:

````markdown
## 💵 Cost At-a-Glance

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

If no budget: `Budget: No fixed budget (explain in one sentence)`

## Decision Summary Template

Immediately after Cost At-a-Glance, include 2-3 bullet summary:

- What's approved now
- What's deferred (intentionally not paying for yet)
- What requirement change would trigger a redesign

Include a confidence line:

```markdown
**Confidence**: High|Medium|Low
**Expected Variance**: ±X% (1 sentence why)
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

## Required Section Templates

### 1. ✅ Decision Summary

```markdown
## ✅ Decision Summary

- ✅ Approved: {what is in-scope and funded}
- ⏳ Deferred: {what is explicitly not included yet}
- 🔁 Redesign Trigger: {what change forces SKU/region redesign}

**Confidence**: High|Medium|Low
**Expected Variance**: ±X% (1 sentence why)
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

> 💡 **Quick Win**: One low-effort action that saves cost
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

Add a short "Business Context" narrative (2-5 lines).

### 5. Architecture Overview

Include both subsections:

1. Cost distribution (table + optional image)
2. Key design decisions affecting cost

```markdown
## 🏛️ Architecture Overview

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

### 6. 🧾 What We Are Not Paying For (Yet)

Make trade-offs explicit so stakeholders see conscious deferrals.

```markdown
## 🧾 What We Are Not Paying For (Yet)

> Examples: multi-region active-active, private endpoints for all
> services, premium HA cache, DDoS Standard
```

### 7. ⚠️ Cost Risk Indicators

```markdown
## ⚠️ Cost Risk Indicators

| Resource | Risk Level | Issue | Mitigation |
| -------- | ---------- | ----- | ---------- |
| ...      | 🔴 High    | ...   | ...        |

> **⚠️ Watch Item**: One sentence on biggest budget uncertainty
```

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

Always include a savings section. Use one of three states:

**State 1 — Quantified**: When RI/SP pricing was queried via MCP tools, show actual dollar savings.
**State 2 — Not Quantified**: When the pricing run focused on baseline consumption only, say so and list eligible strategies with prerequisites.
**State 3 — Not Applicable**: When all services are consumption/serverless with no commitment discount eligibility.

> [!CAUTION]
> **Never show `$0.00` savings rows.** Zero-dollar rows imply the platform found no opportunities when the real state is "not evaluated." Use State 2 ("Not Quantified in This Run") instead.

```markdown
## 💰 Savings Opportunities

<!-- STATE 1: Quantified -->

> ### Total Potential Savings: $X/year
>
> | Strategy | Commitment | Monthly Savings | Annual Savings | % Reduction |
> | -------- | ---------- | --------------- | -------------- | ----------- |
> | RI       | 1-year     | $...            | $...           | X%          |

<!-- STATE 2: Not Quantified -->

> ### Savings: Not Quantified in This Run
>
> This estimate covers baseline consumption pricing only.
>
> **Eligible strategies to evaluate**:
>
> | Strategy | Applicability | Prerequisites |
> | -------- | ------------- | ------------- |
> | RI       | ✅ / ❌       | {condition}   |

<!-- STATE 3: Not Applicable -->

> ### Savings: Not Applicable
>
> {Explain why — e.g., consumption-only pricing}
```

### Additional Optimization Strategies

| Strategy | Potential Savings | Effort | Notes |
| -------- | ----------------- | ------ | ----- |
| ...      | ...               | 🟢 Low | ...   |

### 11. Detailed Cost Breakdown

Break down by category, include subtotals.

```markdown
## 🧾 Detailed Cost Breakdown

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

| Cost Type       | Drivers     | Examples         | How It Scales           |
| --------------- | ----------- | ---------------- | ----------------------- |
| Base run        | fixed SKUs  | App Service, SQL | step-changes (upgrades) |
| Growth-variable | usage-based | egress, logs     | linear with usage       |
```

### 14. 🌍 Regional Comparison

Include the primary region and at least one alternative.
Add one sentence explaining why the primary was chosen.

### 15. 🔧 Environment Strategy (FinOps)

Explicitly state prod vs non-prod sizing and auto-shutdown.

```markdown
## 🔧 Environment Strategy (FinOps)

- Production: {HA/zone strategy, baseline capacity}
- Non-prod: {smaller SKUs, single instance, auto-shutdown}
```

### 16. 🔄 Environment Cost Comparison

If multiple environments, include the table.
If single environment, state "single environment".

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

List 3-5 assumptions most likely to change spend.

```markdown
## 📝 Testable Assumptions

| Assumption     | Why It Matters     | How to Measure    | Threshold  |
| -------------- | ------------------ | ----------------- | ---------- |
| Egress < 100GB | keeps costs low    | Cost Mgmt+metrics | >100 GB/mo |
| Logs < 5 GB/mo | avoids ingestion $ | LA usage          | >5 GB/mo   |
```

### 19. 📊 Pricing Data Accuracy

Required bullets:

- Usage basis (e.g., 730 hours/month)
- Pricing type (PAYG list price unless otherwise stated)
- Data/egress assumptions
- Prices queried date

```markdown
## 📊 Pricing Data Accuracy

> **📊 Data Source**: Prices from Azure Retail Prices API via
> Azure Pricing MCP
>
> ✅ **Included**: Retail list prices (PAYG)
>
> ❌ **Not Included**: EA discounts, CSP pricing, negotiated
> rates, Azure Hybrid Benefit
>
> 💡 For official quotes, validate with Azure Pricing Calculator
```

### 20. 🔗 References

Always include links to:

- Azure Pricing Calculator
- Azure Retail Prices API
- Any assessment/plan/docs used
