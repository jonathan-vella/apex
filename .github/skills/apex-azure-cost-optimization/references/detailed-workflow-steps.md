<!-- ref:detailed-workflow-steps-v1 -->

# Detailed Workflow Steps (4-9)

Steps for cost query execution, pricing validation, metrics collection, report generation, audit trail, and cleanup.

## Step 4: Query Actual Costs

Get actual cost data for the last 30 days with the ARM MCP `query_costs` tool: `from`/`to` as `YYYY-MM-DD`,
`granularity=None`, `groupBy=ResourceId`, `top=5000`, at subscription or resource-group scope. Follow the
[cost query guardrails](cost-query/guardrails.md) and label partial results.

Use the Cost Management Query API below only when `query_costs` is unavailable, as defined in the
[tool and safety guidance](tools-and-safety.md#tool-preference).

**Create cost query file (fallback):**

Create a unique run-owned scratch directory before creating the query:

```powershell
$runTemp = Join-Path ([System.IO.Path]::GetTempPath()) ("apex-cost-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $runTemp -ErrorAction Stop | Out-Null
$queryPath = Join-Path $runTemp "cost-query.json"
```

Use the file editing tool to create `$queryPath` with:

```json
{
  "type": "ActualCost",
  "timeframe": "Custom",
  "timePeriod": {
    "from": "<START_DATE>",
    "to": "<END_DATE>"
  },
  "dataset": {
    "granularity": "None",
    "aggregation": {
      "totalCost": {
        "name": "Cost",
        "function": "Sum"
      }
    },
    "grouping": [
      {
        "type": "Dimension",
        "name": "ResourceId"
      }
    ]
  }
}
```

> **Action Required**: Calculate `<START_DATE>` (30 days ago) and `<END_DATE>` (today) in ISO 8601 format (e.g., `2025-11-03T00:00:00Z`).

**Execute cost query (fallback):**

```powershell
az rest --method post `
  --url "https://management.azure.com/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>/providers/Microsoft.CostManagement/query?api-version=2023-11-01" `
  --body "@$queryPath"
```

**Important:** Save the query results to `agent-output/{project}/cost-query-result<timestamp>.json` for audit trail.

## Step 5: Validate Pricing

Validate unit prices with the ARM MCP `get_retail_prices` tool, following the
[pricing guidance](../../apex-azure-defaults/references/pricing-guidance.md). Record the query parameters and the
returned meter in the audit trail. Pricing pages such as
<https://azure.microsoft.com/pricing/details/container-apps/> are human references, not price evidence.

> **Important**: Check for free tier allowances - many Azure services have generous free limits that may explain $0 costs.

## Step 6: Collect Utilization Metrics

Query Azure Monitor for utilization data (last 14 days) to support rightsizing recommendations:

```powershell
# Calculate dates for last 14 days
$startTime = (Get-Date).AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ssZ")
$endTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

# VM CPU utilization
az monitor metrics list `
  --resource "<RESOURCE_ID>" `
  --metric "Percentage CPU" `
  --interval PT1H `
  --aggregation Average `
  --start-time $startTime `
  --end-time $endTime

# App Service Plan utilization
az monitor metrics list `
  --resource "<RESOURCE_ID>" `
  --metric "CpuTime,Requests" `
  --interval PT1H `
  --aggregation Total `
  --start-time $startTime `
  --end-time $endTime

# Storage capacity
az monitor metrics list `
  --resource "<RESOURCE_ID>" `
  --metric "UsedCapacity,BlobCount" `
  --interval PT1H `
  --aggregation Average `
  --start-time $startTime `
  --end-time $endTime
```

## Step 7: Generate Optimization Report

Create a comprehensive cost optimization report in `agent-output/{project}/`:

**Use the `create_file` tool** with path `agent-output/{project}/costoptimizereport<YYYYMMDD_HHMMSS>.md`:

**Report Structure:**

```markdown
# Azure Cost Optimization Report

**Generated**: <timestamp>

## Executive Summary

- Total Monthly Cost: $X (💰 ACTUAL DATA)
- Top Cost Drivers: [List top 3 resources with Azure Portal links]

## Cost Breakdown

[Table with top 10 resources by cost, including Azure Portal links]

## Free Tier Analysis

[Resources operating within free tiers showing $0 cost]

## Orphaned Resource Candidates

[From azqr - validate ownership, dependencies, retention and actual cost before recommending removal]

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

### Priority 3: Long-term Optimization

[Example: Reserved Instances, Storage tiering]

## Total Estimated Savings

- Monthly: $X
- Annual: $Y

## Implementation Commands

[Safe commands with approval warnings]

## Validation Appendix

### Data Sources and Files

- **Cost Query Results**: `agent-output/{project}/cost-query-result<timestamp>.json`
  - Raw cost data from Azure Cost Management API
  - Audit trail proving actual costs at report generation time
  - Keep for at least 12 months for historical comparison
  - Contains every resource's exact cost over the analysis period
- **Pricing Sources**: [Links to Azure pricing pages]
- **Free Tier Allowances**: [Applicable allowances]

> **Note**: Record the exact run-owned query path separately from permanent audit data in `agent-output/{project}/`.
```

**Portal Link Format:**

```
https://portal.azure.com/#@<TENANT_ID>/resource/subscriptions/<SUBSCRIPTION_ID>/resourceGroups/<RESOURCE_GROUP>/providers/<RESOURCE_PROVIDER>/<RESOURCE_TYPE>/<RESOURCE_NAME>/overview
```

## Step 8: Save Audit Trail

Save all cost query results for validation:

**Use the `create_file` tool** with path `agent-output/{project}/cost-query-result<YYYYMMDD_HHMMSS>.json`:

```json
{
  "timestamp": "<ISO_8601>",
  "subscription": "<SUBSCRIPTION_ID>",
  "resourceGroup": "<RESOURCE_GROUP>",
  "queries": [
    {
      "queryType": "ActualCost",
      "timeframe": "MonthToDate",
      "query": {},
      "response": {}
    }
  ]
}
```

## Step 9: Clean Up Temporary Files

Retain scratch files on success, failure, and cancellation; report the exact
`$runTemp` path to the user. Do not automatically delete any directory. Never
delete generic `temp`, shared temporary roots, pre-existing files, or report evidence.
If cleanup is separately requested, review the run's exact file manifest and
delete only those approved files with editing tools, leaving all other files intact.

> **Note**: Preserve the actual query and results in `agent-output/{project}/cost-query-result*.json` for audit purposes.
