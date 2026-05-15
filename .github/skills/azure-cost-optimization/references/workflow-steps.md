<!-- ref:workflow-steps-v1 -->

# Workflow Steps (full instructions)

> Full step-by-step procedure for Azure cost optimization analysis.
> Loaded by `azure-cost-optimization` SKILL.md when an agent needs the
> implementation detail behind the high-level step summary.

## Step 0: Validate Prerequisites

Before starting, verify these tools and permissions are available:

**Required Tools:**

- Azure CLI installed and authenticated (`az login`)
- Azure CLI extensions: `costmanagement`, `resource-graph`
- Azure Quick Review (azqr) installed — see [Azure Quick Review](./azure-quick-review.md) for details

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

## Step 1: Load Best Practices

Get Azure cost optimization best practices to inform recommendations:

```javascript
// Use Azure MCP best practices tool
mcp_azure_mcp_get_azure_bestpractices({
  intent: "Get cost optimization best practices",
  command: "get_bestpractices",
  parameters: { resource: "cost-optimization", action: "all" },
});
```

## Step 1.5: Redis-Specific Analysis (Conditional)

**If the user specifically requests Redis cost optimization**, use the specialized Redis skill:

📋 **Reference**: [Azure Redis Cost Optimization](./azure-redis.md)

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

- [Subscription-level Redis summary](../templates/redis-subscription-level-report.md)
- [Detailed Redis cache analysis](../templates/redis-detailed-cache-analysis.md)

> **Note**: For general subscription-wide cost optimization (including Redis), continue with Step 2. For Redis-only focused analysis, follow the instructions in the Redis-specific reference document.

## Step 1.6: Choose Analysis Scope (for Redis-specific analysis)

**If performing Redis cost optimization**, ask the user to select their analysis scope:

**Prompt the user with these options:**

1. **Specific Subscription ID** — Analyze a single subscription
2. **Subscription Name** — Use display name instead of ID
3. **Subscription Prefix** — Analyze all subscriptions starting with a prefix (e.g., "CacheTeam")
4. **All My Subscriptions** — Scan all accessible subscriptions
5. **Tenant-wide** — Analyze entire organization

Wait for user response before proceeding to Step 2.

## Step 2: Run Azure Quick Review

Run azqr to find orphaned resources (immediate cost savings):

📋 **Reference**: [Azure Quick Review](./azure-quick-review.md) — Detailed instructions for running azqr scans

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

## Step 3: Discover Resources

For efficient cross-subscription resource discovery, use Azure Resource Graph. See
[Azure Resource Graph Queries](./azure-resource-graph.md) for orphaned resource detection
and cost optimization patterns.

List all resources in the subscription using Azure MCP tools or CLI:

```powershell
# Get subscription info
az account show

# List all resources
az resource list --subscription "<SUBSCRIPTION_ID>" --resource-group "<RESOURCE_GROUP>"

# Use MCP tools for specific services (preferred):
# - Storage accounts, Cosmos DB, Key Vaults: use Azure MCP tools
# - Redis caches: use mcp_azure_mcp_redis tool (see ./azure-redis.md)
# - Web apps, VMs, SQL: use az CLI commands
```

## Steps 4–9: Detailed Execution

📋 **Reference**: Read [`detailed-workflow-steps.md`](./detailed-workflow-steps.md) for cost
query execution, pricing validation, metrics collection, report generation, audit trail,
and cleanup procedures.
