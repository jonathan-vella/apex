<!-- ref:pricing-guidance-v2 -->

# Azure Resource Manager MCP Pricing Guidance

Use the official Azure Resource Manager MCP `get_retail_prices` tool for
planned-resource prices. It returns raw Azure Retail Prices API records; the
caller selects meters and calculates totals.

## Connection

The workspace registers `https://mcp.management.azure.com` with the optional
`CostManagement` toolset. Pricing is public, while cost, forecast, benefit, and
pricesheet tools use the signed-in user's Azure permissions.

APEX cost agents use read-only pricing and cost tools. They do not use ARM MCP
deployment, resource mutation, or `create_budget` tools.

## Query contract

Pass only filters needed to identify the intended meter:

| ARM MCP parameter | APEX input | Purpose |
| --- | --- | --- |
| `serviceName` | `service_name` | Azure Retail Prices service name |
| `armSkuName` | `sku` | ARM SKU, such as `Standard_D4s_v5` |
| `armRegionName` | `region` | Retail catalog region |
| `meterName` | `meter_name` | Optional meter disambiguation |
| `priceType` | requirement | Usually `Consumption` |
| `currencyCode` | requirement | Defaults to `USD` |

Group identical parameter sets and call `get_retail_prices` once per group.
Follow `NextPageLink` when a complete result set is required. Reuse returned rows
across quantities and candidate comparisons.

## Evidence reuse

Reuse persisted COMPLETE pricing only when the source evidence is available,
its `queried_at` is not future-dated and is within `APEX_SKU_PRICING_TTL_DAYS`
(default 30 days), and no explicit refresh or known catalog change invalidates it.
Missing timestamps, meter provenance, or calculation inputs require fresh pricing.

For a whole estimate, compare the current effective deployment lines with the
persisted inputs: service, SKU, deployment region, environment/stamp identity,
quantity, usage, commitment/price type, currency, selected product/meter/unit,
and planned versus deployed scope. Reuse only when all are equivalent. A matching
file path or unchanged manifest revision alone is insufficient. Do not replace
actual deployed inventory with a planned estimate.

Current raw meter evidence may be reused for an identical query and meter
selection even when quantities change, but recalculate every affected total.
Retain the original query timestamp and provenance in notes; never restamp old
rates as newly queried. If persisted evidence cannot establish equivalence,
query again within the existing call budget. Reuse does not waive independent
cost-feasibility review or caller approval gates.

## Manifest quantities

Expand each service for every applicable top-level `environments[]` entry.
Apply sparse `environment_overrides` over the base service, then any stamp's
`service_overrides`; inherit unspecified nested fields rather than replacing
an entire capacity or commitment object. Stamps represent independent deployments:
use each stamp's environments (or the top-level set when omitted) and regions.
Without stamps, use the effective service's regions. Never select only the first
region or price only the base capacity. If placement is ambiguous, fail the line
instead of assuming a Cartesian deployment or silently omitting a region.

Emit separate deployment lines identified in `name`/`notes` by service id,
environment, stamp when present, and deployment region. Query deduplication
shares rates, not deployment quantities. Global catalog-region substitution
does not collapse independently billed deployments. Shared resources must have
explicit placement/quantity evidence to avoid counting them once per environment.

Use effective `size`, `capacity.default`, commitment, and explicit usage. For
autoscaling, record the assumed billable capacity; min/max alone is not average
usage. Usage must say whether it is per instance or already aggregated so it is
not multiplied by quantity twice. Missing placement, capacity, commitment meter,
or usage evidence leaves the affected line unresolved. Region comparisons and
candidate alternatives are not additional deployed resources in `monthly_total`.
Manifest writeback is the sum of that service's deployment lines only.

## Service names

Use the service names returned by the Retail Prices API. Common APEX services:

| Azure service | `serviceName` |
| --- | --- |
| API Management | `API Management` |
| App Service | `Azure App Service` |
| Application Gateway | `Application Gateway` |
| Azure Bastion | `Azure Bastion` |
| Azure DNS | `Azure DNS` |
| Azure Firewall | `Azure Firewall` |
| Azure Functions | `Functions` |
| Azure Monitor | `Azure Monitor` |
| Container Apps | `Azure Container Apps` |
| Container Instances | `Container Instances` |
| Container Registry | `Container Registry` |
| Cosmos DB | `Azure Cosmos DB` |
| Data Factory | `Azure Data Factory v2` |
| Front Door | `Azure Front Door` |
| Key Vault | `Key Vault` |
| Log Analytics | `Log Analytics` |
| MySQL Flexible Server | `Azure Database for MySQL` |
| PostgreSQL Flexible Server | `Azure Database for PostgreSQL` |
| Service Bus | `Service Bus` |
| SQL Database | `SQL Database` |
| Static Web Apps | `Azure Static Web Apps` |
| Storage | `Storage` |
| Virtual Machines | `Virtual Machines` |
| VPN Gateway | `VPN Gateway` |

Do not guess a service name. If an exact query returns no rows, retry once with a
broader documented filter and inspect returned names. Otherwise fail the line.

## SKU normalization

`armSkuName` is the deployed ARM SKU, not a display label. Apply only these
well-known mechanical mappings:

| Input | `armSkuName` |
| --- | --- |
| `D2s_v5` | `Standard_D2s_v5` |
| `D4s_v5` | `Standard_D4s_v5` |
| `P1v3` | `P1v3` |
| `P2v3` | `P2v3` |
| `Standard ZRS` | `Standard_ZRS` |
| `Standard LRS` | `Standard_LRS` |
| `Standard GRS` | `Standard_GRS` |

Prefer the `sku-manifest.json` `size` value when it already contains the ARM
SKU. Do not implement fuzzy matching or propose aliases from unrelated rows.

## Region handling

Use Azure region slugs such as `swedencentral` and `westeurope`. Some global
services publish an empty or `Global` ARM region. For Azure DNS, Front Door,
Traffic Manager, Microsoft Entra ID, and Microsoft Defender for Cloud, query
without `armRegionName` first and select the global meter. Record this in the
line notes.

Never substitute another deployment region silently. A requested regional
comparison requires separate identical queries with only `armRegionName`
changed.

## Meter selection

A returned row is usable only when its service, ARM SKU, region, product, meter,
price type, currency, and operating-system variant match the requested resource.

- Default to `Consumption`; exclude `DevTestConsumption` and Spot unless asked.
- Use `meterName` when one product contains unrelated billing dimensions.
- Sum component meters when a service bills separately for compute, storage,
  requests, transactions, or transfer.
- Record `productName`, `meterName`, `unitOfMeasure`, `priceType`, currency, and
  `tierMinimumUnits` in line-item notes.
- Fail on multiple plausible rows unless explicit usage or `meter_name`
  identifies the intended meter.

## Monthly calculations

Use the returned `retailPrice` and `unitOfMeasure`:

| Unit | Calculation |
| --- | --- |
| `1 Hour` | `price * 730 * quantity` |
| `1/Month` | `price * quantity` |
| `1 GB/Month` | `price * gb_stored * quantity` |
| `1 GB` | `price * gb_transferred * quantity` |
| `10K` operations | `price * operations / 10000 * quantity` |
| `1M` operations | `price * operations / 1000000 * quantity` |

Require explicit usage for variable meters. Requirements or deployed telemetry
may provide it; otherwise mark the line unresolved. Do not convert absent usage
to zero.

For tiered rows, sort by `tierMinimumUnits` and apply each rate only within its
band. If the returned rows do not define the bands sufficiently, fail closed.

A zero-cost line is valid only when a matching returned meter has
`retailPrice: 0`, or the Azure service itself has no charge. Usage-dependent
charges around a free control-plane resource remain separate lines.

## Actual costs and forecasts

Use `query_costs`, `query_aks_costs`, and `forecast_costs` only for authenticated,
deployed scopes. They provide actual or forecast subscription costs and do not
replace retail-price queries for proposed resources.

Use benefit-utilization and recommendation tools only when the parent requests
reservation or savings-plan analysis and supplies an authorized deployed scope.

## Unsupported legacy capabilities

ARM MCP does not expose APEX's former custom bulk estimate, region recommendation,
fuzzy SKU discovery, customer discount, PTU sizing, Databricks pricing, GitHub
pricing, Spot history, eviction simulation, or orphan-resource tools. Do not
recreate these capabilities in prompts. Use official service-specific sources in
a separate workflow when such analysis is required.

## Failure rule

Retry one transient timeout once. A missing row, ambiguous meter, missing usage,
authentication failure, or exhausted call budget leaves the resource unresolved
and forces the cost estimate to `FAILED`. Never substitute model knowledge for a
price.
