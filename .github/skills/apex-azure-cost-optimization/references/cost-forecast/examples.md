# Cost Forecast Examples

Use these parameter combinations when constructing Cost Management Forecast REST API (`az rest`)
payloads.

| Scenario | Parameters |
|---|---|
| Rest of current month | `scope=<scope>`; default current-month dates; `granularity=Daily` |
| Custom monthly projection | `from=<YYYY-MM-DD>`, `to=<future-YYYY-MM-DD>`, `granularity=Monthly` |
| Resource-group forecast | `scope=/subscriptions/<id>/resourceGroups/<name>`, optional date pair |
| Service-specific forecast | `filterDimension=ServiceName`, `filterValues=<exact-service-name>` |
| Amortized commitment projection | `type=AmortizedCost`, `metric=PreTaxCost`, selected scope and date pair |

Target `<scope>/providers/Microsoft.CostManagement/forecast?api-version=2023-11-01` via
`az rest --method post` with the JSON body written to a run-owned scratch file.
