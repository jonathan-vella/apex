---
name: azure-cost-optimization
description: "Identify and quantify cost savings across Azure subscriptions by analyzing actual costs, utilization metrics, and generating actionable optimization recommendations. USE FOR: optimize Azure costs, reduce Azure spending, reduce Azure expenses, analyze Azure costs, find cost savings, generate cost optimization report, find orphaned resources, rightsize VMs, cost analysis, reduce waste, Azure spending analysis, find unused resources, optimize Redis costs. DO NOT USE FOR: deploying resources (use azure-deploy), general Azure diagnostics (use azure-diagnostics), security issues (use azure-security)"
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Cost Optimization Skill

Analyze Azure subscriptions to identify cost savings through orphaned resource cleanup, rightsizing, and optimization recommendations based on actual usage data.

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
- Reader role on subscription/resource group

**Verification commands:**

```powershell
az --version
az account show
az extension show --name costmanagement
azqr version
```

### Step 1: Load Best Practices

Get Azure cost optimization best practices to inform recommendations:

```javascript
// Use Azure MCP best practices tool
mcp_azure_mcp_get_azure_bestpractices({
  intent: "Get cost optimization best practices",
  command: "get_bestpractices",
  parameters: { resource: "cost-optimization", action: "all" },
});
```

### Step 1.5: Redis-Specific Analysis (Conditional)

**If the user specifically requests Redis cost optimization**, use the specialized Redis skill:

📋 **Reference**: [Azure Redis Cost Optimization](./references/azure-redis.md)

**When to use Redis-specific analysis:**

- User mentions "Redis", "Azure Cache for Redis", or "Azure Managed Redis"
- Focus is on Redis resource optimization, not general subscription analysis
- User wants Redis-specific recommendations (SKU downgrade, failed caches, etc.)

**Key capabilities:**

- Interactive subscription filtering (prefix, ID, or "all subscriptions")
- Redis-specific optimization rules (failed caches, oversized tiers, missing tags)
- Pre-built report templates for Redis cost analysis
- Uses `redis_list` command

**Report templates available:**

- [Subscription-level Redis summary](./templates/redis-subscription-level-report.md)
- [Detailed Redis cache analysis](./templates/redis-detailed-cache-analysis.md)

> **Note**: For general subscription-wide cost optimization (including Redis), continue with Step 2. For Redis-only focused analysis, follow the instructions in the Redis-specific reference document.

### Step 1.6: Choose Analysis Scope (for Redis-specific analysis)

**If performing Redis cost optimization**, ask the user to select their analysis scope:

**Prompt the user with these options:**

1. **Specific Subscription ID** - Analyze a single subscription
2. **Subscription Name** - Use display name instead of ID
3. **Subscription Prefix** - Analyze all subscriptions starting with a prefix (e.g., "CacheTeam")
4. **All My Subscriptions** - Scan all accessible subscriptions
5. **Tenant-wide** - Analyze entire organization

Wait for user response before proceeding to Step 2.

### Step 2: Run Azure Quick Review

Run azqr to find orphaned resources (immediate cost savings):

📋 **Reference**: [Azure Quick Review](./references/azure-quick-review.md) - Detailed instructions for running azqr scans

```javascript
// Use Azure MCP extension_azqr tool
extension_azqr({
  subscription: "<SUBSCRIPTION_ID>",
  "resource-group": "<RESOURCE_GROUP>", // optional
});
```

**What to look for in azqr results:**

- Orphaned resources: unattached disks, unused NICs, idle NAT gateways
- Over-provisioned resources: excessive retention periods, oversized SKUs
- Missing cost tags: resources without proper cost allocation

> **Note**: The Azure Quick Review reference document includes instructions for creating filter configurations, saving output to the `output/` folder, and interpreting results for cost optimization.

### Step 3: Discover Resources

For efficient cross-subscription resource discovery, use Azure Resource Graph. See [Azure Resource Graph Queries](references/azure-resource-graph.md) for orphaned resource detection and cost optimization patterns.

List all resources in the subscription using Azure MCP tools or CLI:

```powershell
# Get subscription info
az account show

# List all resources
az resource list --subscription "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>"

# Use MCP tools for specific services (preferred):
# - Storage accounts, Cosmos DB, Key Vaults: use Azure MCP tools
# - Redis caches: use mcp_azure_mcp_redis tool (see ./references/azure-redis.md)
# - Web apps, VMs, SQL: use az CLI commands
```

### Steps 4-9: Detailed Execution

📋 **Reference**: Read `references/detailed-workflow-steps.md` for cost query execution, pricing validation, metrics collection, report generation, audit trail, and cleanup procedures.

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
