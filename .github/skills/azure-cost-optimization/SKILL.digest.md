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

📋 **Reference**: Read `references/best-practices-notes.md` for data classification labels, best practices, common pitfalls, and safety requirements.

## SDK Quick References

- **Redis Management**: [.NET](references/sdk/azure-resource-manager-redis-dotnet.md)

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                               | When to Load                                                      |
| --------------------------------------- | ----------------------------------------------------------------- |
| `references/auth-best-practices.md`     | Auth Best Practices                                               |
| `references/azure-quick-review.md`      | Azure Quick Review                                                |
| `references/azure-redis.md`             | Azure Redis                                                       |
| `references/azure-resource-graph.md`    | Azure Resource Graph                                              |
| `references/detailed-workflow-steps.md` | Steps 4-9: cost queries, pricing, metrics, report, audit, cleanup |
| `references/best-practices-notes.md`    | Data classification, best practices, pitfalls, safety             |
