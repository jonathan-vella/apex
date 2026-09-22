<!-- ref:azure-redis-v1 -->

## Azure Redis Cost Optimization

Reference guide for identifying cost savings opportunities in Azure Redis deployments through analysis and targeted scans.

## Subscription Input Options

Accept any of these identifiers to identify subscriptions for analysis:

| Input Type                 | Example                  | Use Case                          |
| -------------------------- | ------------------------ | --------------------------------- |
| **Subscription ID**        | `a1b2c3d4-...`           | Analyze specific subscription     |
| **Subscription Name**      | `Production-Environment` | User-friendly identifier          |
| **Subscription Prefix**    | `CacheTeam -`            | Analyze all team subscriptions    |
| **Tenant ID**              | `tenant-guid`            | Analyze entire organization       |
| **"All my subscriptions"** | (keyword)                | Scan all accessible subscriptions |

## Cost Optimization Rules

Treat state, age, SKU and tags as investigation signals, not deletion or savings evidence.

| Signal | Required investigation |
| --- | --- |
| Failed or long-running creation | Check deployment history, health, dependencies and owner intent |
| Premium/Enterprise or large development cache | Check peak memory, server load, connections, latency and required features |
| Old or test-tagged cache | Confirm ownership, recent usage, retention, recovery and dependency requirements |
| Missing tags | Reconcile with live governance; missing tags do not imply an unused cache |

Keep the assessment read-only. Do not infer a deletion, downgrade, safe status, or
fixed-dollar saving from any signal above. Before recommending a change, correlate
full resource ID and subscription ID with actual costs and representative utilization;
check feature compatibility, availability requirements, migration costs and owner intent.
Redis Cache and Managed Redis have different APIs/SKUs; verify the installed tool and
service contract, and report unsupported coverage instead of substituting commands.

Use the shared [cost, pricing, metrics and audit procedure](detailed-workflow-steps.md#step-4-query-actual-costs).
Unknown cost or utilization remains unknown, not zero. Label actual baseline cost,
validated target estimate and estimated saving separately, with period, currency,
region and source timestamps. Remediation requires separate explicit approval for
exact resource IDs and an implementation/recovery plan; analysis never executes it.

Sum distinct resource IDs over the same period and currency. For each evaluated
resource, estimated saving = baseline - target; retain negative savings. Sum only
non-overlapping recommendations. Total target = total baseline - total saving;
savings percentage = 100 * total saving / total baseline (undefined for a zero
baseline). If any input is missing, mark the overall estimate incomplete and show
only a labeled known subtotal. Do not annualize a partial-period actual cost without
disclosing the normalization and assumptions.

## Report Templates

### Subscription-Level Summary

Quick overview of costs and issues per subscription (use for multi-subscription scans).
See [redis-subscription-level-report.md](../templates/redis-subscription-level-report.md) for template format.

### Detailed Cache Analysis

Individual cache breakdown with specific recommendations.
See [redis-detailed-cache-analysis.md](../templates/redis-detailed-cache-analysis.md) for template format.

## Tools & Commands

**MCP Tool:** `mcp_azure-mcp_redis` with command `redis_list` (parameter: `subscription`)

**Azure CLI Equivalents:**

- `az account list` - List subscriptions
- `az redis list --subscription <id>` - List Redis caches
- `az redis show` - Get cache details
- Mutation commands belong only in a separately approved remediation plan, never an assessment scan
