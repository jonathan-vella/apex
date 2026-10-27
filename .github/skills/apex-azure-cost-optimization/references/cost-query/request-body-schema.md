# Cost Query Request Schema

Construct Cost Management Query REST API (`az rest`) payloads using the official
`Microsoft.CostManagement/query` schema and these logical parameters.

| Parameter | Required | Values or format |
|---|---|---|
| `scope` | Yes | Azure scope path; never a tenant ID |
| `type` | No | `ActualCost` (default) or `AmortizedCost` for commitment analysis |
| `timeframe` | No | `MonthToDate`, `BillingMonthToDate`, `TheLastMonth`, `TheLastBillingMonth`, `WeekToDate`, `TheCurrentMonth`, `Custom` |
| `from`, `to` | Together | `YYYY-MM-DD` (or ISO 8601 in `timePeriod`); supplying both selects `Custom` |
| `granularity` | No | `None` (default), `Daily`, `Monthly` |
| `groupBy` | No | Up to two `Dimension` entries in `dataset.grouping` (`2023-11-01` `QueryDataset` limit) |
| `filterDimension` | With `filterValues` | One supported dimension in `dataset.filter.dimensions.name` |
| `filterValues` | With `filterDimension` | Exact values in `dataset.filter.dimensions.values` (`operator: "In"`) |
| `metric` | No | `PreTaxCost` (default) or `Cost` in `dataset.aggregation` (`function: "Sum"`); select amortized costs via top-level `type: "AmortizedCost"` |
| `sortBy` | No | Cost column or selected grouping dimension in `dataset.sorting` |
| `sortDirection` | No | `descending` (default) or `ascending` |

Map these parameters into the `type`, `timeframe`, `timePeriod`, and `dataset`
(`granularity`, `aggregation`, `grouping`, `filter`, `sorting`) JSON request body
shown in [Step 4](../detailed-workflow-steps.md#step-4-query-actual-costs).
`QueryDataset` (`2023-11-01`) does not support a `dataset.top` field; follow
`properties.nextLink` across all pages before computing totals or top-N rankings,
or explicitly label partial results.

The response preserves `properties.columns` and `properties.rows`. Read each
row using the corresponding column index rather than assuming a fixed order.
