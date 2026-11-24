<!-- ref:pricing-and-workbook-engineering-v1 -->

# Pricing Accuracy, Deterministic Generators & Fail-Closed Excel Engineering

Engineering rules for Azure retail pricing provenance (`RD-02`, `RD-07`), generator-first artifact reproducibility, fail-closed Excel AST `<v>` cache evaluation (`RD-03`), customer OOXML template preservation (`RD-04`), and binary-vs-decimal sizing math.

## 1. Pricing Accuracy Gate (`RD-02`, `RD-07`)

### Primary Route: `cost-estimate-subagent` + `cost-estimate.mjs`

Every user-facing Azure retail figure MUST originate from `cost-estimate-subagent` under the parent contract in [`.github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md`](../../apex-azure-defaults/references/cost-estimate-parent-contract.md):

| Pursuit Scenario | `cost-estimate-subagent` Request Mode | Output Contract | Allowed Downstream Use |
| --- | --- | --- | --- |
| Known SKU quantities + known/assumed monthly usage | Default `purpose: "monthly-estimate"` | `cost-estimate-v2` JSON + raw MCP/retail evidence | Full monthly/annual ROM BoQ, scenario arithmetic, executive totals |
| RFI / rate-card schedule with unknown monthly usage | `purpose: "rate-quote"` | `retail-rate-quote-v1` JSON (native units + complete tier bands, no workload total) | Indicative unit-rate schedules only (never fabricated monthly totals) |

1. Persist the complete pricing request JSON in `agent-output/{project}/_meta/` and run preflight before dispatch:

   ```bash
   node tools/scripts/cost-estimate.mjs preflight \
     --request agent-output/<project>/_meta/pricing-request.json
   ```

2. Invoke `cost-estimate-subagent` with `request_path` and `output_path` (`agent-output/{project}/contracts/pursuit-cost-estimate.json`). If `cost-estimate-subagent` is unavailable or returns `FAILED`, **STOP** (`RD-09`) and surface `unresolved_items[]`—never substitute parametric memory or manual calculator estimates.

### Supplemental Validation: `scripts/audit_pursuit_skus_and_rates.py`

[`../scripts/audit_pursuit_skus_and_rates.py`](../scripts/audit_pursuit_skus_and_rates.py) validates the subagent bundle and executes constrained, `SHA-256`-logged supplemental checks against the public Azure Retail Prices API (`https://prices.azure.com/api/retail/prices`) for commitment and multi-band schedules:

- **Reserved Instance (`1 Year` / `3 Years`) & Compute Savings Plan Comparisons**: Verifies `type == "Reservation"` (`reservationTerm` in `1 Year`, `3 Years`) and `savingsPlan` retail records alongside `Consumption` PAYG baselines, storing exact query URLs, retrieval timestamps, and raw-response `SHA-256` hashes.
- **Exclude `DevTestConsumption` (Mandatory)**: Always reject records where `priceType == "DevTestConsumption"` or `skuName` / `productName` targets Dev/Test offers so discounted non-production rates never enter commercial customer bids.
- **Explicit Unit & Tier Normalization**:
  - Per-`10K` transaction meters (`unitOfMeasure == "10K"` or `"10,000"`): divide monthly operations by `10_000`.
  - Per-`1M` request/operation meters (`unitOfMeasure == "1M"`): divide monthly operations by `1_000_000`.
  - Hourly compute/gateway meters (`unitOfMeasure == "1 Hour"`): multiply continuous monthly runtime by `730` hours/month (or explicit scheduled runtime hours when documented).
  - Tiered marginal meters (`tierMinimumUnits > 0`): accumulate each consumption slice across sorted `tierMinimumUnits` bands rather than multiplying total volume by a single top-band or zero-band rate.
- **`Global` and `Zone 1` Networking Meters**: Public egress, Inter-Region/Global VNet Peering, Azure DNS / Private DNS queries, and ExpressRoute meters frequently bill under `armRegionName == ""` (`location == "Global"`, `"Zone 1"`, or documented billing zones) instead of `swedencentral` or `germanywestcentral`. Match the documented billing scope explicitly rather than failing or mispricing regional filters.
- **Fail-Closed `UNRESOLVED` Sentinel (Never `$0.00`)**: Whenever a meter returns zero records, multiple ambiguous SKUs without a deterministic selector, or lacks commercial 1P coverage, emit `"UNRESOLVED"` (or `"PARTNER QUOTE REQUIRED"` for partner/3P scope) in the JSON contract and `.xlsx` cost column—**never** `$0.00`. A `$0.00` cell silently passes `SUM()` while understating the bid.

## 2. Generator-First Reproducibility

Never hand-edit derived deliverables (`.xlsx`, `.pptx`, `.png`/`.svg`, `.md` ROM summary tables, or `.zip` bundles):

1. Store verified pricing outputs in `agent-output/{project}/contracts/`.
2. Write deterministic Python generator scripts in `agent-output/{project}/generators/` (for example `build_rom_workbook.py`, `render_pursuit_tables.py`, `build_exec_deck.py`) that read the JSON contract and emit `.xlsx` formulas, Markdown tables, and slide figures from one shared data model.
3. On any scope, quantity, FX, or SKU change, update the contract/generator and regenerate all downstream artifacts, then verify zero headline drift with [`../scripts/verify_pursuit_package.py`](../scripts/verify_pursuit_package.py).

## 3. Fail-Closed Excel AST, `<v>` Cache & OOXML Preservation (`RD-03`, `RD-04`)

### Why Deterministic `<v>` Cache Injection Is Mandatory

`openpyxl` writes `<f>` formula strings without evaluating them, leaving `<v>` cached-value elements absent. Headless previewers, SharePoint/Teams mobile viewers, Python audit scripts, and procurement ingestion tools read empty/zero values unless `<v>` nodes are deterministically populated. [`../scripts/xlsx_ast_cache.py`](../scripts/xlsx_ast_cache.py) parses every formula into an explicit AST, evaluates topological dependencies, and writes typed `<v>` elements back into the `.xlsx` archive.

### Supported Formula Grammar & Fail-Closed `UnsupportedFormulaError` (`RD-03`)

- **Supported Subset**:
  - Literals: numbers, quoted strings (`"..."`, escaped `""`), booleans (`TRUE`, `FALSE`)
  - Operators: `+`, `-`, `*`, `/`, `^`, unary `+`/`-`, postfix `%`, string `&`, comparisons (`=`, `<>`, `<`, `<=`, `>`, `>=`)
  - References: relative/absolute A1 cells and 2D ranges (`B12`, `$C$4:$C$50`, `'Assumptions & Controls'!$B$6`, `'Year 1 BOM'!D5:D42`), plus workbook/sheet defined names resolving to single cells or 2D ranges
  - Deterministic functions: `SUM`, `SUMIF`, `SUMIFS`, `SUMPRODUCT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `IF`, `IFS`, `IFERROR`, `AND`, `OR`, `NOT`, `MIN`, `MAX`, `AVERAGE`, `COUNT`, `COUNTA`, `COUNTIF`, `INDEX`, `MATCH`, `CHOOSE`, `ABS`, `INT`, `MOD`
- **Fail-Closed Rejection (`UnsupportedFormulaError`)**:
  - Any unknown/volatile function (`OFFSET`, `INDIRECT`, `NOW`, `TODAY`, `RAND`, `XLOOKUP` spill arrays), 3D multi-sheet span (`Sheet1:Sheet4!B2`), structured table syntax (`TblBOM[Monthly]`), shared formula without expanded cell expression (`<f t="shared" si="..."/>` follower), dynamic/CSE array formula (`<f t="array">`), external workbook link (`[1]Sheet1!A1`), circular dependency, or Excel error result (`#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#N/A`) raises `UnsupportedFormulaError` and exits non-zero. Never silently skip an unsupported formula or leave stale `<v>` caches behind.

### `xl/workbook.xml` + `xl/_rels/workbook.xml.rels` Worksheet Path Resolution

Never assume the first tab in `xl/workbook.xml` maps to `xl/worksheets/sheet1.xml`! Customer BAFO templates routinely insert, delete, and reorder tabs so `<sheet name="Summary" sheetId="9" r:id="rId4"/>` maps via `xl/_rels/workbook.xml.rels` to `worksheets/sheet6.xml` (or rooted `/xl/worksheets/custom.xml`). Always resolve:

1. `<sheets><sheet name="..." r:id="..."/></sheets>` in `xl/workbook.xml`
2. Matching `<Relationship Id="..." Target="..."/>` in `xl/_rels/workbook.xml.rels` normalized relative to `xl/`

### Typed `<v>` Cache Attributes & Excel `ROUND_HALF_UP`

- **Exact OOXML Cell Value Typing**:
  - Numeric formula result: omit `t` attribute (or `t="n"`) and write `<v>{canonical_decimal}</v>` after `<f>...</f>`.
  - String formula result (for example `IF(B5="UNRESOLVED","PARTNER QUOTE REQUIRED",...)` when sentinel branch triggers): set `t="str"` on `<c>` and write XML-escaped `<v>PARTNER QUOTE REQUIRED</v>`.
  - Boolean formula result: set `t="b"` on `<c>` and write `<v>1</v>` (`TRUE`) or `<v>0</v>` (`FALSE`).
- **Excel Half-Up Rounding**: Perform decimal rounding in `ROUND(x, digits)` using `decimal.Decimal` with `ROUND_HALF_UP` (away from zero on `.5`), matching Desktop Excel rather than Python's `round()` (`ROUND_HALF_EVEN`).

### Control-Cell Permutation Check

`xlsx_ast_cache.py` supports perturbing control cells on `Assumptions_&_Controls` (for example toggling `FX_Rate` or `Variance_Buffer_Pct` in memory without mutating the saved file) to confirm headline totals recompute dynamically rather than hiding hardcoded constants inside summary tabs.

### Customer Schedule OOXML Preservation (`--compare-template`, `RD-04`)

For `bafo_customer_schedule`, run:

```bash
python3 .github/skills/apex-rfi-rfp/scripts/xlsx_ast_cache.py \
  --workbook agent-output/<project>/deliverables/bafo-schedule.xlsx \
  --compare-template agent-output/<project>/source-archive/customer-schedule.xlsx \
  --report agent-output/<project>/_meta/bafo-xlsx-audit.json
```

`--compare-template` fails closed on any unauthorized mutation to:

- Worksheet names, count, order, `sheetId`, and visibility (`state="hidden"` / `"veryHidden"`)
- Non-worksheet relationships and parts (tables, pivot caches, drawings, logos, `customXml`, macros/VBA if `.xlsm`)
- `<mergeCells>`, `<dataValidations>`, `<conditionalFormatting>`, `<definedNames>`, `<sheetProtection>`, and `<workbookProtection>`
- Existing customer `<f>` formulas on protected/summary cells

### Fail-Closed `>255`-Char Header & Footer Guard (`RD-04`)

Desktop Excel raises an XML repair warning (`Removed Records: Header and footer properties`) and strips page setup metadata whenever `<oddHeader>`, `<oddFooter>`, `<evenHeader>`, `<evenFooter>`, `<firstHeader>`, or `<firstFooter>` exceeds **`255` characters** (counting Excel formatting control codes such as `&L`, `&C`, `&R`, `&D`, `&P`, and `&"Segoe UI,Regular"&8`). Keep every header/footer string concise (`<= 255` chars); `xlsx_ast_cache.py` fails closed if any header/footer element exceeds `255` characters.

## 4. Explicit Decimal `TB` (`10^12`) vs. Binary `TiB` (`2^40`) Storage & Seeding Math

Solicitation inventories almost always report storage in decimal terabytes (`TB` = $10^{12}$ bytes) or gigabytes (`GB` = $10^9$ bytes), whereas Azure Managed Disks (`P30` = `1024 GiB` = `1 TiB`), Azure Files, Azure NetApp Files, and backup vaults provision and bill in binary gibibytes/tebibytes (`GiB` = $2^{30}$, `TiB` = $2^{40}$):

- **Conversion Factors**:
  $$1\text{ TiB} = 2^{40}\text{ bytes} \approx 1.09951\text{ TB}, \qquad 1\text{ TB} = 10^{12}\text{ bytes} \approx 0.90949\text{ TiB} = 931.32\text{ GiB}$$
  Ignoring the ~`9.95%` gap either over-allocates disk tiers or under-sizes volume capacity when customer numbers are actually `TiB` labeled as `TB`. State both `TB (10^12)` and `TiB (2^40)` columns explicitly in storage sizing tables, or flag unit ambiguity as `customer-reported` / `vendor confirmation required`.
- **WAN Seeding & DR Replication Bandwidth Math**:
  Convert byte payloads cleanly to bits and account for protocol/TLS/TCP overhead (`efficiency_factor` typically `0.75`–`0.85`, never `1.0` raw line rate):
  $$\text{Transfer Seconds} = \frac{\text{Payload Bytes} \times 8}{\text{Circuit bps} \times \text{Efficiency Factor}}$$
  Verify initial seeding windows and steady-state peak replication churn (`RPO` window bytes) against the exact `ExpressRoute` or `VPN Gateway` SKU throughput limit.
