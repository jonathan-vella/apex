# Cost Query Examples

Use these parameter combinations when constructing Cost Management Query REST API (`az rest`)
payloads, and preserve these constraints.

| Scenario | Parameters |
|---|---|
| Month-to-date cost by service | `type=ActualCost`, `timeframe=MonthToDate`, `granularity=None`, `groupBy=ServiceName`, `metric=Cost` |
| Daily trend for a custom period | `type=ActualCost`, `from=<YYYY-MM-DD>`, `to=<YYYY-MM-DD>`, `granularity=Daily`, `metric=Cost` |
| Cost by resource group | `type=ActualCost`, `timeframe=MonthToDate`, `groupBy=ResourceGroupName`, `sortDirection=descending` |
| Amortized commitment cost | `type=AmortizedCost`, `timeframe=TheLastMonth`, `groupBy=BenefitName`, `metric=PreTaxCost` |
| Ten most expensive resources | subscription scope, `groupBy=ResourceId`, `sortDirection=descending`, follow `properties.nextLink` then take top 10 |
| One service only | `filterDimension=ServiceName`, `filterValues=<exact-service-name>` |

Query `<scope>/providers/Microsoft.CostManagement/dimensions?api-version=2023-11-01` via `az rest`
when an exact filter value or available dimension is unknown.

For resource tag inventory, use the Resource Graph `generate_query`, `validate_query`, and
`execute_query` sequence, then correlate resource IDs with cost results. Use the tag keys from
`tag_contract` in `04-governance-constraints.json`, as in the
[Resource Graph queries](../azure-resource-graph.md).
