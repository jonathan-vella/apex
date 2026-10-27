# Cost Query Request Schema

Construct Cost Management Query REST API (`az rest`) payloads using the official
`Microsoft.CostManagement/query` schema and these logical parameters.

| Parameter | Required | Values or format |
|---|---|---|
| `scope` | Yes | Azure scope path; never a tenant ID |
| `timeframe` | No | `MonthToDate`, `BillingMonthToDate`, `TheLastMonth`, `TheLastBillingMonth`, `WeekToDate`, `TheCurrentMonth`, `Custom` |
| `from`, `to` | Together | `YYYY-MM-DD` (or ISO 8601 in `timePeriod`); supplying both selects `Custom` |
| `granularity` | No | `None` (default), `Daily`, `Monthly` |
| `groupBy` | No | Up to five `Dimension` entries in `dataset.grouping` |
| `filterDimension` | With `filterValues` | One supported dimension in `dataset.filter.dimensions.name` |
| `filterValues` | With `filterDimension` | Exact values in `dataset.filter.dimensions.values` (`operator: "In"`) |
| `metric` | No | `PreTaxCost` (default), `Cost`, `AmortizedCost` |
| `sortBy` | No | Cost column or selected grouping dimension in `dataset.sorting` |
| `sortDirection` | No | `descending` (default) or `ascending` |
| `top` | No | 1-5000; default 100 |

Map these parameters into the `type`, `timeframe`, `timePeriod`, and `dataset`
(`granularity`, `aggregation`, `grouping`, `filter`, `sorting`, `top`) JSON request body
shown in [Step 4](../detailed-workflow-steps.md#step-4-query-actual-costs).

The response preserves `properties.columns` and `properties.rows`. Read each
row using the corresponding column index rather than assuming a fixed order.
