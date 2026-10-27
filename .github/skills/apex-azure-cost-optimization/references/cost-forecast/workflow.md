# Cost Forecast Workflow

Use this workflow to project costs for an existing Azure scope via the Cost Management
Forecast REST API (`az rest`). For historical cost, use the
[cost query workflow](../cost-query/workflow.md); to reduce cost, use the
[optimization workflow](../workflow-steps.md).

## 1. Determine scope and period

Default to the current month (first day through last day) when no period is specified. For
custom dates, supply `from` and `to` together in `YYYY-MM-DD` (or ISO 8601 timestamps in
`timePeriod`). `from` must be within the rolling 92-day lookback; `to` may be in the future.

## 2. Configure the forecast request

| Field | Contract |
|---|---|
| `scope` | Azure scope path from the [Scope Reference](../../SKILL.md#scope-reference-shared-across-all-workflows); never a tenant ID |
| `type` | `ActualCost` (default), `AmortizedCost`, or `Usage` |
| `timePeriod.from`, `timePeriod.to` | Optional pair; defaults to current month |
| `dataset.granularity` | `Daily` (default) or `Monthly` |
| `dataset.filter` | Optional `dimensions` filter using one exact-match dimension |
| `dataset.aggregation` | `PreTaxCost` (default) or `Cost` with `Sum` (`AmortizedCost` is selected via top-level `type`) |

Keep forecast payloads bounded: avoid custom grouping or arbitrary aggregations.

## 3. Execute and interpret

Call the Cost Management Forecast REST API (`az rest --method post` against
`<scope>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01`) with a JSON request
body written to a run-owned scratch file, following
[tool and safety guidance](../tools-and-safety.md#tool-preference).
Preserve currency, date, scope, actual-versus-forecast status, and the 100-row
response limit. Empty or unavailable forecast data is not zero.

For grouped historical data, use the [cost query workflow](../cost-query/workflow.md).
If the requested forecast cannot fit the supported contract, explain the
limitation.

## Error handling

| Error | Action |
|---|---|
| Missing date or filter pair | Supply both fields. |
| Historical start older than 92 days | Move `from` inside the supported window. |
| Unsupported metric, granularity, or dimension | Use an exposed value. |
| Forecast unavailable | Report unavailable data and offer historical analysis. |
| Throttled (HTTP 429) | Honor retry-after guidance and reduce fan-out. |

See [examples](examples.md), [request body schema](request-body-schema.md), and
[guardrails](guardrails.md). Use [forecast errors](error-handling.md) for
API remediation.
