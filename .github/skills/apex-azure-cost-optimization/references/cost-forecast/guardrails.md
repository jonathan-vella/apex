# Cost Forecast Guardrails

Apply these guardrails when calling the Azure Cost Management Forecast REST API (`az rest`).

| Rule | Limit |
|---|---|
| Default period | First through last day of the current month |
| Custom dates | `from` and `to` required together in `YYYY-MM-DD` (or ISO 8601) |
| Historical lookback for `from` | Rolling 92 days |
| Forecast end | May be in the future |
| Date span | Maximum 92 days |
| Granularity | `Daily` or `Monthly` |
| Response rows | Maximum 100 |
| Filters | One dimension with exact `In` values |
| Grouping | Keep omitted for standard forecast projections |

Forecasts may be unavailable for new or inactive scopes. Treat unavailable data
separately from a numeric zero and use the
[cost query workflow](../cost-query/workflow.md) for available history.
