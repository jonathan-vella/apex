<!-- ref:tools-and-safety-v1 -->

# Cost Tool and Safety Guidance

Adapted from upstream `azure-cost` (`cost-analysis/references/tools-and-safety.md`,
with the `cost-estimation` fallback rows).

## Tool preference

Use the Cost Management Query and Forecast REST APIs (`az rest`) for actual cost, forecast, and
benefit operations; public retail prices use Azure MCP `pricing_get` (with the Azure Retail Prices
API as fallback). For Resource Graph, use the generate, validate, execute sequence.

Use an already authenticated Azure CLI (`az rest`), Azure PowerShell (`Invoke-AzRestMethod`), or
native CLI command when it exposes the required fields. Do not retry or switch interfaces to
bypass invalid input, denied access, throttling, or empty data.

| Workflow | Primary Tool / API | Fallback API |
|---|---|---|
| Historical cost | Cost Management Query API (`az rest`) | `Invoke-AzRestMethod` |
| Existing-scope forecast | Cost Management Forecast API (`az rest`) | `Invoke-AzRestMethod` |
| AKS cost | Cost Management Query API (`az rest`) | `Invoke-AzRestMethod` |
| Public SKU or meter price | Azure MCP `pricing_get` | Azure Retail Prices API |
| Negotiated rates | Cost Management Price Sheet API (`az rest`) | `Invoke-AzRestMethod` |
| Resource inventory or changes | Azure Resource Graph (`az graph query`) | Resource Graph REST API |
| Utilization metrics | Azure Monitor Metrics (`az monitor metrics list`) | Azure Monitor Metrics API |

Preserve the workflow's scope, period, row limits, pagination, currency, and
evidence labels. State which tool or API was used. Never expose access tokens or
pricesheet URLs. Write any `az rest` request body to the run-owned scratch
directory from [Step 4](detailed-workflow-steps.md#step-4-query-actual-costs),
never to a shared `temp/` folder.

Prefer server-side grouping, filtering, and sorting in the Cost Management request body or
Resource Graph query rather than fetching unbounded datasets to aggregate locally.

## Evidence labels

These refine the [data classification labels](best-practices-notes.md#data-classification).

| Label | Meaning |
|-------|---------|
| Actual cost | Returned by Cost Management for the selected scope and period. |
| Actual metric | Returned by Azure Monitor or Kubernetes metrics. |
| Retail price | Returned by official Azure retail pricing. |
| Negotiated price | Returned from the user's pricesheet. |
| Estimate | Calculated from stated assumptions. |

Follow Resource Graph `skipToken` and Cost Management `nextLink` pages. When bounded by `top`,
narrow scope or label incomplete results. Preserve currencies and reporting periods. Do not turn
missing data into zero, combine currencies, or present retail comparisons as realized savings.

Require explicit approval before writes, purchases, tier changes, stops,
resizes, or deletes.
