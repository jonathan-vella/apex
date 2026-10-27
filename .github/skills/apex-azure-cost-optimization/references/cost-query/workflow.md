# Cost Query Workflow

Use this workflow for cost totals, breakdowns, trends, and top spenders via the
Azure Cost Management Query REST API (`az rest`).

## 1. Determine scope and period

Use the narrowest scope from the
[Scope Reference](../../SKILL.md#scope-reference-shared-across-all-workflows) that answers the question.
Default to month-to-date when no period is specified. Custom dates use `YYYY-MM-DD` (or ISO 8601
timestamps in `timePeriod`), must be supplied as a `from`/`to` pair, and cannot exceed the
rolling 92-day lookback.

Supported timeframes are `MonthToDate`, `BillingMonthToDate`, `TheLastMonth`,
`TheLastBillingMonth`, `WeekToDate`, `TheCurrentMonth`, and `Custom`.

## 2. Configure the query request

| Field | Contract |
|---|---|
| `type` | `ActualCost` (default) or `AmortizedCost` for commitment analysis |
| `dataset.granularity` | `None` (default), `Daily`, or `Monthly` |
| `dataset.aggregation` | `PreTaxCost` (default) or `Cost` with `Sum` (`AmortizedCost` is selected via top-level `type`) |
| `dataset.grouping` | Up to two supported `Dimension` entries (`2023-11-01` `QueryDataset` limit) |
| `dataset.filter` | Exact-match `In` filter on a supported dimension |
| `dataset.sorting` | Cost column or selected grouping dimension (`ascending` or `descending`) |

Use [dimensions by scope](dimensions-by-scope.md) to select dimensions.
Resource- and meter-level dimensions require a subscription or resource-group
scope. For tag inventory, correlate Resource Graph results by resource ID rather
than relying on Cost Management tag grouping.

## 3. Execute and interpret

Call the Cost Management Query REST API (`az rest --method post` against
`<scope>/providers/Microsoft.CostManagement/query?api-version=2023-11-01`) with a JSON request body
written to a run-owned scratch file as shown in
[Step 4](../detailed-workflow-steps.md#step-4-query-actual-costs) and
[tool and safety guidance](../tools-and-safety.md#tool-preference).
Preserve the response column order, currency, metric, scope, and period. Keep
different currencies separate.

Request `granularity=None` when the answer needs a total instead of summing
daily rows. For weekly comparisons, issue one bounded custom-period query per
week, with `granularity=None` and only the required grouping, rather than
locally parsing or time-bucketing a larger response.

If the response includes `properties.nextLink`, follow every page before computing totals or
top-N rankings, or narrow the scope, period, or filter and explicitly label incomplete results.

## Error handling

| Error | Action |
|---|---|
| Unsupported timeframe, metric, dimension, or sort | Use a value exposed by the query contract. |
| Missing `from`/`to` or filter pair | Supply both members of the pair. |
| Date outside 92 days | Narrow the period; do not bypass this guardrail. |
| Throttled (HTTP 429) | Honor the retry-after header and reduce fan-out. |
| More than about 10 subscriptions | Ask the user to narrow scope. |

See [examples](examples.md), [request body schema](request-body-schema.md), and
[guardrails](guardrails.md). Use [cost query errors](error-handling.md) for
API remediation.
