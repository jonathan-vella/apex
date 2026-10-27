# Cost Query Errors

Handle errors returned by the Cost Management Query REST API (`az rest`),
following [tool and safety guidance](../tools-and-safety.md#tool-preference).

| Error | Likely cause | Remediation |
|---|---|---|
| Unsupported timeframe | Value is outside the supported timeframe allowlist | Use a supported timeframe or `Custom` with dates. |
| Unsupported dimension | Dimension is not whitelisted | Use [dimensions by scope](dimensions-by-scope.md). |
| Subscription-only dimension | Resource or meter dimension used at a broader scope | Narrow to a subscription/resource group or choose another dimension. |
| Missing paired parameter | Only one date or filter field supplied | Supply both `from`/`to` or `filterDimension`/`filterValues`. |
| Date outside lookback | Start is older than 92 days, range is too long, or end is future | Narrow the historical window. |
| Too many grouping dimensions | More than two entries in `dataset.grouping` | Limit `dataset.grouping` to at most two dimensions. |
| Unauthorized or forbidden | Authentication or RBAC failure | Reauthenticate or request Cost Management Reader access. |
| Throttled | Excessive Cost Management fan-out | Honor returned retry guidance and reduce calls. |
| Service error (5xx) | Transient service failure | Retry once with backoff; if the service remains unavailable, report the error. |
| Empty rows | No data or unavailable data | Do not report zero unless the response establishes zero. |

Surface the API error code and user-visible message clearly without exposing raw access tokens.
