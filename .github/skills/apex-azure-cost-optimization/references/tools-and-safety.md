<!-- ref:tools-and-safety-v1 -->

# Cost Tool and Safety Guidance

Adapted from upstream `azure-cost` (`cost-analysis/references/tools-and-safety.md`,
with the `cost-estimation` fallback rows).

## Tool preference

Use Azure Resource Manager MCP (ARM MCP) first. For Resource Graph, use the
generate, validate, execute sequence.

If a required operation is unavailable, name the fallback API and use an
already authenticated Azure CLI, Azure PowerShell, or direct REST client. Prefer
a native command when it exposes the required fields; otherwise use `az rest`,
`Invoke-AzRestMethod`, or authenticated REST. Do not fall back for invalid
input, denied access, throttling, or empty data.

| Workflow | Fallback API |
|---|---|
| Historical cost | Cost Management Query API |
| Existing-scope forecast | Cost Management Forecast API |
| AKS cost | Cost Management Query API for Kubernetes cost data |
| Public SKU or meter price | Azure Retail Prices API |
| Negotiated rates | Cost Management Price Sheet API |
| Resource inventory or changes | Azure Resource Graph Resources API |
| Utilization metrics | Azure Monitor Metrics API |

Preserve the MCP workflow's scope, period, row limits, pagination, currency, and
evidence labels. State which fallback was used. Never expose access tokens or
pricesheet URLs. Write any `az rest` request body to the run-owned scratch
directory from [Step 4](detailed-workflow-steps.md#step-4-query-actual-costs),
never to a shared `temp/` folder.

Do not invoke Bash, PowerShell, Python, or another local interpreter merely to
parse or aggregate an MCP response. Request server-side grouping or sorting, or
issue smaller bounded MCP queries. Use shell clients only for an approved API
fallback when the required MCP operation is unavailable.

## Evidence labels

These refine the [data classification labels](best-practices-notes.md#data-classification).

| Label | Meaning |
|-------|---------|
| Actual cost | Returned by Cost Management for the selected scope and period. |
| Actual metric | Returned by Azure Monitor or Kubernetes metrics. |
| Retail price | Returned by official Azure retail pricing. |
| Negotiated price | Returned from the user's pricesheet. |
| Estimate | Calculated from stated assumptions. |

Follow Resource Graph `skipToken` pages. For cost tools without continuation
input, increase `top` within the tool limit or narrow scope and label incomplete
results. Preserve currencies and reporting periods. Do not turn missing data
into zero, combine currencies, or present retail comparisons as realized
savings.

Require explicit approval before writes, purchases, tier changes, stops,
resizes, or deletes.
