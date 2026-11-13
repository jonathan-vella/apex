<a id="top"></a>

# Specification: APEX Cost Management v2.2 (Empirical Audit & Upstream Design)

> Implementation-ready upstream specification for `jonathan-vella/apex`, derived from instrumented execution of the
> 8-sheet NBB Group Cloud DR Retail ROM (`nbb-cloud-dr-rfi`) and cross-checked against `arcbox-insights` and
> `partner-modernization-factory-v2`.

**Status**: Active (Upstream PR Ready for `jonathan-vella/apex`)
**Owner**: `@jonathan-vella`
**Created**: 2026-11-13
**Evidence Source**: `agent-output/nbb-cloud-dr-rfi/pricing/telemetry-friction-log.json`

---

## 1. Executive Problem Statement

APEX's current retail cost engine (`tools/scripts/cost-estimate.mjs` + `fetch-retail-price-evidence.mjs`) achieves
strong cryptographic provenance (`pricing-request-binding-v1`, SHA-256 raw response capture, deterministic arithmetic)
for **small, single-region, single-state Consumption workloads** (`<= 15` SKUs, 24x7 `730h/mo`).

However, instrumenting an enterprise multi-region Disaster Recovery RFI (`nbb-cloud-dr-rfi`: `405` VMs, `407` Managed
Disks, `764 TiB` Blob/ADLS/Files, `22` RDS instances, `314` ASR instances, Cloud HSM, App Gateway, Front Door, Peering,
ExpressRoute/VPN, and `1-Yr`/`3-Yr` RIs + AHB across `uaenorth` and `swedencentral`) alongside prior workspace runs
(`arcbox-insights` and `partner-modernization-factory-v2`) exposed **11 concrete engine blockers** that currently force
**60% of enterprise billable lines (`84` of `141` SKU/meter lines)** outside `cost-estimate-v2`.

---

## 2. Measured Telemetry Baseline

### 2.1 Quantitative Evidence from `nbb-cloud-dr-rfi` (`telemetry-friction-log.json`)

| Metric                                |                       Measured Value | Architectural Implication                                                               |
| ------------------------------------- | -----------------------------------: | --------------------------------------------------------------------------------------- |
| **Source Workbook Scope**             |      `8` tabs (`340+` workload rows) | Mapped deterministically to `405` VMs + `407` Managed Disks + PaaS/BCDR/Storage         |
| **Total Distinct Priced Lines**       |          `141` (`57` WS2 + `84` WS3) | Cannot fit inside a single `MAX_SHARED_REQUESTS = 20` request or shared folder ledger   |
| **WS2 `cost-estimate-v2` Partitions** |          `9` isolated subdirectories | Required dynamic `<= 8` query-group chunking (`14` MCP calls + `2` direct fallbacks)    |
| **WS3 Blocked Lines Priced Directly** |     `84` lines (`41` 1-page queries) | Blocked from `cost-estimate-v2` by `G1`, `G3`, `G4`, `G9`, `G10`, `G11`, `G12`, `G13`   |
| **24x7 RI & Blob RC Quotes**          |  `20` VM buckets + `3` PaaS/Blob RCs | `100%` blocked in `cost-estimate-v2` by `G3` (`Consumption`-only hardcoding)            |
| **Catalog RI Absence Caught Live**    |      `Standard_F8s_v2` (`0` RI rows) | Blindly applying `%` RI rules would have fabricated unpurchasable FortiGate savings     |
| **vCPU-Only Sizing Errors Prevented** | `VMware r138`, `SQL VM 1` (`78 TiB`) | `4c/152 GB -> E20s_v5`; `8c/300 GiB/78 TiB -> E64-16ds_v5` (`16` SQL cores) + `3x P80`  |
| **HTTP `429` Rate-Limit Events**      |     Triggered at `0ms` burst (`G14`) | Eliminated (`0` failures across `41` queries) once `450ms` pacing + `Retry-After` added |
| **Total Evidence Footprint on Disk**  |               `3,872 KB` (`3.78 MB`) | Narrow OData `$filter` predicates kept `9` WS2 + `41` WS3 captures well under `5 MB`    |

### 2.2 Blocker Distribution Across the 84 Blocked WS3 Lines

| Gap ID       | Blocker Code                                 |           Affected Lines | Exact Source Location & Root Cause                                                                                                                                                                                                 |
| ------------ | -------------------------------------------- | -----------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G9**       | `MANAGED_DISK_STORAGE_RECIPE_COLLISION`      |                     `28` | `cost-estimate.mjs:64, 152, 1393`: Azure Retail puts Managed Disks under `serviceName="Storage"`; `"managed disks"` is missing from `SERVICE_QUERY_GROUP_ALIASES`, while `service_name="Storage"` forces Blob's 4-dimension recipe |
| **G1**       | `MISSING_SERVICE_RECIPE`                     |                     `20` | `cost-estimate.mjs:48-103`: `serviceRecipe()` returns `undefined` for `Azure Site Recovery`, `Backup`, `VPN Gateway`, `ExpressRoute`, `Azure Cloud HSM`, `Key Vault HSM Pool`, `Global VNet Peering`, `Email`, and `Load Balancer` |
| **G4**       | `SINGLE_ROW_NON_HOURLY_MCP_NULL_TIER`        |                     `20` | `cost-estimate.mjs:1417` & `fetch-retail-price-evidence.mjs:179`: `@azure/mcp` strips `tierMinimumUnits`; `cost-estimate.mjs` allows `null` only on fixed-hourly meters, while fallback requires `>= 2` distinct-rate rows         |
| **G12**      | `SLASH_HOUR_UNIT_REGEX`                      |                      `7` | `cost-estimate.mjs:721, 1158` & `pricing-evidence.mjs:370`: `/^(1\s*)?hours?$/i` rejects `unitOfMeasure="1/Hour"` used by `Service Bus Premium`, `Application Gateway v2`, and `Load Balancer`                                     |
| **G11**      | `MULTI_SKU_DB_COMPUTE_STORAGE_MISMATCH`      |                      `6` | `cost-estimate.mjs:1366, 1394`: `[skuName, armSkuName].includes(input.sku)` runs on every component, rejecting `PostgreSQL`/`MySQL`/`SQL MI` where Compute (`"4 vCore"`) and Storage (`"Storage"`) have distinct native SKUs       |
| **G10**      | `HOT_BLOB_NO_RETRIEVAL_METER`                |                      `4` | `cost-estimate.mjs:64, 1393`: `Storage` requires `egress_gb` under `serviceName="Storage"`, which exists on `Cool ZRS` (`Data Retrieval`) but **not** on `Hot LRS/ZRS` (billed under `Bandwidth`)                                  |
| **G13**      | `BYSTANDER_NON_HOURLY_MCP_ROW`               |                      `2` | `cost-estimate.mjs:1291`: `loadExactEvidence()` runs `rows.map(normalizeMeter)` across **all** rows in an MCP response, throwing if any unselected row (`1/Day` ACR, `1 GB` Bastion egress) lacks `tierMinimumUnits`               |
| **G8**       | `LINUX_PRODUCT_NAME_AND_MONTHLY_NULL_RECIPE` | _(Worked around in WS2)_ | `cost-estimate.mjs:1342, 1465`: `operating_system: "Linux"` requires `/\blinux\b/i` in `productName`, failing `"Virtual Machines Esv5 Series"`; null-recipe lines without `usage` reject `1/Month`                                 |
| **G2/G3/G5** | `PORTFOLIO_BUDGET_RI_AND_SCENARIOS`          |            `24` overlays | Per-SKU `queryGroups` cap (`20`), directory-shared ledger, `Consumption`-only lock (`line 1396`), and single-meter `calculateScenarios()` limits (`line 2278`)                                                                     |

### 2.3 Cross-Project Corroboration (`arcbox-insights` & `partner-modernization-factory-v2`)

- **`arcbox-insights` (`contracts/02-cost-estimate.json:52`)**: Had to exclude disks, Windows/SQL licensing uplifts,
  backup, networking, and Arc extensions as _"unpriced, not zero"_ because `G1`/`G3`/`G8`/`G9` prevented pricing them.
- **`partner-modernization-factory-v2` (`03-cost-management-report.md`)**: Highlighted the strict boundary between
  **ActualCost / AmortizedCost** telemetry (where empty subscription slices mean _"No rows"_, not `$0.00`, and MTD
  overlaps Forecast windows) and **user-declared / retail reference rates**, confirming that v2.2 must keep pre-deploy
  retail ROM artifacts (`cost-estimate-v2.2` / `cost-portfolio-v1`) structurally distinct from observed-spend contracts
  (`03-cost-management.json`).

---

## 3. Upstream Engine Upgrade Specifications (`C1`–`C6`)

### C1 — Expand `serviceRecipe()` & Decouple `rate-quote` (`tools/scripts/cost-estimate.mjs`)

1. **Decouple `rate-quote` (`validateBillableDimensions`, `lines 100-110`)**: Evaluate `if (purpose === "rate-quote")`
   **before** `const recipe = serviceRecipe(line)` so any valid Azure Retail `serviceName` with explicit `native_unit`
   and `meter_applicability` can be rate-quoted without code changes.
2. **Add First-Class BCDR, Hybrid, HSM & Analytics Recipes (`lines 56-97`)**:
   - `azure site recovery | site recovery` -> `["protected_instances"]` (`1/Month`)
   - `backup | azure backup` -> `["protected_instances", "vault_storage_gb"]` (allow `zero_usage_confirmed: true` when
     vault-only or instance-only)
   - `vpn gateway | virtual network gateways` -> `null` (fixed hourly gateway; optional `s2s_tunnels` supplemental)
   - `expressroute` -> `/gateway/i.test(line.product_name)` ? `null` : `["circuits"]` (plus optional `egress_gb`)
   - `azure cloud hsm | cloud hsm | payment hsm | microsoft azure payment hsm` -> `null` (fixed hourly HSM instance)
   - `key vault` -> `/hsm pool/i.test(line.product_name)` ? `null` : `[]`
   - `load balancer` -> `["hours"]` (with optional `overage_rules`, `processed_gb`)
   - `data factory` -> `["activity_runs", "diu_hours"]`; `synapse analytics | microsoft fabric` -> `null` (CU/DWU hours)
   - `virtual machines licenses` -> `null` (fixed hourly software license uplift)

### C2 — Fix Validator Traps (`G4`, `G8`, `G9`, `G10`, `G11`, `G12`, `G13`, `G14`)

1. **Fix `G8` (`cost-estimate.mjs:1342-1350`)**: For `operating_system: "Linux"` on `Virtual Machines`, assert
   `!/\bwindows\b/i.test(first.productName)` (and exclude `Cloud Services` unless requested) instead of requiring the
   substring `"Linux"`, matching Azure Retail's `"Virtual Machines Dsv5/Esv5/Edsv5 Series"` naming.
2. **Fix `G9` (`cost-estimate.mjs:64, 152`)**: Add `["managed disks", "Storage"]` and `["azure managed disks", "Storage"]`
   to `SERVICE_QUERY_GROUP_ALIASES`, and in `serviceRecipe()` match `managed disks` (or `/managed disks/i.test(line.product_name)`)
   **before** `/^(storage|storage account)/`, returning `null` with default `1/Month` (`amount: 1, unit: "months"`).
3. **Fix `G10` (`cost-estimate.mjs:64`)**: Change `Storage` recipe on `Hot` SKUs (`/hot/i.test(line.sku)`) to
   `["capacity_gb", "read_operations", "write_operations"]` (requiring `data_retrieval_gb` only on `Cool`/`Cold`/`Archive`),
   while keeping outbound internet egress on `Bandwidth`.
4. **Fix `G11` (`cost-estimate.mjs:1366, 1394`)**: Permit per-usage `sku` (`const targetSku = applicableUsage?.sku ?? input.sku`)
   so `PostgreSQL`, `MySQL`, `SQL Database`, and `SQL Managed Instance` can bind Compute (`sku: "Standard_D4ads_v5"`)
   and Storage (`usage[1].sku: "Storage"`) inside one logical resource.
5. **Fix `G12` (`cost-estimate.mjs:721, 1158`; `pricing-evidence.mjs:370, 377`)**: Update hourly unit regexes to
   `/^(1\s*\/?\s*)?hours?$/i` so `"1/Hour"` (`Service Bus`, `Load Balancer`) is recognized identically to `"1 Hour"`.
6. **Fix `G13` & `G4` (`cost-estimate.mjs:1291`; `fetch-retail-price-evidence.mjs:166-190`)**:
   - In `loadExactEvidence()`, read pre-validated `evidence.meter_rows` (or skip unreferenced bystander rows that lack
     `tierMinimumUnits`) so an unselected `"1 GB"` row in a broad MCP response never crashes an hourly meter capture.
   - In `fetch-retail-price-evidence.mjs`, extend `missing_tier_metadata` for non-hourly rows **only** when the captured
     MCP response is complete (`status === 200`, `prices.length < 100` proving MCP's 100-row ceiling did not truncate
     bands!) and binds the exact `(serviceName, productName, skuName, meterName)` of the selected meter, preserving full
     direct-page `NextPageLink === null` verification and adding negative tests for `>= 100`-row truncated MCP responses.
   - Add `400ms` inter-page pacing and single `Retry-After` backoff on HTTP `429`/`503` (`G14`), recording retry attempts
     transparently in `request-ledger.json`.

### C3 — Service/Region Query Coalescing & Parent-Scoped Request Ledgers

1. **Coalesced `queryGroups` (`cost-estimate.mjs:540-558`)**: Group `Virtual Machines`, `Managed Disks`, and `Storage`
   lines by `(normalizeQueryGroupService(service_name), region, currency, price_type)` up to `10` SKUs per `or`-filter
   call instead of hashing `1` group per `line.sku`. In `nbb-cloud-dr-rfi`, this reduces `50` VM SKU-OS buckets from
   `50` estimated groups to `7` regional queries!
2. **Parent-Scoped Budget Ledger + Immutable Per-Request Bindings (`pricing-evidence.mjs:205`)**: Retain a single
   durable project/portfolio budget ledger (`pricing-evidence/scope-budget-ledger.json`) shared across all revisions of
   `request.json` **so editing `request.json` can never reset request allowance**, while binding each individual capture
   to its immutable `request-${source_sha256}-${request_sha256}.json`. Support `request_budget_tier`: `"standard"` (`20`
   calls, Step 2 default) vs. `"portfolio"` (`60` calls, requires explicit owner-authorized `mode: "portfolio"`).

### C4 — Native `Reservation`, `SavingsPlan`, Blob RC & Licensing/AHB Verification (`cost-estimate-v2.2`)

1. Accept `price_type: "Consumption" | "Reservation"` in `validateLinkedPricing()` and `fetch-retail-price-evidence.mjs`.
   For `Reservation`, require matching `reservationTerm` (`"1 Year"` -> `/ 12`, `"3 Years"` -> `/ 36`) and verify that
   if `ri_available: false` is claimed (e.g., `Standard_F8s_v2`), the captured catalog page contains `0` reservation
   rows for that `armSkuName` + `armRegionName`.
2. **Cold-Standby RI Guardrail**: Reject any `Reservation` or `SavingsPlan` component attached to a line whose steady-state
   `hours_per_month < 730` unless `ri_breakeven_verified: true` proves `ri_monthly < payg_hourly * standby_hours`.
3. **OS AHB vs. SQL Server SA Passive DR Separation**:
   - `os_licensing: "payg" | "ahb-windows" | "ahb-rhel"`: for `"ahb-windows"`, link both the Windows and base Linux VM
     meters (or base `Reservation` meter) to publish exact evidenced AHB savings.
   - `db_licensing: "payg" | "byol" | "sa-passive-dr" | "sa-license-mobility"`: when `"sa-passive-dr"` is selected on
     `SQL Server`, allow `$0` standby SQL license while requiring a paired `active_failover_sql_payg_sensitivity` quote
     from `Virtual Machines Licenses` / `SQL Managed Instance - SQL License`.

### C5 — Multi-State Operational Profiles in `calculateScenarios()` (`cost-estimate.mjs:2250-2298`)

Extend `calculateScenarios()` to accept:

- `quantity: 0` (deallocated resources in Standby),
- `hours_per_month` overrides and `month1_factor` (`0` for ASR's 30-day free trial),
- Per-dimension overrides on multi-component lines (`{ dimensions: { egress_gb: 10240 } }`), and
- `baseline_scenario: "standby"` so drill scenarios (`drill_48h`) emit both absolute monthly cost and **incremental
  event burst delta** (`drill_total - standby_total`) automatically.

### C6 — Deterministic Workbook Bin-Packer & `cost-portfolio-v1` Rollup CLI

1. Promote `binpack_inventory.py` into `tools/scripts/inventory-to-sku-manifest.py` supporting `.xlsx`/`.csv` imports
   (RVTools, Azure Migrate, custom RFI workbooks), merged-cell preservation, simultaneous `vCPU + RAM + maxDataDiskCount`
   sizing, constrained-vCPU DB selection, `> 32 TiB` disk striping, non-x86 routing (`Power9` -> Skytap, `SPARC` ->
   Charon-SSP), and cross-sheet overlap ledgers.
2. Add `tools/schemas/cost-portfolio-v1.schema.json` + `tools/scripts/cost-portfolio.mjs` to aggregate multiple
   regional `cost-estimate-v2.2` bundles, sensitivity bands, and non-1P Partner/Marketplace BYOL schedules.

---

## 4. Cross-Surface Contract, Migration & Compatibility Matrix (`RD-10`)

| APEX Surface                                | Upstream File(s)                                                                                                                                                          | Required v2.2 Update & Backward Compatibility                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SKU Manifest (`sku-manifest-v1`)**        | `tools/schemas/sku-manifest.schema.json`, `tools/scripts/render-sku-manifest-md.mjs`, `.github/instructions/sku-manifest.instructions.md`                                 | Add optional `disks[]` (striped disk array), `operational_profiles` (`standby_hours`, `failover_hours`, `drill_hours`), `active_licensing_cores` (constrained vCPU), and `licensing_posture` (`payg \| ahb \| byol \| sa-passive-dr`). Existing v1 manifests without these fields remain 100% valid.               |
| **Architect ↔ Pricing Subagent**            | `.github/agents/03-architect.agent.md` (`lines 219-297`), `.github/agents/_subagents/cost-estimate-subagent.agent.md` (`lines 24-36`), `cost-estimate-parent-contract.md` | Allow `03-Architect` to pass `mode: "portfolio"` (`pricing/<domain>/cost-estimate.json` + `contracts/02-cost-portfolio.json`); expand `cost-estimate-subagent` write allowlist to `agent-output/{project}/pricing/**` and `contracts/02-cost-*.json`; preserve explicit `partner_schedule[]` outside 1P subtotals. |
| **Cost-Feasibility Challenger**             | `.github/agents/_subagents/challenger-review-subagent.agent.md`, `adversarial-review-protocol.md`                                                                         | Add 4 deterministic checks to the `cost-feasibility` lens: (1) flag RIs applied to `< 730h` cold DR compute; (2) flag `> 32 TiB` storage on a single disk; (3) require cross-sheet overlap & post-dedup sensitivity disclosure on imported workbooks; (4) verify passive-vs-active SQL DR licensing treatment.     |
| **IaC Budgets vs. FinOps Spend**            | `05-IaC Planner`, `06b`, `06t`, `apex-azure-cost-optimization`                                                                                                            | Feed `standby_monthly_total` (not `active_failover_total`) into `Microsoft.Consumption/budgets` steady-state alert thresholds (with a separate `failover_burst_threshold` alert), while keeping observed `ActualCost`/`AmortizedCost` (`03-cost-management.json`) strictly read-only in Assessment/FinOps.         |
| **Legacy `cost-estimate-v2` Compatibility** | `tools/scripts/cost-estimate.mjs`                                                                                                                                         | Accept both `cost-estimate-v2` and `cost-estimate-v2.2` in `validateEstimate()` (`v2` keeps Consumption-only semantics; `v2.2` enables C1-C5).                                                                                                                                                                     |

---

## 5. Upstream PR File List & `node:test` Acceptance Matrix (`jonathan-vella/apex`)

### 5.1 Files to Touch in Upstream PR

1. `tools/scripts/cost-estimate.mjs` & `tools/scripts/_lib/pricing-evidence.mjs` (`C1`–`C5`)
2. `tools/scripts/fetch-retail-price-evidence.mjs` (`C2` single-row non-hourly fallback, `400ms` pacing / `429` retry,
   and `C4` Reservation support)
3. `tools/scripts/inventory-to-sku-manifest.py`, `tools/scripts/cost-portfolio.mjs`, and
   `tools/schemas/cost-portfolio-v1.schema.json` (`C6`)
4. `tools/schemas/sku-manifest.schema.json` & `tools/scripts/render-sku-manifest-md.mjs`
5. `.github/agents/03-architect.agent.md`, `.github/agents/_subagents/cost-estimate-subagent.agent.md`, and
   `.github/agents/_subagents/challenger-review-subagent.agent.md`
6. `.github/skills/apex-azure-defaults/references/pricing-guidance.md` & `cost-estimate-parent-contract.md`
7. `tools/tests/scripts/test_cost_estimate_v2_2.mjs` & `tools/tests/scripts/test_inventory_binpacker.py`

### 5.2 Required Automated Test Cases (`test_cost_estimate_v2_2.mjs`)

1. **`G8` Linux VM Product Naming**: Validates `"Virtual Machines Edsv5 Series"` with `operating_system: "Linux"` passes
   while `"Virtual Machines Edsv5 Series Windows"` is rejected.
2. **`G9` Managed Disks Alias & Recipe**: Validates `service_name: "Managed Disks"` binds cleanly to native
   `serviceName: "Storage"`, `productName: "Premium SSD Managed Disks"`, `unitOfMeasure: "1/Month"`.
3. **`G10` Hot vs. Cool Blob**: Validates `Hot LRS` without `Data Retrieval` and `Cool ZRS` with `Data Retrieval`.
4. **`G11` Multi-SKU PaaS DB**: Validates a single `PostgreSQL` line with `Standard_D4ads_v5` compute + `Storage` GB/mo.
5. **`G12` & `G13` Slash-Hour & Bystander Rows**: Validates `Service Bus` `"1/Hour"` and ignores unselected `"1 GB"`
   rows in multi-row MCP captures.
6. **`G1` BCDR & Universal `rate-quote`**: Validates `Azure Site Recovery` (`month1_factor: 0`), `Azure Cloud HSM`,
   `VPN Gateway`, `ExpressRoute`, and arbitrary `purpose: "rate-quote"` services.
7. **`C4` RI & Cold-Standby Guardrail**: Validates 3-Year RI `/ 36` amortization on `730h` VMs, verifies
   `ri_available: false` when catalog has zero RI rows, and rejects RI on `0h` standby VMs.
8. **`C5` Multi-State Scenarios**: Validates `standby` (`0h`), `drill_48h` (`incremental` delta), and `failover` (`730h`).

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
