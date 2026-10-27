# Cost Forecast Errors

Handle errors returned by the Cost Management Forecast REST API (`az rest`),
following [tool and safety guidance](../tools-and-safety.md#tool-preference).

| Error | Likely cause | Remediation |
|---|---|---|
| Missing paired parameter | Only one date or filter field supplied | Supply both `from`/`to` or `filterDimension`/`filterValues`. |
| Invalid date | Not `YYYY-MM-DD`, reversed range, start older than 92 days, or span over 92 days | Correct and narrow the period. |
| Unsupported aggregation or `type` | Aggregation column outside `PreTaxCost` or `Cost`, or invalid top-level `type` | Sum `PreTaxCost` or `Cost` in `dataset.aggregation` and select `ActualCost`, `AmortizedCost`, or `Usage` via top-level `type`. |
| Unsupported dimension | Filter is outside the cost dimension whitelist | Query the Dimensions API or remove the filter. |
| Forecast unavailable | Scope lacks usable forecast data | Report unavailability; use the [cost query workflow](../cost-query/workflow.md) for history. |
| Unauthorized or forbidden | Authentication or RBAC failure | Reauthenticate or request Cost Management Reader access. |
| Throttled | Excessive Cost Management fan-out | Honor returned retry guidance and reduce calls. |
| Service error (5xx) | Transient service failure | Retry once with backoff; if unavailable, report the error. |

Surface the API error code and user-visible message clearly without exposing raw access tokens.
