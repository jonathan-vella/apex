# Cost Forecast Request Schema

Construct Cost Management Forecast REST API (`az rest`) payloads using the official
`Microsoft.CostManagement/forecast` schema and these logical parameters.

| Parameter | Required | Values or format |
|---|---|---|
| `scope` | Yes | Azure scope path |
| `from`, `to` | Together | `YYYY-MM-DD` (or ISO 8601 in `timePeriod`); defaults to current-month boundaries |
| `granularity` | No | `Daily` (default), `Monthly` |
| `filterDimension` | With `filterValues` | One supported cost dimension in `dataset.filter.dimensions.name` |
| `filterValues` | With `filterDimension` | Exact values in `dataset.filter.dimensions.values` (`operator: "In"`) |
| `metric` | No | `PreTaxCost` (default), `Cost`, `AmortizedCost` |

Set `type` (`Usage` or `ActualCost` / `AmortizedCost`), `timeframe=Custom`, `timePeriod`,
and `dataset` (`granularity`, `aggregation`, optional `filter`) using the same dimension
whitelist as the [cost query workflow](../cost-query/dimensions-by-scope.md).

The response preserves `properties.columns` and `properties.rows`. Interpret each row
using its matching column definition, including currency and `CostStatus` when
returned.
