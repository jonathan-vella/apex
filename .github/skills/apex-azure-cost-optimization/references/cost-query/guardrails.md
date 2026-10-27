# Cost Query Guardrails

Apply these guardrails when querying the Azure Cost Management Query REST API (`az rest`).

| Rule | Limit |
|---|---|
| Historical lookback | Rolling 92 days |
| Custom dates | `from` and `to` required together in `YYYY-MM-DD` (or ISO 8601) |
| Historical end date | Cannot be in the future |
| Grouping | Maximum two dimensions (`2023-11-01` `QueryDataset` limit) |
| Pagination | Follow `properties.nextLink` across all pages (`QueryDataset` has no `dataset.top` field) |
| Filters | One dimension with exact `In` values |
| Tags | Correlate via Resource Graph rather than Cost Management tag grouping |
| Fan-out | Ask the user to narrow requests spanning more than about 10 subscriptions |

Resource- and meter-level dimensions are limited to subscription and
resource-group scopes. Other whitelisted dimensions can be attempted at broader
scopes, but upstream agreement and scope rules may still reject them.

## Query efficiency

- Prefer one bounded query that answers the question instead of splitting the
  same scope and period across multiple calls.
- Filter early and request only the grouping dimensions needed for the answer.
- Use cost-descending sorting and slice top-N rankings only after following all `properties.nextLink` pages.
- Shorten the time range or reduce grouping dimensions for expensive resource,
  meter, or high-cardinality queries.
- For subscriptions under the same billing account, prefer one supported
  billing-account query over separate per-subscription calls.

Reject invalid dates, unsupported dimensions, and incomplete `from`/`to` or filter
pairs. Do not silently swap, truncate, or shift requested dates.

Follow `properties.nextLink` pages when present before computing totals or rankings;
if pagination is stopped early, narrow the request and explicitly label the result as incomplete.
