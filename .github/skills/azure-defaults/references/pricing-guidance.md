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
| Azure DNS           | `Azure DNS`                     | `Public`, `Private` (filter on `meterName` — see "Filter on `meterName`, not `productName`" below) |
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
| ExpressRoute Gateway | `ExpressRoute`                 | `Standard`, `HighPerformance`, `UltraPerformance`, `ErGw1AZ`, `ErGw2AZ`, `ErGw3AZ` |
| App Gateway for Containers | `Application Gateway for Containers` | `Standard` (per-fabric + LCU)    |
| Virtual Machines    | `Virtual Machines`              | `D4s_v5`, `B2s`, `E4s_v5`              |

- **DO**: Use exact names from the table above
- **DON'T**: Use "Azure SQL" (returns 0 results) — use "SQL Database"
- **DON'T**: Use "Web App" — use "Azure App Service"

## Global services — `region: "global"` rule

Azure has a class of services that are **not regional** — their meters
are published in the Retail Prices API with `armRegionName: "Global"`,
not under the workload region. Passing the workload region
(`swedencentral`, `westeurope`, …) for these services is the #2
historical cause of `azure_bulk_estimate` returning zero rows (right
behind missing `product_filter`).

**Hard rule**: when a resource entry's `service_name` matches the table
below, set `region: "global"` in both `azure_bulk_estimate` and
`azure_price_search` calls — even though the rest of the workload lives
in a regional Azure DC. Record `notes: "global meter; priced from
Global region"` so the audit trail explains the region substitution.

| Service                          | `service_name`                  | Why global                                                             |
| -------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Azure DNS — Public zones         | `Azure DNS`                     | Anycast DNS; one global meter for zone hosting + queries               |
| Azure DNS — Private zones        | `Azure DNS`                     | Same global meter family; per-zone + per-query, region-independent     |
| Azure Front Door — Standard      | `Azure Front Door`              | Edge POPs are global; base + request meters live under `Global`        |
| Azure Front Door — Premium       | `Azure Front Door`              | Same                                                                   |
| Traffic Manager                  | `Traffic Manager`               | DNS-based traffic routing; global meter                                |
| Microsoft Entra ID / External ID | `Microsoft Entra ID`            | Identity directory — per-MAU meters published globally                |
| Microsoft Defender for Cloud     | `Microsoft Defender for Cloud`  | Per-resource plans billed against global meters                        |
| Azure Policy                     | `Azure Policy`                  | Free at default usage; meter (if any) is global                        |

**Bandwidth caveat**: outbound bandwidth meters carry `armRegionName`
for the *source* region (e.g. `EU Zone 1` rather than `swedencentral`).
Keep using the workload region for `service_name: "Bandwidth"` — the
MCP server maps it to the correct zone.

**Front Door follow-up calls**: when bulk returns only the routing-rule
or base-fee meter for Front Door, schedule a `azure_price_search`
follow-up for the request + data-transfer meters under the same
`Azure Front Door Standard` / `Azure Front Door Premium` product
filter — these are billed separately in the Retail Prices API.

### Filter on `meterName`, not `productName`, when variants share a product

Several global services publish **one `productName` covering many
unrelated variants**, distinguishing them only via `meterName`. Filtering
on `productName` for the variant keyword returns **zero rows** — the
classic "MCP returned nothing, fell back to catalog" symptom on a meter
that demonstrably exists.

Verified gotchas (Azure Retail Prices API, May 2026):

| Service     | `productName` (umbrella)  | Variants distinguished by `meterName` | Correct filter shape                                                                                  |
| ----------- | ------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Azure DNS — Private Zones | `Azure DNS` | `Private Zone` (hosting), `Private Queries`, `Private Resolver Inbound Endpoint`, `Private Resolver Outbound Endpoint`, `Private Resolver DNS Forwarding Ruleset` | `serviceName eq 'Azure DNS' and meterName eq 'Private Zone' and armRegionName eq ''` |
| Azure DNS — Public Zones  | `Azure DNS` | `Public Zone`, `Public Queries`                                                                            | `serviceName eq 'Azure DNS' and meterName eq 'Public Zone' and armRegionName eq ''`  |
| Azure DNS — DNS Security  | `Azure DNS` | `DNS Security Policy Domains Managed Domain`, `DNS Security Policy Queries`                                | `serviceName eq 'Azure DNS' and meterName eq 'DNS Security Policy Queries'`          |

**Anti-pattern** (returns 0 rows):
`serviceName eq 'Azure DNS' and contains(productName, 'Private')`
— `productName` is literally `"Azure DNS"` for every Azure DNS row, so the
substring `Private` never matches.

**Verified pricing (May 2026 spot-check, GLOBAL region)** — use these as
sanity baselines when the bulk path returns zero rows for a known-existing
meter and you're triaging whether MCP, filter shape, or region is at fault:

| meter          | tierMinimumUnits | retailPrice     | unitOfMeasure |
| -------------- | ----------------: | --------------: | ------------- |
| Private Zone   | 0                | $0.50           | per zone/month |
| Private Zone   | 25               | $0.10           | per zone/month (after first 25) |
| Private Queries | 0                | $0.40           | per 1M queries |

**Rule for the subagent**: when adding a new resource to `resource_list`
whose `service_name` appears in the table above, set the targeted
`azure_price_search` filter on `meterName` (not `productName`). The
`product_filter` argument may be omitted for Azure DNS — there is only
one `productName`, so it adds no discrimination but does narrow the
result count safely if passed.

**General heuristic** (for services not yet enumerated above): if a
follow-up `azure_price_search` with `region: "global"` AND a sensible
`product_filter` returns zero rows for a meter you can verify exists on
the [Azure DNS pricing page](https://azure.microsoft.com/pricing/details/dns/)
or equivalent, the next thing to try is filtering on
`meterName` directly. Record the resolution in the line's `notes`
field so future runs can short-circuit the same triage.

## Canonical SKU Aliases

Authoritative mapping from common variant input forms to the canonical
`sku_name` value the Azure Retail Prices MCP server returns. The
`cost-estimate-subagent` MUST normalize `resource_list[].sku_name`
through this table before calling `azure_bulk_estimate` — alias
mismatches are the #1 historical cause of `unresolved_items` and
`status: FAILED` runs (Phase C of the nordic-foods lessons plan).

The table is the **only** legitimate source of alias rewrites. New
aliases are added via `tools/scripts/promote-sku-aliases.mjs` (monthly
cron + on-demand) which scans recent `cost-estimate-*.json` files for
`proposed_aliases[]` and opens a PR.

| Service              | Variant input                             | Canonical `sku_name`           | `product_filter`                   | Notes                                                         |
| -------------------- | ----------------------------------------- | ------------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| SQL Database         | `2 vCore General Purpose Serverless Gen5` | `2 vCore`                      | `General Purpose - Serverless`     | `skuName` is just vCore count; tier in `productName`.         |
| SQL Database         | `GP_S_Gen5_2`                             | `2 vCore`                      | `General Purpose - Serverless`     | Bicep/Terraform CAF form; strip prefix.                       |
| SQL Database         | `GP_Gen5_2`                               | `2 vCore`                      | `General Purpose - Compute Gen5`   | Provisioned variant — pick the non-Serverless filter.         |
| SQL Database         | `BC_Gen5_2`                               | `2 vCore`                      | `Business Critical - Compute Gen5` | Business Critical tier.                                       |
| App Service Plan     | `P1v3 Linux`                              | `P1 v3`                        | `Premium v3 Plan`                  | Strip OS suffix; `skuName` has a space before `v3`.           |
| App Service Plan     | `P0v3`                                    | `P0 v3`                        | `Premium v3 Plan`                  | Premium v3 entry-tier.                                        |
| App Service Plan     | `P2v3`, `P3v3`                            | `P2 v3`, `P3 v3`               | `Premium v3 Plan`                  | Same space-before-v3 rule.                                    |
| App Service Plan     | `P1mv3`, `P3mv3`                          | `P1mv3`, `P3mv3`               | `Premium v3 Plan`                  | Memory-optimized has **no space** — exception to the v3 rule. |
| App Service Plan     | `B1`, `B2`, `B3`                          | `B1`, `B2`, `B3`               | `Basic Plan`                       | No rewrite needed; product_filter required.                   |
| App Service Plan     | `S1 Linux`                                | `S1`                           | `Standard Plan`                    | Strip OS suffix.                                              |
| Storage Account      | `Standard ZRS`                            | `Standard_ZRS`                 | `General Block Blob`               | Underscore form is canonical.                                 |
| Storage Account      | `Standard LRS`                            | `Standard_LRS`                 | `General Block Blob`               | Same pattern.                                                 |
| Storage Account      | `Standard GRS`                            | `Standard_GRS`                 | `General Block Blob`               | Same pattern.                                                 |
| Storage Account      | `Premium LRS`                             | `Premium_LRS`                  | `Premium Block Blob`               | Premium block blob carries `Premium_LRS` only.                |
| Container Registry   | `Basic`, `Standard`, `Premium`            | `Basic`, `Standard`, `Premium` | `Container Registry`               | No rewrite; product_filter required.                          |
| Virtual Machine      | `D2sv5`, `D4sv5`                          | `D2s_v5`, `D4s_v5`             | `Dsv5 Series`                      | VM SKUs use underscore-v5 in `armSkuName`.                    |
| Virtual Machine      | `Standard_D2s_v5`                         | `D2s_v5`                       | `Dsv5 Series`                      | Strip `Standard_` prefix; bare ARM form is canonical.         |
| Log Analytics        | `PerGB2018`                               | `Standard`                     | `Log Analytics`                    | API name; PAYG SKU is `skuName: Standard`.                    |
| Application Insights | `Workspace-based`                         | `Basic`                        | `Application Insights`             | Classic AI; workspace-based bills via Log Analytics.          |

**Resolution rule**: if the input `sku_name` exactly matches a "Variant
input" cell or matches case-insensitively after stripping leading/trailing
whitespace, rewrite to the "Canonical `sku_name`" value and also set the
`product_filter` from the same row. Preserve the original verbose form in
the line's `notes` field for audit.

**No partial matches.** If the input doesn't appear in this table, the
subagent MUST NOT guess — record it in `<unresolved_sku_triage>` with the
top-3 closest matches and proceed with `status: FAILED` if pricing
cannot resolve.

## SKU naming gotchas (verified against the Retail Prices API)

| Common error                                    | Canonical Azure API skuName | Notes                                                                                  |
| ----------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `P1v3`, `P2v3`                                  | `P1 v3`, `P2 v3` (space)    | App Service Premium v3 SKUs have a space between digit and `v3` in `skuName`.          |
| `P1v4`, `P2v4`                                  | `P1 v4`, `P2 v4` (space)    | Same rule for Premium v4.                                                              |
| `P1mv3`, `P3mv3`                                | `P1mv3`, `P3mv3` (no space) | Memory-optimized Premium v3 SKUs (`m` for memory) have no space.                       |
| `D2sv5`                                         | `D2s_v5` (underscore)       | VM SKUs use underscore-v5 in `armSkuName`.                                             |
| `vCore General Purpose Serverless Gen5 2 vCore` | `2 vCore`                   | SQL Database `skuName` is just the vCore count; tier is in `productName`.              |
| `Premium v3 P1`                                 | `P1 v3`                     | The plan / tier wording is in `productName`, not `skuName`.                            |
| `Standard ZRS Hot LRS`                          | `Standard ZRS`              | Storage `skuName` carries redundancy only; access tier (Hot/Cool) is in `productName`. |
| `PerGB2018`                                     | `Standard`                  | Log Analytics Pay-As-You-Go is `skuName: Standard`, productName `Log Analytics`.       |
| `Workspace-based` (App Insights)                | `Basic`                     | Application Insights Classic; workspace-based AI bills through Log Analytics instead.  |

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

| Service                          | sku_name (canonical)                             | Required `product_filter`                                              | Typical meter                                   | Notes                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQL Database — GP Serverless     | `1 vCore` (always; per vCore-second billing)     | `General Purpose - Serverless`                                         | per `Hour` (compute)                            | Multiply hourly rate by max_vcore × utilization hours. Storage line is separate. Higher-vCore SKUs publish $0 "Free" meters only — see SQL Serverless quirk above. |
| SQL Database — GP Provisioned    | `N vCore` (Gen5)                                 | `General Purpose - Compute Gen5`                                       | per `Hour`                                      | For DTU model use sku `S0`/`S1`/`S2`/etc. with no `product_filter`                                                                                                 |
| SQL Database — Business Critical | `N vCore` (Gen5)                                 | `Business Critical - Compute Gen5`                                     | per `Hour`                                      |                                                                                                                                                                    |
| SQL Database — Hyperscale        | `N vCore` (Gen5)                                 | `Hyperscale - Compute Gen5`                                            | per `Hour`                                      |                                                                                                                                                                    |
| Storage — Block Blob Hot         | `Standard ZRS` / `Standard LRS` / `Standard GRS` | `General Block Blob`                                                   | `Hot {LRS,ZRS,GRS} Data Stored` per `GB/Month`  | Pass `gb_stored` usage; tier (Hot/Cool/Cold/Archive) comes from `productName`                                                                                      |
| Storage — Block Blob Cool        | `Standard ZRS` / `Standard LRS` / `Standard GRS` | `General Block Blob v2 Hierarchical Namespace` or `General Block Blob` | `Cool {LRS,ZRS,GRS} Data Stored` per `GB/Month` | Pass `gb_stored` usage                                                                                                                                             |
| Storage — Tables                 | `Standard LRS` etc.                              | `Tables`                                                               | `Data Stored` + transactions                    | Pass both `gb_stored` and `transactions_per_month`                                                                                                                 |
| Storage — Queues                 | `Standard LRS` etc.                              | `Queues v2`                                                            | transactions                                    | Pass `transactions_per_month`                                                                                                                                      |
| Storage — Files                  | `Standard LRS` etc.                              | `Files`                                                                | `GB/Month`                                      |                                                                                                                                                                    |
| Log Analytics — Pay-As-You-Go    | `Standard`                                       | `Log Analytics`                                                        | `Standard Data Analyzed` per `GB`               | Pass `gb_stored` usage as ingested GB/month                                                                                                                        |
| Log Analytics — Free             | `Free`                                           | `Log Analytics`                                                        | `Free Data Analyzed`                            | $0 — included in Log Analytics product                                                                                                                             |
| Bandwidth — Outbound Internet    | `Standard`                                       | `Bandwidth - Routing Preference: Internet`                             | `Standard Data Transfer Out` per `GB`           | First 100 GB/month free; pass `gb_transferred` for >100 GB                                                                                                         |
| Application Insights — Classic   | `Basic`                                          | `Application Insights`                                                 | per `GB` ingestion                              | Workspace-based AppInsights bills via Log Analytics, not here                                                                                                      |
| Front Door — Standard            | `Standard`                                       | `Azure Front Door Standard` (NOT `Premium`)                            | base + per `GB`                                 | Routing rules + requests + bandwidth — multiple meters. **Use `region: "global"`** — see `## Global services`              |
| Front Door — Premium             | `Premium`                                        | `Azure Front Door Premium`                                             | base + per `GB`                                 | **Use `region: "global"`**                                                                                                  |
| Azure DNS — Public zone          | `Public`                                         | (none)                                                                 | per zone/month + per million queries            | **Use `region: "global"`** — see `## Global services`. Pass `usage.transactions_per_month` for query volume.               |
| Azure DNS — Private zone         | `Private`                                        | (none)                                                                 | per zone/month + per million queries            | **Use `region: "global"`**. Catalog fallback at $0.50/zone/month if MCP returns no rows after the global-region retry.     |

> **Pattern**: when in doubt, query the Retail Prices API directly first
> (`https://prices.azure.com/api/retail/prices?$filter=serviceName eq '<name>' and armRegionName eq '<region>'`)
> to discover the exact `productName` and `skuName` values. The MCP simply
> wraps this API.

## Required: `usage` hints for non-hourly meters

The MCP cannot project a monthly cost from a meter like
`$0.023 per 1 GB/Month` without knowing how many GB. Pass the relevant
`usage` field in every resource entry whose meter is **not** hourly:

| Meter dimension | `usage` field            | Example value (defaults to plug in)               |
| --------------- | ------------------------ | ------------------------------------------------- |
| per GB/Month    | `gb_stored`              | Storage Hot Blob: from requirements; SQL data: 32 |
| per GB egress   | `gb_transferred`         | Bandwidth: from requirements (default 100)        |
| per 10K ops     | `transactions_per_month` | Key Vault: 10000; Storage Queues: 100000          |
| per second      | `seconds_runtime`        | ACR Build, Logic Apps consumption-style           |

Resources without a `usage` hint where the meter requires it will come
back with `monthly_cost: 0.0` and a `projection_warning` — that is **not**
a successful resolution and must be retried with the missing `usage`
field.

## Static-fallback whitelist (do NOT call MCP for these)

These resources have no meter — or a meter that is free at the volumes
this project will ever produce. Record them as `monthly_cost: 0.0` with
`hourly_rate: 0.0` and `notes: "static_fallback: <reason>"` **without**
spending an MCP call:

| Resource                                                | Cost              | Reason                                                                            |
| ------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| Virtual Network (base, no peering)                      | $0.00             | VNet itself has no recurring charge — only data processed via gateway/peering     |
| Network Security Group (NSG)                            | $0.00             | NSGs are free                                                                     |
| Route Table                                             | $0.00             | Free                                                                              |
| Microsoft Entra ID (workforce)                          | $0.00             | Free tier; P1/P2 only if explicitly purchased per-user                            |
| Microsoft Entra External ID (Free)                      | $0.00             | First 50,000 MAU/month free                                                       |
| Resource Group                                          | $0.00             | Free                                                                              |
| Managed Identity (system-assigned)                      | $0.00             | Free                                                                              |
| Action Group (email/SMS to ≤1 region, baseline volume)  | $0.00             | Apply default usage assumption (≤1,000 emails + ≤100 SMS/month) — both inside free tier; static-fallback at baseline; only price via MCP when parent explicitly supplies a higher monthly notification volume |
| Azure Budget                                            | $0.00             | Free — no charge for cost management                                              |
| Smart Detector Alert Rule (Failure Anomalies, default)  | $0.00             | Bundled with Application Insights at default configuration; static-fallback unless parent flags custom evaluation                                  |
| Diagnostic settings                                     | $0.00             | Free; ingestion charged via Log Analytics line                                    |
| App Service Custom Domain                               | $0.00             | Free; only TLS certificate has a cost (separate Storage line if SNI Cert is used) |
| Bandwidth (≤ first 100 GB/month outbound)               | $0.00             | Azure's free egress allowance applies before any per-GB charge                    |
| Log Analytics scheduled query rule alert (default)      | $1.50/mo per rule | Apply default usage assumption (1 monitored resource, 5-minute evaluation frequency) — Standard Log Search Alert Rule meter; catalog fallback when MCP returns no rows for `microsoft.insights/scheduledqueryrules`; parent must override if a rule monitors many resources or runs at higher frequency  |
| Private DNS Zone — base                                 | $0.50/mo per zone | **Catalog fallback** — price via MCP first using `service_name: "Azure DNS"`, `sku_name: "Private"`, **`region: "global"`** (see `## Global services`); if `azure_bulk_estimate` + `azure_price_search` still return no rows, record $0.50/zone/month with `notes: "static_fallback: Azure DNS private zone catalog rate; MCP returned no rows even with region=global"` and proceed (do not leave unresolved) |
| Private Endpoint                                        | $7.20/mo each     | Use MCP — Standard meter resolves cleanly under Virtual Network                   |

> The static-fallback whitelist is a closed list. If a resource is not on
> this whitelist, you **must** attempt to price it through the MCP — do
> not invent "free" entries.
>
> **Catalog-fallback rule**: rows tagged `Catalog fallback` (Private DNS
> Zone — base) MUST be priced via MCP first. Only when the MCP returns
> zero rows for the documented query shape may the agent record the
> catalog rate as a `static_fallback` line. This prevents a known
> MCP-index gap from forcing `status: FAILED` on low-cost ancillaries.
>
> **Usage-default rule**: rows tagged `default` (Action Group, Smart
> Detector Alert Rule, Log Analytics scheduled query rule) MUST be
> recorded at the listed cost when the parent supplies the resource
> without explicit usage telemetry. Parents only override the default
> when they have measured volume / frequency to supply.

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

    // Private DNS zones — GLOBAL meter, not regional. Passing the workload region returns 0 rows.
    { service_name: "Azure DNS", sku_name: "Private", region: "global", quantity: 3,
      usage: { transactions_per_month: 1000000 } }

    // Front Door Standard — also GLOBAL. Example shape (omitted from the test workload):
    // { service_name: "Azure Front Door", sku_name: "Standard", region: "global",
    //   product_filter: "Azure Front Door Standard",
    //   usage: { gb_transferred: 100, transactions_per_month: 10000000 } }

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

| Symptom                                                                        | Cause                                                                                                                | Workaround                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `azure_price_search` returns `count: 0` for SQL Database `S2` / `S0` / `S1`    | Day-based DTU meters (`unitOfMeasure: '1/Day'`) are filtered out by the MCP's SKU validator                          | Fetch the meter via direct Retail Prices API; multiply `retailPrice × 30` for monthly. Set `data_source` to include "+ direct API".                                                                                |
| `azure_bulk_estimate` returns `monthly_cost: 0` for multi-product services     | Missing `product_filter` per resource — `contains(skuName, …)` matches multiple products ambiguously                 | Always pass `product_filter` per the table in `## Required: product_filter for multi-product services` above.                                                                                                      |
| `azure_bulk_estimate` returns `monthly_cost: 0` + `projection_warning`         | Missing `usage` hint for a non-hourly meter (per-GB / per-transaction / per-second)                                  | Pass the relevant `usage` field per `## Required: usage hints for non-hourly meters` above.                                                                                                                        |
| App Service Premium v3 `P1v3` / `P2v3` returns 0                               | Azure's canonical `skuName` has a space: `P1 v3`, `P2 v3`                                                            | Use the space form. See `## SKU naming gotchas`.                                                                                                                                                                   |
| Azure DNS (`Private` / `Public`) or Front Door (`Standard` / `Premium`) returns 0 in any regional query | Meters are published with `armRegionName: "Global"`, not the workload region                                          | Set `region: "global"` on the bulk and any `azure_price_search` retry. See `## Global services` for the full list.                                                                                                  |
| SQL Database GP Serverless higher-vCore SKUs (e.g. `2 vCore`) return $0 meters | Azure publishes the billable per-vCore-second meter only under `1 vCore`; higher SKUs show only the free pause meter | Query `sku_name: "1 vCore"` with `product_filter: "General Purpose - Serverless"`, then compute `hourly_rate × max_vcore × utilization × 730`. See `## Service-specific billing quirks → SQL Database Serverless`. |

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
