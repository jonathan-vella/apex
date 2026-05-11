<!-- ref:pricing-guidance-v1 -->

# Azure Pricing MCP Service Names

Exact names for the Azure Pricing MCP tool. Using wrong names returns
0 results.

| Azure Service       | Correct `service_name`          | Common SKUs                            |
| ------------------- | ------------------------------- | -------------------------------------- |
| AKS                 | `Azure Kubernetes Service`      | `Free`, `Standard`, `Premium`          |
| API Management      | `API Management`                | `Consumption`, `Developer`, `Standard` |
| App Insights        | `Application Insights`          | `Enterprise`, `Basic`                  |
| App Service         | `Azure App Service`             | `B1`, `S1`, `P1 v3`, `P2 v3`, `P1v4`   |
| Application Gateway | `Application Gateway`           | `Standard_v2`, `WAF_v2`                |
| Azure Bastion       | `Azure Bastion`                 | `Basic`, `Standard`                    |
| Azure DNS           | `Azure DNS`                     | `Public`, `Private`                    |
| Azure Firewall      | `Azure Firewall`                | `Standard`, `Premium`                  |
| Azure Functions     | `Functions`                     | `Consumption`, `Premium`               |
| Azure Monitor       | `Azure Monitor`                 | `Logs`, `Metrics`                      |
| Container Apps      | `Azure Container Apps`          | `Consumption`                          |
| Container Instances | `Container Instances`           | `Standard`                             |
| Container Registry  | `Container Registry`            | `Basic`, `Standard`, `Premium`         |
| Cosmos DB           | `Azure Cosmos DB`               | `Serverless`, `Provisioned`            |
| Data Factory        | `Azure Data Factory v2`         | `Data Flow`, `Pipeline`                |
| Event Grid          | `Event Grid`                    | `Basic`                                |
| Event Hubs          | `Event Hubs`                    | `Basic`, `Standard`, `Premium`         |
| Front Door          | `Azure Front Door`              | `Standard`, `Premium`                  |
| Key Vault           | `Key Vault`                     | `Standard`                             |
| Load Balancer       | `Load Balancer`                 | `Basic`, `Standard`                    |
| Log Analytics       | `Log Analytics`                 | `Per GB`, `Commitment Tier`            |
| Logic Apps          | `Logic Apps`                    | `Consumption`, `Standard`              |
| MySQL Flexible      | `Azure Database for MySQL`      | `B1ms`, `D2ds_v4`, `E2ds_v4`           |
| NAT Gateway         | `NAT Gateway`                   | `Standard`                             |
| PostgreSQL Flexible | `Azure Database for PostgreSQL` | `B1ms`, `D2ds_v4`, `E2ds_v4`           |
| Redis Cache         | `Azure Cache for Redis`         | `Basic`, `Standard`, `Premium`         |
| SQL Database        | `SQL Database`                  | `Basic`, `S0`, `S1`, `Premium`         |
| Service Bus         | `Service Bus`                   | `Basic`, `Standard`, `Premium`         |
| Static Web Apps     | `Azure Static Web Apps`         | `Free`, `Standard`                     |
| Storage             | `Storage`                       | `Standard`, `Premium`, `LRS`, `GRS`    |
| VPN Gateway         | `VPN Gateway`                   | `Basic`, `VpnGw1`, `VpnGw2`            |
| Virtual Machines    | `Virtual Machines`              | `D4s_v5`, `B2s`, `E4s_v5`              |

- **DO**: Use exact names from the table above
- **DON'T**: Use "Azure SQL" (returns 0 results) — use "SQL Database"
- **DON'T**: Use "Web App" — use "Azure App Service"

## SKU naming gotchas (verified against the Retail Prices API)

| Common error           | Canonical Azure API skuName        | Notes                                                                                  |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `P1v3`, `P2v3`         | `P1 v3`, `P2 v3` (space)           | App Service Premium v3 SKUs have a space between digit and `v3` in `skuName`.          |
| `P1v4`, `P2v4`         | `P1 v4`, `P2 v4` (space)           | Same rule for Premium v4.                                                              |
| `P1mv3`, `P3mv3`       | `P1mv3`, `P3mv3` (no space)        | Memory-optimized Premium v3 SKUs (`m` for memory) have no space.                       |
| `D2sv5`                | `D2s_v5` (underscore)              | VM SKUs use underscore-v5 in `armSkuName`.                                             |
| `vCore General Purpose Serverless Gen5 2 vCore` | `2 vCore`         | SQL Database `skuName` is just the vCore count; tier is in `productName`.              |
| `Premium v3 P1`        | `P1 v3`                            | The plan / tier wording is in `productName`, not `skuName`.                            |
| `Standard ZRS Hot LRS` | `Standard ZRS`                     | Storage `skuName` carries redundancy only; access tier (Hot/Cool) is in `productName`. |
| `PerGB2018`            | `Standard`                         | Log Analytics Pay-As-You-Go is `skuName: Standard`, productName `Log Analytics`.       |
| `Workspace-based` (App Insights) | `Basic`                  | Application Insights Classic; workspace-based AI bills through Log Analytics instead.  |

## Service-specific billing quirks

### SQL Database Serverless (per-vCore-second billing)

Azure SQL Database General Purpose Serverless bills **per vCore-second of
actual consumption**, not by configured max vCore. The Retail Prices API
reflects this by publishing the per-second compute meter only under the
`1 vCore` `skuName` (`meterName: "vCore"` or `"vCore - Standby"`).
Higher-vCore Serverless SKU rows (`2 vCore`, `4 vCore`, …) publish only
the `*-Free` baseline meter at $0/hr and **must not** be used to price
the workload.

To price SQL Database GP Serverless:

1. Use `service_name: "SQL Database"`, `sku_name: "1 vCore"`,
   `product_filter: "General Purpose - Serverless"`, **regardless of
   the configured max vCore** (2, 4, 8, etc.).
2. Multiply the resolved hourly rate by the **effective vCore-seconds**
   per month. For an MVP with ~50% utilization at max 2 vCore that's
   `0.5 × 2 × 730 = 730 vCore-hours/month`. For pessimistic 100%
   always-on at max 2 vCore, use `2 × 730 = 1460 vCore-hours/month`.
3. Add a separate storage line for the data (`gb_stored` against the
   `productName: "General Purpose - Storage"` family if your project
   has >32 GB).

This is documented in
[the Azure docs](https://learn.microsoft.com/azure/azure-sql/database/serverless-tier-overview)
— the auto-pause-when-idle option uses the `*-Free` meter for paused
periods, hence why higher SKUs publish $0 "Free" meters only.

## Required: `product_filter` for multi-product services

Several Azure services publish multiple `productName` rows that share the
same `skuName`. Without a `product_filter` substring, `azure_bulk_estimate`
and `azure_price_search` return ambiguous results and fail to project a
monthly cost. **You MUST pass `product_filter` for these services.**

| Service          | sku_name (canonical)     | Required `product_filter`                            | Typical meter             | Notes                                                                |
| ---------------- | ------------------------ | ---------------------------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| SQL Database — GP Serverless | `1 vCore` (always; per vCore-second billing) | `General Purpose - Serverless`                       | per `Hour` (compute)      | Multiply hourly rate by max_vcore × utilization hours. Storage line is separate. Higher-vCore SKUs publish $0 "Free" meters only — see SQL Serverless quirk above. |
| SQL Database — GP Provisioned | `N vCore` (Gen5) | `General Purpose - Compute Gen5`                     | per `Hour`                | For DTU model use sku `S0`/`S1`/`S2`/etc. with no `product_filter`   |
| SQL Database — Business Critical | `N vCore` (Gen5) | `Business Critical - Compute Gen5`                   | per `Hour`                |                                                                      |
| SQL Database — Hyperscale | `N vCore` (Gen5)    | `Hyperscale - Compute Gen5`                          | per `Hour`                |                                                                      |
| Storage — Block Blob Hot   | `Standard ZRS` / `Standard LRS` / `Standard GRS` | `General Block Blob`                                 | `Hot {LRS,ZRS,GRS} Data Stored` per `GB/Month` | Pass `gb_stored` usage; tier (Hot/Cool/Cold/Archive) comes from `productName` |
| Storage — Block Blob Cool  | `Standard ZRS` / `Standard LRS` / `Standard GRS` | `General Block Blob v2 Hierarchical Namespace` or `General Block Blob` | `Cool {LRS,ZRS,GRS} Data Stored` per `GB/Month` | Pass `gb_stored` usage                                              |
| Storage — Tables           | `Standard LRS` etc.      | `Tables`                                             | `Data Stored` + transactions | Pass both `gb_stored` and `transactions_per_month`                |
| Storage — Queues           | `Standard LRS` etc.      | `Queues v2`                                          | transactions             | Pass `transactions_per_month`                                       |
| Storage — Files            | `Standard LRS` etc.      | `Files`                                              | `GB/Month`                |                                                                      |
| Log Analytics — Pay-As-You-Go | `Standard`           | `Log Analytics`                                      | `Standard Data Analyzed` per `GB` | Pass `gb_stored` usage as ingested GB/month                       |
| Log Analytics — Free       | `Free`                   | `Log Analytics`                                      | `Free Data Analyzed`      | $0 — included in Log Analytics product                              |
| Bandwidth — Outbound Internet | `Standard`            | `Bandwidth - Routing Preference: Internet`           | `Standard Data Transfer Out` per `GB` | First 100 GB/month free; pass `gb_transferred` for >100 GB        |
| Application Insights — Classic | `Basic`              | `Application Insights`                               | per `GB` ingestion       | Workspace-based AppInsights bills via Log Analytics, not here       |
| Front Door — Standard      | `Standard`               | `Azure Front Door Standard` (NOT `Premium`)          | base + per `GB`           | Routing rules + requests + bandwidth — multiple meters             |
| Front Door — Premium       | `Premium`                | `Azure Front Door Premium`                           | base + per `GB`           |                                                                      |

> **Pattern**: when in doubt, query the Retail Prices API directly first
> (`https://prices.azure.com/api/retail/prices?$filter=serviceName eq '<name>' and armRegionName eq '<region>'`)
> to discover the exact `productName` and `skuName` values. The MCP simply
> wraps this API.

## Required: `usage` hints for non-hourly meters

The MCP cannot project a monthly cost from a meter like
`$0.023 per 1 GB/Month` without knowing how many GB. Pass the relevant
`usage` field in every resource entry whose meter is **not** hourly:

| Meter dimension | `usage` field          | Example value (defaults to plug in)                      |
| --------------- | ---------------------- | -------------------------------------------------------- |
| per GB/Month    | `gb_stored`            | Storage Hot Blob: from requirements; SQL data: 32        |
| per GB egress   | `gb_transferred`       | Bandwidth: from requirements (default 100)               |
| per 10K ops     | `transactions_per_month` | Key Vault: 10000; Storage Queues: 100000               |
| per second      | `seconds_runtime`      | ACR Build, Logic Apps consumption-style                  |

Resources without a `usage` hint where the meter requires it will come
back with `monthly_cost: 0.0` and a `projection_warning` — that is **not**
a successful resolution and must be retried with the missing `usage`
field.

## Static-fallback whitelist (do NOT call MCP for these)

These resources have no meter — or a meter that is free at the volumes
this project will ever produce. Record them as `monthly_cost: 0.0` with
`hourly_rate: 0.0` and `notes: "static_fallback: <reason>"` **without**
spending an MCP call:

| Resource                              | Cost   | Reason                                                                            |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| Virtual Network (base, no peering)    | $0.00  | VNet itself has no recurring charge — only data processed via gateway/peering    |
| Network Security Group (NSG)          | $0.00  | NSGs are free                                                                     |
| Route Table                           | $0.00  | Free                                                                              |
| Microsoft Entra ID (workforce)        | $0.00  | Free tier; P1/P2 only if explicitly purchased per-user                            |
| Microsoft Entra External ID (Free)    | $0.00  | First 50,000 MAU/month free                                                       |
| Resource Group                        | $0.00  | Free                                                                              |
| Managed Identity (system-assigned)    | $0.00  | Free                                                                              |
| Action Group (email/SMS to ≤1 region) | $0.00  | First 1,000 emails + first 100 SMS free                                           |
| Azure Budget                          | $0.00  | Free — no charge for cost management                                              |
| Diagnostic settings                   | $0.00  | Free; ingestion charged via Log Analytics line                                    |
| App Service Custom Domain             | $0.00  | Free; only TLS certificate has a cost (separate Storage line if SNI Cert is used) |
| Bandwidth (≤ first 100 GB/month outbound) | $0.00 | Azure's free egress allowance applies before any per-GB charge                  |
| Private DNS Zone — base                | $0.50/mo per zone | Use MCP for this — it returns a per-zone meter; included here for reference |
| Private Endpoint                      | $7.20/mo each | Use MCP — Standard meter resolves cleanly under Virtual Network             |

> The static-fallback whitelist is a closed list. If a resource is not on
> this whitelist, you **must** attempt to price it through the MCP — do
> not invent "free" entries.

## Bulk Estimates


For multi-resource cost estimates, prefer `azure_bulk_estimate` over
calling `azure_cost_estimate` per resource. It accepts a `resources`
array and returns aggregated totals.

Each resource supports a `quantity` parameter (default: 1) for
multi-instance scenarios. The default `response_format` is `compact`
in v5.0 — pass `response_format: "full"` only when you need the verbose
v4 string shape (e.g., for back-compat with a parser).

Each resource entry supports these per-line parameters:

- `service_name` (required) — canonical service name (table above).
- `sku_name` (required) — canonical SKU name (table above).
- `region` (required) — Azure region.
- `quantity` (default 1) — number of identical instances.
- `hours_per_month` (default 730) — for hourly meters.
- `product_filter` — **mandatory** for multi-product services
  (SQL Database, Storage Blob, Log Analytics, Bandwidth, Front Door,
  Application Insights). Without this, multi-product services return
  0 results. See the `product_filter` table above.
- `usage` — **mandatory** for non-hourly meters. Object with keys
  `gb_stored`, `gb_transferred`, `transactions_per_month`,
  `seconds_runtime`. Without this, the meter resolves to
  `monthly_cost: 0.0` + `projection_warning` and the line is NOT
  considered resolved.

### Worked example — N-Tier workload (App Service + SQL + Storage + KV + Log Analytics)

```text
azure_bulk_estimate({
  resources: [
    // Compute — hourly meter, no product_filter or usage needed.
    // NOTE: skuName is "P1 v3" with a space — the no-space form returns 0 results.
    { service_name: "Azure App Service", sku_name: "P1 v3", region: "swedencentral", quantity: 1 },

    // SQL Database GP Serverless — Azure bills per vCore-second under the "1 vCore" meter.
    // For any max-vCore Serverless config, query the "1 vCore" SKU and multiply by
    // effective vCore-hours in the parent's cost calculation. See "SQL Database Serverless"
    // billing-quirk note above.
    {
      service_name: "SQL Database", sku_name: "1 vCore", region: "swedencentral",
      product_filter: "General Purpose - Serverless",
      hours_per_month: 730,   // adjust for max_vcore × utilization in parent calc
      usage: { gb_stored: 32 }   // for the Data Stored sibling meter
    },

    // Storage Hot Blob ZRS — REQUIRES product_filter + usage
    {
      service_name: "Storage", sku_name: "Standard ZRS", region: "swedencentral",
      product_filter: "General Block Blob",
      usage: { gb_stored: 100 }
    },

    // Log Analytics Pay-As-You-Go — REQUIRES product_filter + usage
    {
      service_name: "Log Analytics", sku_name: "Standard", region: "swedencentral",
      product_filter: "Log Analytics",
      usage: { gb_stored: 5 }
    },

    // Key Vault — REQUIRES usage (per-10K-operations meter)
    {
      service_name: "Key Vault", sku_name: "Standard", region: "swedencentral",
      usage: { transactions_per_month: 10000 }
    },

    // Bandwidth outbound — REQUIRES product_filter + usage
    {
      service_name: "Bandwidth", sku_name: "Standard", region: "swedencentral",
      product_filter: "Bandwidth - Routing Preference: Internet",
      usage: { gb_transferred: 100 }   // first 100 GB free → $0
    },

    // Private Endpoint — resolves cleanly via VNet meter
    { service_name: "Virtual Network", sku_name: "Private Endpoint", region: "swedencentral", quantity: 3 },

    // Private DNS zones — resolves cleanly
    { service_name: "Azure DNS", sku_name: "Private", region: "swedencentral", quantity: 3 }

    // NOTE: VNet base, NSGs, Entra External ID Free, Resource Group, Action Group,
    //       Azure Budget are NOT in this array — they are static-fallback entries
    //       written directly to JSON by the agent without an MCP call.
  ]
})
```

## Troubleshooting — known MCP server bugs and workarounds

When the MCP returns `0 results` for a SKU that you can confirm exists in
the Azure Retail Prices API, you have hit one of these issues. Document
the workaround in the line's `notes` and `data_source` fields so the
audit trail is intact.

### Direct-API probe (always run this first when MCP fails)

```bash
python3 -c "
import urllib.request, urllib.parse, json
f = \"serviceName eq 'SQL Database' and armRegionName eq 'swedencentral' and skuName eq 'S2'\"
url = f'https://prices.azure.com/api/retail/prices?\$filter={urllib.parse.quote(f)}&\$top=20'
print(json.dumps(json.loads(urllib.request.urlopen(url).read())['Items'][:5], indent=2))
"
```

If the API returns rows, the bug is in the MCP layer or in your SKU
string. If the API also returns 0, it's a genuine Azure coverage gap
and you should mark the line `Estimate unavailable`.

### Known MCP bugs (as of 2026-05)

| Symptom                                                                         | Cause                                                                                                   | Workaround                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `azure_price_search` returns `count: 0` for SQL Database `S2` / `S0` / `S1`     | Day-based DTU meters (`unitOfMeasure: '1/Day'`) are filtered out by the MCP's SKU validator             | Fetch the meter via direct Retail Prices API; multiply `retailPrice × 30` for monthly. Set `data_source` to include "+ direct API". |
| `azure_bulk_estimate` returns `monthly_cost: 0` for multi-product services      | Missing `product_filter` per resource — `contains(skuName, …)` matches multiple products ambiguously   | Always pass `product_filter` per the table in `## Required: product_filter for multi-product services` above.               |
| `azure_bulk_estimate` returns `monthly_cost: 0` + `projection_warning`          | Missing `usage` hint for a non-hourly meter (per-GB / per-transaction / per-second)                     | Pass the relevant `usage` field per `## Required: usage hints for non-hourly meters` above.                                 |
| App Service Premium v3 `P1v3` / `P2v3` returns 0                                | Azure's canonical `skuName` has a space: `P1 v3`, `P2 v3`                                               | Use the space form. See `## SKU naming gotchas`.                                                                            |
| SQL Database GP Serverless higher-vCore SKUs (e.g. `2 vCore`) return $0 meters  | Azure publishes the billable per-vCore-second meter only under `1 vCore`; higher SKUs show only the free pause meter | Query `sku_name: "1 vCore"` with `product_filter: "General Purpose - Serverless"`, then compute `hourly_rate × max_vcore × utilization × 730`. See `## Service-specific billing quirks → SQL Database Serverless`. |

### Recovery protocol (subagent + parent)

1. Subagent first applies all four `## Mandatory pre-bulk normalization`
   rules from `.github/agents/_subagents/cost-estimate-subagent.agent.md`.
2. If a line still returns 0 results after bulk + per-line `azure_price_search`
   fallback, the subagent records `Estimate unavailable` and finishes with
   `status: FAILED` listing the line in `unresolved_items[]`.
3. The parent agent (Architect / As-Built) may, **as a documented
   override**, fetch the meter from the Retail Prices API directly,
   patch the JSON in place, and record the override in `optimization_notes[]`
   plus the line's `notes`. The override must:
   - Cite the exact API filter used (so it's reproducible).
   - Append `"+ direct API"` to `data_source`.
   - Keep `confidence` no higher than `Medium`.
   - Not be applied for invented prices — only for prices that exist in
     the Retail Prices API but are blocked by a known MCP bug above.
4. Never hardcode prices from parametric knowledge. Every figure must be
   traceable to a real MCP response or a direct Retail Prices API row.

### Reporting new bugs

If you find a new MCP-vs-API discrepancy, add a row to the
`## Known MCP bugs` table above with the symptom, the canonical filter
that works against the Retail Prices API, and a brief root-cause
hypothesis. Link to a GitHub issue in
`tools/mcp-servers/azure-pricing` so the underlying bug can be tracked
and eventually closed.

