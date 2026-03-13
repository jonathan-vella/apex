<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Cost Optimization Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

Use this skill when the user asks to:
- Optimize Azure costs or reduce spending
- Analyze Azure subscription for cost savings
- Generate cost optimization report
- Find orphaned or unused resources
- Rightsize Azure VMs, containers, or services
- Identify where they're overspending in Azure
- **Optimize Redis costs specifically** - See [Azure Redis Cost Optimization](./references/azure-redis.md) for Redis-specific analysis


## Instructions

Follow these steps in conversation with the user:

### Step 0: Validate Prerequisites

Before starting, verify these tools and permissions are available:

**Required Tools:**
- Azure CLI installed and authenticated (`az login`)
- Azure CLI extensions: `costmanagement`, `resource-graph`
- Azure Quick Review (azqr) installed - See [Azure Quick Review](./references/azure-quick-review.md) for details

**Required Permissions:**
- Cost Management Reader role
- Monitoring Reader role

> _See SKILL.md for full content._

## Executive Summary
- Total Monthly Cost: $X (💰 ACTUAL DATA)
- Top Cost Drivers: [List top 3 resources with Azure Portal links]


## Cost Breakdown
[Table with top 10 resources by cost, including Azure Portal links]


## Free Tier Analysis
[Resources operating within free tiers showing $0 cost]


## Orphaned Resources (Immediate Savings)
[From azqr - resources that can be deleted immediately]
- Resource name with Portal link - $X/month savings


## Optimization Recommendations

### Priority 1: High Impact, Low Risk
[Example: Delete orphaned resources]
- 💰 ACTUAL cost: $X/month
- 📊 ESTIMATED savings: $Y/month
- Commands to execute (with warnings)

### Priority 2: Medium Impact, Medium Risk
[Example: Rightsize VM from D4s_v5 to D2s_v5]
- 💰 ACTUAL baseline: D4s_v5, $X/month
- 📈 ACTUAL metrics: CPU 8%, Memory 30%
- 💵 VALIDATED pricing: D4s_v5 $Y/hr, D2s_v5 $Z/hr
- 📊 ESTIMATED savings: $S/month
- Commands to execute


> _See SKILL.md for full content._

## Total Estimated Savings
- Monthly: $X
- Annual: $Y


## Implementation Commands
[Safe commands with approval warnings]


## Validation Appendix

### Data Sources and Files
- **Cost Query Results**: `output/cost-query-result<timestamp>.json`
  - Raw cost data from Azure Cost Management API
  - Audit trail proving actual costs at report generation time
  - Keep for at least 12 months for historical comparison
  - Contains every resource's exact cost over the analysis period
- **Pricing Sources**: [Links to Azure pricing pages]
- **Free Tier Allowances**: [Applicable allowances]

> **Note**: The `temp/cost-query.json` file (if present) is a temporary query template and can be safely deleted. All permanent audit data is in the `output/` folder.
```

**Portal Link Format:**
```

> _See SKILL.md for full content._

## Output

The skill generates:
1. **Cost Optimization Report** (`output/costoptimizereport<timestamp>.md`)
   - Executive summary with total costs and top drivers
   - Detailed cost breakdown with Azure Portal links
   - Prioritized recommendations with actual data and estimated savings
   - Implementation commands with safety warnings

2. **Cost Query Results** (`output/cost-query-result<timestamp>.json`)
   - Audit trail of all cost queries and responses
   - Validation evidence for recommendations


## Important Notes

### Data Classification
- 💰 **ACTUAL DATA** = Retrieved from Azure Cost Management API
- 📈 **ACTUAL METRICS** = Retrieved from Azure Monitor
- 💵 **VALIDATED PRICING** = Retrieved from official Azure pricing pages
- 📊 **ESTIMATED SAVINGS** = Calculated based on actual data and validated pricing

### Best Practices
- Always query actual costs first - never estimate or assume
- Validate pricing from official sources - account for free tiers
- Use REST API for cost queries (more reliable than `az costmanagement query`)
- Save audit trail - include all queries and responses
- Include Azure Portal links for all resources
- Use UTF-8 encoding when creating report files
- For costs < $10/month, emphasize operational improvements over financial savings

> _See SKILL.md for full content._

## SDK Quick References

- **Redis Management**: [.NET](references/sdk/azure-resource-manager-redis-dotnet.md)

