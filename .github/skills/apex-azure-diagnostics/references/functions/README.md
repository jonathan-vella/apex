# Function Apps Troubleshooting

## Find Linked App Insights / Log Analytics

### Resolve the Configured Telemetry Link

Select the function's full resource ID, subscription and deployment slot first.
Read only `APPLICATIONINSIGHTS_CONNECTION_STRING` and
`APPINSIGHTS_INSTRUMENTATIONKEY` from that slot's app settings into local memory;
do not print settings, connection strings or keys in chat or reports. Resolve Key
Vault references through authorized access or report the link as unknown.
Extract `InstrumentationKey` from the connection string (case-insensitive field
name); prefer it over the legacy key setting. If they disagree, report the drift.

Use that configured key in ARG, scoped to explicitly authorized subscriptions:

```bash
az graph query --subscriptions <authorized-subscription-ids> -q "
  resources
  | where type =~ 'microsoft.insights/components'
  | where tostring(properties.InstrumentationKey) =~ '<configured-instrumentation-key>'
  | project id, subscriptionId, appiName=name, resourceGroup,
            workspaceResourceId=tostring(properties.WorkspaceResourceId)
" -o json
```

Resource-group membership is not telemetry linkage. Require exactly one match;
zero matches means unresolved linkage, and multiple matches mean ambiguous evidence.
Never select the first match or expand subscription access automatically. If ARG
is unavailable, use authorized component inventory and apply the same configured-key
comparison locally. Preserve the full component ID and workspace resource ID.

Resolve the workspace ARM ID to its query customer ID when a workspace exists:

```bash
az monitor log-analytics workspace show --ids <workspace-resource-id> \
  --query customerId -o tsv
```

### Confirm logs are flowing

Query App Insights `traces` table to verify the function app is sending telemetry:

```bash
az monitor app-insights query --apps <appinsights-name> -g <rg-name> \
  --analytics-query "traces | where timestamp > ago(1h) | where cloud_RoleName == '<verified-function-role>' | order by timestamp desc | take 50 | project timestamp, operation_Name, message"
```

For `FunctionAppLogs` (available in Log Analytics only, not App Insights), query the workspace directly:

```bash
az monitor log-analytics query -w <workspace-guid> \
  --analytics-query "FunctionAppLogs | where TimeGenerated > ago(1h) | where _ResourceId =~ '<function-resource-id>' | order by TimeGenerated desc | take 50 | project TimeGenerated, FunctionName, Message, Level"
```

> ⚠️ **Classic App Insights:** A null `workspaceResourceId` means the component
> has no linked workspace. Use its `traces`, `requests` and `exceptions` tables.
> Function diagnostic settings may separately export `FunctionAppLogs` to another
> workspace; discover that explicit destination before querying it. Do not infer
> the absence of exported logs from classic App Insights alone.

Results establish telemetry only for the verified role/resource and time window.
A shared component's unrelated traces do not establish function health. Empty
results are inconclusive: check role mapping, diagnostics export, delay and settings.

> ⚠️ **Always prefer querying App Insights or Log Analytics** for function app logs. `az webapp log tail` can stream live logs directly but App Insights provides richer data, historical queries, and correlation across requests.

> 💡 **Tip:** App Insights logs can be delayed by a few minutes. If you don't see recent data, wait 3-5 minutes and query again.

---

## Check Recent Deployments

Correlate issues with recent deployments by listing deployment history:

```bash
az rest --method get \
  --uri "/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Web/sites/<func-app-name>/deployments?api-version=2023-12-01"
```

Compare deployment timestamps against when errors started appearing in App Insights to identify if a deployment caused the issue.
