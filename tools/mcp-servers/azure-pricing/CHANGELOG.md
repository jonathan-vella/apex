# Changelog

All notable changes to the Azure Pricing MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on dates.** Entries up to and including v4.0.0 carry the date the
> upstream project last batch-edited them (`2026-03-03`); the actual chronological
> order of v3.x releases is approximate. From v5.0.0 onward, dates reflect the
> actual fork-release date in this repository.

## [5.4.0] - 2026-05-09

> **Usage-aware projection release.** Closes the gap between v5.3 and the
> [`bmit-2026/malta-catering`](https://github.com/jonathan-vella/bmit-2026/blob/main/agent-output/malta-catering/03-des-cost-estimate.md)
> reference cost estimate. v5.3 fixed unit projection but couldn't price
> transaction-based or storage-retention meters without explicit usage data;
> v5.4 adds the data path. Verified within 5% of the reference on a 7-line
> 8-resource workload (the remaining gap is Storage Tables write ops where
> the reference's $0.0325/10K rate is no longer in the Azure API).

### Added

- **`usage` parameter** on `estimate_costs` and per-resource on
  `azure_bulk_estimate`. Supplies workload estimates so non-time-based
  meters can be projected:
  - `transactions_per_month` — applied to per-10K/1M transaction meters
    (e.g. Key Vault Operations, Storage Tables write ops).
  - `gb_stored` — applied to per-GB/month storage-retention meters.
  - `gb_transferred` — applied to per-GB egress meters.
  - `seconds_runtime` — applied to per-second meters (e.g. ACR build tasks).

  Without `usage`, those meters still return $0 with a warning (v5.3
  behaviour preserved).

- **`product_filter` parameter** on `estimate_costs` and per-resource
  on `azure_bulk_estimate`. Substring match against `productName` so
  multi-product services like Storage Account (Tables / Block Blob /
  Queues / Files share the same skuName) can be modelled as separate
  line items with their own usage assumptions.

- **Zero-cost service static fallbacks** in `_STATIC_FALLBACK_PRICES`:
  - Virtual Network Standard (no per-VNet base charge).
  - Resource Group (organisational container).
  - Managed Identity (only authenticated resources cost money).

  Without these, v5.3's meter selector matched unrelated meters
  (e.g. "Virtual Network Standard" → "Public IP Prefix Standard" at
  $0.006/hr → bogus $4.38/mo).

### Changed

- **Static-fallback check moved BEFORE the API search.** v5.3 only
  consulted the fallback table when the API returned no results, which
  caused VNet/RG to match unrelated meters. v5.4 checks fallbacks
  first, then falls through to the API when no rule matches.

- **`select_primary_meter` is `usage`-aware.** When usage is supplied
  with a dimension-matching key, meters whose dimension matches a
  _supplied_ key are promoted to the top of the dimension ranking
  (e.g. TRANSACTIONS meters out-rank GB_MONTH when
  `usage.transactions_per_month` is set).

- **Tie-break direction switches when usage is supplied.** v5.3 used
  descending price (right for surfacing the actual SKU rate over
  $0.0001 add-ons). v5.4 uses ascending price within the matching
  dimension when usage is supplied, because the cheapest matching
  meter is usually the typical baseline rate (Key Vault Operations
  $0.03/10K vs Renewals $0.15/10K).

- **Private Endpoint static fallback** tuned to Microsoft's published
  flat $7.20/PE/month from the public pricing page. v5.3 used
  $0.01/hr × 730 = $7.30 (close but not what Microsoft publishes).

- **`_lookup_static_fallback`** now supports rules with empty `sku_match`
  (catch-all per service, used for Resource Group / Managed Identity).

### Verification

- 269 tests pass (was 255; +14 new regression tests in
  `tests/test_usage_aware_projection.py`).
- Reproduction of the bmit-2026/malta-catering reference workload now
  returns **$147.22/mo** vs the reference's **$154.87/mo** (95% match).
  The $7.65 gap is the Storage Tables write-ops line: reference used
  $0.0325/10K ($8.45/mo); current Microsoft API returns $0.00036/10K
  for swedencentral Standard LRS ($0.09/mo). v5.4 uses live API data
  so the result is more accurate.

## [5.3.0] - 2026-05-09

> **Bug-fix release.** Closes 4 distinct cost-projection bugs surfaced by
> a v5.2 architect-agent end-to-end test (`agent-output/azure-pricing-mcp-test`):
> ACR Premium returning $73 instead of $50, Storage / Private DNS Zone /
> Private Endpoint returning `no pricing found`, and Key Vault Standard
> matching the much more expensive Managed HSM B1 SKU.

### Fixed

- **Unit-aware projection for `estimate_costs` and `azure_bulk_estimate`.**
  v5.0–v5.2 picked the first search hit and multiplied `retailPrice × 730`,
  regardless of the meter's actual `unitOfMeasure`. The Retail Prices API
  frequently returns multiple meters per SKU (ACR Premium has 7 in
  swedencentral: GB/Month, 1/Day, 1 Second, etc.). v5.3 introduces a
  `meter_units` module that:
  - parses every `unitOfMeasure` string into a typed `MeterDimension`
    (HOUR, DAY, MONTH, GB_MONTH, GB, TRANSACTIONS, SECOND, UNKNOWN);
  - scores candidate meters via `select_primary_meter` (Hour > Day >
    Month > GB_Month > Second > Transactions > Unknown);
  - **prefers exact `skuName` matches** over substring matches —
    prevents `Standard` from matching `Standard B1` Managed HSM Pool;
  - projects monthly cost via `project_monthly_cost`, returning $0 with
    a human-readable warning for non-time-based meters (GB-Month,
    transactions) instead of fabricating a number.

  Verified: ACR Premium now returns $50.73/mo (was $73, off by 44%).

- **Service-name normalization improvements** in `_resolve_service_name`:
  - strips trailing `" Account"`, `" Service"` etc. so
    `"Storage Account"` → `"Storage"` (the canonical Azure serviceName).
  - **fallback to alternate canonical service names** when the primary
    returns no items — `"Azure DNS"` falls back to `"Virtual Network"`
    where the Private DNS Zone meters actually live (verified empirically).

- **SKU-name normalization** in `_normalize_sku_for_search`: strips
  variant suffixes the API doesn't carry (`"Standard LRS GPv2"` →
  `"Standard LRS"` — the GPv2 distinction lives in `productName`).

- **Static-fallback prices for un-API'd SKUs.** Private DNS Zone
  ($0.50/zone/month) and Private Endpoint ($0.01/hour) are documented
  on Microsoft's pricing pages but not exposed via the public Retail
  Prices API. v5.3 ships a small fallback table in
  `_STATIC_FALLBACK_PRICES` keyed on `(service_match, sku_match)`. Each
  entry carries a `source` URL and a `note` explaining the limitation;
  the price lands in the result with `meter_dimension: "static_fallback"`
  and a `projection_warning` field documenting the source.

- **`available_meters[]` array** in the `estimate_costs` envelope —
  surfaces up to 10 alternative meters the heuristic considered, with
  product name, retail price, unit, and consumption-type. Lets the
  cost-estimate-subagent flag mismatches and re-query.

### Changed

- `cost-estimate-subagent.agent.md` — new **Sanity checks** section
  guides the subagent to retry per-line with `azure_price_search` when
  bulk-estimate output triggers any of: variant-name mismatch (resolved
  sku differs from request), unexpected `meter_dimension`, monthly-cost
  variance >30% from documented baseline, or `projection_warning`
  indicating the meter cannot be projected. The variance check addresses
  the v5.0–v5.2 behaviour where the subagent flagged the ACR Premium
  $73/mo anomaly in `notes` but never auto-retried — per the original
  rules ("transcribe verbatim, don't substitute"), which were correct
  but too rigid for unit-mismatch errors.

- `estimate_costs` now fetches up to **50** candidate meters (was 5) so
  the heuristic has enough candidates to find the daily flat-fee meter
  for ACR Premium when GB/Month meters take the top slots.

- `estimate_costs` now filters out RI/Reservation/SavingsPlan/DevTest
  meters before meter selection — prevents accidentally returning a
  1-year reservation rate when the caller wanted consumption pricing.

### Added

- `azure_pricing_mcp.meter_units` module — `MeterDimension`,
  `MeterUnit`, `parse_unit_of_measure`, `select_primary_meter`,
  `project_monthly_cost`.
- `azure_pricing_mcp.services.pricing._resolve_service_name`,
  `_normalize_sku_for_search`, `_lookup_static_fallback`,
  `_FALLBACK_SERVICE_NAMES`, `_STATIC_FALLBACK_PRICES`.
- `tests/test_meter_aware_projection.py` — 39 regression tests covering
  unit parsing, meter selection (with the ACR Premium and Key Vault
  scenarios that caused the original bugs), service/sku normalization,
  static fallbacks, and end-to-end `estimate_costs` calls with mocked
  clients. All tests run without network access.

### Verification

- 255 tests pass (was 216; +39 new regression tests).
- End-to-end reproduction of the
  `agent-output/azure-pricing-mcp-test` workload (10 resources,
  swedencentral, no discount, no RI): now returns **$151.51/mo** (was
  the bogus $146.03 with 3 unresolved + ACR overcharge). New total
  matches the prior architecture-assessment baseline of $155/mo within
  3%, with all 7 priceable line items resolved (Log Analytics free tier
  and Application Insights free tier still return $0 as expected for
  <5 GB ingestion).
- No regressions in the v5.0–v5.2 test suite.

## [5.2.0] - 2026-05-09

> **Closes the v5.1 `outputSchema` deferral.** Structured-content emission +
> `outputSchema` attachment land in v5.2 on the same
> `feat/azure-pricing-mcp-v5` branch.

### Added

- **`outputSchema` on every in-scope tool.** All 11 high-volume read
  tools (`azure_price_search`, `azure_price_compare`,
  `azure_cost_estimate`, `azure_region_recommend`, `azure_ri_pricing`,
  `azure_bulk_estimate`, `azure_sku_discovery`, `azure_discover_skus`,
  `find_orphaned_resources`, `databricks_dbu_pricing`,
  `github_pricing`) now declare a JSON Schema dict in their
  `Tool.outputSchema` field, derived from a pydantic envelope in the
  new `azure_pricing_mcp.schemas` module via
  `BaseModel.model_json_schema()`.
- **Structured-content emission.** Each in-scope handler returns the
  new `MCPToolResponse` envelope (a `list[TextContent]` subclass with
  an optional `.structured` payload). The dispatcher in `server.py`
  translates `.structured` into the SDK's
  `tuple[list[ContentBlock], dict]` form so `CallToolResult` populates
  both `content` and `structuredContent`. The MCP SDK validates the
  structured payload against `outputSchema` automatically (jsonschema).
- **`mcp_response.py` module.** Hosts `MCPToolResponse` +
  `strip_private_keys` (drops underscore-prefixed keys from the
  service-layer dict so private metadata like `_discount_metadata`
  doesn't bleed into the structured envelope).
- **`schemas.py` module.** Registry of 11 permissive output envelopes
  with `extra="allow"` so service-layer additions don't break the
  contract. `OUTPUT_SCHEMAS` dict + `get_output_schema(tool_name)`
  helper expose the schemas to `tools.py`.
- **8 new tests** in `tests/test_output_schemas.py` cover: every
  in-scope tool has populated `outputSchema`, out-of-scope tools have
  none (else SDK errors), `MCPToolResponse` list-subclass behaviour,
  `strip_private_keys`, end-to-end structured emission for
  `handle_price_search` and `handle_bulk_estimate`, plain-list
  back-compat for legacy handlers, and permissive-schema validation
  against payloads with extra fields.

### Design notes

- **Permissive over strict.** All envelopes use
  `model_config = ConfigDict(extra="allow")` so unknown service-layer
  fields pass validation. JSON Schema validation acts as a _guard_
  against gross shape regressions, not a strict typed contract — that
  strict typing is scheduled for v6.0 once every service-layer return
  path is fully audited.
- **Why a list-subclass instead of a tuple return type?** The
  alternative (handlers return `tuple[list, dict]`) would have forced
  a 26-site test rewrite — every test that does
  `result = await handler(...); result[0].text` would break because
  `result[0]` would be the list, not the TextContent.
  `MCPToolResponse` keeps the v5.0/v5.1 callable contract intact.

### Verification

- 216 tests pass (208 from v5.1 + 8 new schema tests).
- Aggregate compact bench unchanged at 45.9% of v4 baseline.
- `lint:md` / `lint:json` / `lint:python` (ruff check + ruff format) clean.

## [5.1.0] - 2026-05-09

> **Closes the v5.0 deferral list.** Phases 4.14, 4.15, and 4.17 from the
> original modernization plan — previously deferred — landed in v5.1 in a
> single follow-up release on the same `feat/azure-pricing-mcp-v5` branch.

### Changed

- **`models.py` migrated from `@dataclass` to `pydantic.BaseModel`** (Phase 4.14).
  The 6 internal models (`PricingItem`, `SKUInfo`, `RegionRecommendation`,
  `CostEstimate`, `SavingsPlanEstimate`, `RIComparison`,
  `VMSeriesRetirementInfo`) now derive from a shared `_Model` base with
  `model_config = ConfigDict(populate_by_name=True, extra="ignore")`. This
  unblocks future MCP `outputSchema` derivation (every model can emit JSON
  Schema via `BaseModel.model_json_schema()`) and structured-content
  serialization via `BaseModel.model_dump(mode="json")`.
- **Retirement disk cache** (Phase 3.8) updated to use pydantic
  `model_dump(mode="json")` and `model_validate()` instead of
  `dataclasses.asdict()` / `dataclasses.fields()`. Older v5.0 disk-cache
  files re-hydrate cleanly thanks to `extra="ignore"`.
- **Admin-tier tools extracted to `azure_pricing_mcp.admin/`** (Phase 4.17):
  `spot_eviction_rates`, `spot_price_history`, `simulate_eviction`,
  `find_orphaned_resources` now live under `src/azure_pricing_mcp/admin/`
  with their own `tools.py`, `handlers.py`, and `__init__.py`. The
  package's `__init__` performs an **import-time probe** of `azure.identity`
  - `azure.core.credentials`; failure raises `ImportError` and the parent
    server quietly skips admin-tool registration with a logged hint:
    `"[admin] extras not installed — admin tools unavailable. Install with:
pip install 'azure-pricing-mcp[admin]'"`. Importers that miss the extras
    but try to invoke an admin tool anyway get a friendly install hint
    response (the `_admin_unavailable` fallback handler).
  * **Probe scope correction** vs the original plan: the v5 implementation
    talks to Azure Resource Graph + Compute + Cost Management via raw
    aiohttp REST calls, not via the `azure-mgmt-*` SDKs. The probe was
    narrowed accordingly (`azure.identity` + `azure.core.credentials`)
    to match what the code actually imports.
- **Tool dispatch ladder eliminated** (Phase 4.15) — the v5.0
  `if name == "x" / elif` chain in `server.py::_register_tool_handlers`
  was replaced with an O(1) dispatch dict. Adding a new tool no longer
  requires editing a routing branch; the dict is built once at
  registration time and looks up the handler method by name.
- **aiohttp session lifespan ownership** (Phase 4.15 sub-goal) was
  already in place via `AzurePricingServer.__aenter__/__aexit__` and the
  `async with pricing_server:` pattern in `main()`. v5.1 documents this
  explicitly via an architecture comment in `server.py`.

### Phase-4 design clarifications

- **FastMCP migration** — the v5.0 plan called for a switch to
  `mcp.server.fastmcp.FastMCP` with `@mcp.tool()` decorators. After
  evaluating the `FastMCP.add_tool()` API, we found it derives
  `inputSchema` from function signatures only, while we maintain rich
  hand-curated `inputSchema` definitions in `tools.py` (with shared
  fragments, MCP annotations, response-format injection, etc.). A literal
  FastMCP migration would force re-deriving every schema from a function
  signature, forcing the test-suite rewrite the plan flagged as risk E3.
  v5.1 instead delivers the **stated motivations** for the migration
  (kill the ladder + lifespan-owned session) without the structural
  rewrite. A full FastMCP rewrite remains an option for v6.0 if MCP-side
  ergonomics ever justify the cost.
- **`outputSchema` attachment shipped in v5.2** (see entry above). The
  pydantic migration in v5.1 laid the groundwork — every formatter
  input is a pydantic-shaped dict with derivable JSON Schema. v5.2
  ships the actual `Tool.outputSchema` attachment + structured-content
  emission via `MCPToolResponse`.

### Internal

- New file: `src/azure_pricing_mcp/admin/__init__.py` — admin import probe.
- New file: `src/azure_pricing_mcp/admin/tools.py` — admin tool definitions.
- New file: `src/azure_pricing_mcp/admin/handlers.py` — admin handler mixin.
- `handlers.py::ToolHandlers` now mixes in `AdminHandlers` conditionally
  (`_AdminHandlers` is the real mixin when `[admin]` is installed, or a
  no-op fallback that emits friendly install hints otherwise).
- `tools.py` now appends `get_admin_tool_definitions()` to the canonical
  list when the probe succeeds; the spot/orphaned/simulate-eviction tool
  definitions were removed from the inline list.
- Verification: 208 tests pass (unchanged from v5.0); aggregate compact
  bench unchanged at 45.9% of v4 baseline.

## [5.0.0] - 2026-05-09

> **Independent fork.** This release marks the v5.0 transition of the server
> into the [`jonathan-vella/apex`](https://github.com/jonathan-vella/apex)
> monorepo as part of the APEX agentic platform. Substantial contributions from
> the upstream project (`msftnadavbh/AzurePricingMCP`) are gratefully
> acknowledged in [README.md](README.md#-acknowledgments).
>
> The corresponding rollback tag is `v4.0.0-final`.

### Breaking

- **Default response shape changed.** All high-volume read tools now return a
  token-efficient compact markdown table by default. Callers that depend on the
  v4 verbose string shape (with embedded `json.dumps(...)` blob, decorative
  emoji, and inline discount tips) MUST pass `response_format: "full"` to
  preserve byte-for-byte v4 output. Empirical reduction across the canonical
  workload: aggregate compact total is ~46% of the v4 baseline (~12 KB / ~3000
  tokens saved per workload). The biggest win is `azure_price_search` (7929 →
  1612 bytes; the JSON dump removal).
- **`output_format` parameter removed.** The agent prompts in v4 referenced an
  `output_format` argument that was never implemented in the server (silently
  dropped). v5.0 replaces it with the real `response_format` parameter
  (`compact|table|full`). Callers passing `output_format` will see no effect;
  pass `response_format` instead.
- **`azure_discover_skus` deprecated → alias.** The tool is preserved as a
  thin alias that forwards to `azure_sku_discovery` (the canonical
  fuzzy-matching implementation). The v4 `service_name` argument is translated
  to `service_hint`. Compact-mode responses now prepend
  `[deprecated v5.0; use azure_sku_discovery]`. **Removal scheduled for v6.0.**
- **`[azure]` extras renamed → `[admin]`.** The Azure-management-SDK extras
  (azure-identity + azure-mgmt-\*) are now installed via `pip install '.[admin]'`.
  The legacy `[azure]` name remains as a deprecation alias for one release and
  will be removed in v6.0.
- **HTTP transport removed.** v4 shipped an optional Streamable HTTP transport
  intended for Docker delivery. v5.0 drops both: the `--transport http`,
  `--host`, and `--port` CLI flags are gone; `mcp.server.streamable_http_manager`
  - `starlette` + `uvicorn` are no longer runtime dependencies. Every
    consumer in this repo uses **stdio** (per `.vscode/mcp.json`). The
    legacy `mcp.server.sse.SseServerTransport` was already deprecated
    upstream. To re-add a remote transport later, plumb a Streamable HTTP
    path through `mcp.server.streamable_http`.
- **Dockerfile removed.** The `Dockerfile`, `.dockerignore`,
  `scripts/healthcheck.py`, and `scripts/docker-build.{sh,ps1}` helpers
  are gone. The server is delivered as a Python package installed into
  the dev-container venv (or any host venv) and wired via `mcp.json`. No
  container delivery vehicle is shipped today.
- **Build-system / dependency manifest.** `requirements.txt` is gone — the uv
  lockfile is now the source of truth (`uv pip install -e ".[dev]"` is the
  canonical install command). `MANIFEST.in` was deleted (it referenced
  non-existent files and we don't publish sdists). `wheel` was dropped from
  `[build-system].requires` (modern setuptools handles wheel building). Python
  floor: **>= 3.14** (drops 3.10–3.13 support).
- **`black` removed.** `ruff format` now handles formatting; the `[tool.black]`
  block was removed from `pyproject.toml` and the black hook removed from
  `.pre-commit-config.yaml`.

### Added

- **`response_format` parameter** (`compact | table | full`, default `compact`)
  on the 11 high-volume read tools: `azure_price_search`, `azure_price_compare`,
  `azure_cost_estimate`, `azure_region_recommend`, `azure_sku_discovery`,
  `azure_discover_skus`, `azure_ri_pricing`, `azure_bulk_estimate`,
  `find_orphaned_resources`, `databricks_dbu_pricing`, `github_pricing`.
  See [CHANGELOG.md](CHANGELOG.md) and the **Tuning** + **Response format**
  sections of [README.md](README.md) for per-tool baselines and env-var
  knobs.
- **MCP tool annotations** on all 19 tools (`readOnlyHint`, `idempotentHint`,
  `destructiveHint`, `openWorldHint` per the current MCP spec).
  `simulate_eviction` is the only tool flagged as destructive + open-world;
  every other tool is read-only + idempotent.
- **In-flight request coalescing** in `PricingService._fetch_prices_cached`:
  concurrent agent calls with the same `(filter, currency, limit)` key now
  share one `asyncio.Future` instead of issuing N HTTP round-trips.
- **Negative-result cache** with configurable TTL via `AZURE_PRICING_NEG_TTL`
  (default 60 s). Empty `Items` responses no longer poison the dedup cache for
  the full 5-min TTL — agents that retry with a corrected SKU pay only one
  HTTP latency.
- **Disk-backed retirement cache** at
  `${XDG_CACHE_HOME:-~/.cache}/azure-pricing-mcp/retirement.json`. Cold starts
  no longer pay the GitHub round-trip for the MicrosoftDocs retirement
  markdown when a cached file exists within `RETIREMENT_CACHE_TTL` (24 h).
- **Multi-stage Dockerfile** — _removed in this same release._ (See the
  Breaking section above.) The plan called for a multi-stage `uv` builder,
  but follow-up review concluded no consumer needed the container delivery
  vehicle, so the Dockerfile was deleted along with the HTTP transport that
  it served.
- **`AZURE_PRICING_CACHE_DIR`** env var for overriding the disk-cache root
  (e.g. in containers).
- **`npm run bench:azure-pricing`** harness comparing every formatter's
  compact + full output against the v4 byte-baseline at
  `tests/fixtures/baseline-bytes.json`. Aggregate target: compact ≤ 50% of v4.
- **`v4.0.0-final` git tag** marking the rollback point before v5.0 work began.

### Performance

- `azure_price_search` compact mode: 7929 → 1612 bytes (~80% reduction;
  the json.dumps dump is gone).
- `find_orphaned_resources` compact mode: 2602 → 281 bytes (collapses
  per-type detail tables into a single summary row).
- `azure_cost_estimate` compact mode: 942 → 257 bytes.
- `azure_region_recommend` compact mode: 1212 → 439 bytes.
- Aggregate across 11 in-scope tools: 22477 → 10316 bytes (~46% of v4).

### Changed

- **Re-attributed** all metadata (authors, maintainers, repo URLs, badges) to
  `jonathan-vella/apex`. Upstream contributors recognised
  in `README.md` Acknowledgments.
- **Shared input-schema constants** (`_DISCOUNT_PERCENTAGE_SCHEMA`,
  `_SHOW_WITH_DISCOUNT_SCHEMA`, `_CURRENCY_CODE_SCHEMA`) replace the
  3-line description blocks repeated across 4+ tools, shrinking the
  `tools/list` response.
- **Pinned every runtime dep to its latest stable** as of May 2026
  (`mcp >=1.27.0`, `aiohttp >=3.11.0`, `pydantic >=2.10.0`, `uvicorn >=0.32.0`,
  `starlette >=0.41.0`). Dev deps similarly bumped (`pytest >=8.3.0`,
  `ruff >=0.7.0`, `mypy >=1.13.0`, `pre-commit >=4.0.0`).
- **`cachetools >= 5.5.0`** added to runtime deps (typed TTL cache scaffolding
  used by Phase-3 cache layers).
- **`tiktoken >= 0.8.0`** added to dev deps (token-budget bench harness).
- **`.pre-commit-config.yaml` synced with CI gates** (ruff lint + format,
  mypy, bandit). Drops the legacy black hook.
- Pre-commit + CI now run `ruff format --check` (in `npm run lint:python`).

### Removed

- `Dockerfile`, `.dockerignore`, `scripts/healthcheck.py`,
  `scripts/docker-build.sh`, `scripts/docker-build.ps1` — no consumer
  needed the container delivery vehicle.
- HTTP transport from `server.py` (the `--transport`, `--host`, `--port`
  CLI flags + the `StreamableHTTPSessionManager`/`Starlette`/`uvicorn`
  block).
- `tests/test_http_transport.py` — 6 tests covering the dropped HTTP path.
- `uvicorn` and `starlette` runtime dependencies (only used by the dropped
  HTTP transport).
- `sse-starlette` runtime dependency (was already removed upstream of the
  HTTP-transport drop).
- `requirements.txt` (uv.lock is now canonical).
- `MANIFEST.in` (broken; referenced non-existent files; no sdist publishing).
- `scripts/setup.py` (legacy; pyproject.toml is canonical).
- Dead `register_tool_handlers()` function in `handlers.py` (the active
  routing has lived in `server.py::_register_tool_handlers` since v3.0.0).
- `docs/TOOLS.md`, `docs/PERFORMANCE.md`, `ARCHITECTURE.md` — their
  essentials folded into `README.md` for a single canonical doc surface.
- Default discount-tip footer in compact mode (suppressed to save tokens;
  still emitted in full mode).

### Internal

- Dev-only scripts moved to `scripts/dev/` (`debug_handler_return.py`,
  `debug_suggestions.py`, `simulate_mcp_call.py`, `exact_mcp_handler_test.py`,
  `find_app_service.py`, `run_server.py`). Production scripts in
  `scripts/` (`install.py`, `setup.ps1`, `test_setup.ps1`).
- Phase-0b token baselines captured at `tests/fixtures/baseline-bytes.json`.
- Phase-0d consumer grep at `tests/fixtures/consumer-grep.txt`.

### Deferred to v5.1 (shipped in v5.1.0 — see entry above)

The following Phase-4 plan items were originally deferred to a v5.1 release.
They all shipped on the same `feat/azure-pricing-mcp-v5` branch as v5.1.0
(see the v5.1.0 entry at the top of this file for details):

- **Phase 4.14** — pydantic migration of `models.py` (DONE in v5.1).
- **Phase 4.15** — eliminate the `if name == "x":` dispatch ladder + verify
  lifespan-owned aiohttp session (DONE in v5.1; the full FastMCP decorator
  rewrite was evaluated and deferred to v6.0 — see v5.1 entry for the
  design rationale).
- **Phase 4.17** — extract `admin/` package with multi-import probe gating
  (DONE in v5.1; probe scope corrected to match what the code actually
  imports — `azure.identity` + `azure.core.credentials` rather than the
  full `azure-mgmt-*` set).

### No-op (plan item retired)

- **Phase 3.10** — `recommend_regions` parallelization. Audit confirmed
  this function does ONE `search_prices(limit=500)` call and groups results
  by region in-memory; the only loop iterates 1–3 SKU-name variants with
  early exit on first hit. Parallelizing would waste API quota without
  improving latency.

## [4.0.0] - 2026-03-03

### Changed

- **Documentation overhaul** — comprehensive review and update of all markdown files
  - Fixed tool count across all docs (was 6/13/15 in different files → now consistently 18)
  - Added Databricks DBU pricing tools to TOOLS.md, USAGE_EXAMPLES.md, FEATURES.md, and README.md (were missing from all four despite being added in v3.4.0)
  - Added GitHub pricing examples to USAGE_EXAMPLES.md
  - Added full parameter documentation to TOOLS.md for all 18 tools
  - Rewrote PROJECT_STRUCTURE.md to reflect current architecture (was stuck at ~v3.0.0)
  - Fixed 8 broken links (references to deleted QUICK_START.md, nonexistent DOCKER.md, wrong relative paths)
  - Added Copilot disambiguation note (GitHub Copilot vs Microsoft 365 Copilot) to FEATURES.md and TOOLS.md
  - Updated DEVELOPMENT.md "Adding a New Tool" guide to reflect service → handler → formatter → tool pattern
  - Fixed stale version references and removed outdated setup.py reference in DEVELOPMENT.md
  - Removed stale "Reserved Instances" item from CONTRIBUTING.md (already implemented)
  - Simplified README.md contributing section (removed duplication with CONTRIBUTING.md)
  - Updated INSTALL.md auth note to include Orphaned Resources (not just Spot VMs)
  - Fixed SETUP_CHECKLIST.md tool count and resource links

- **Version bump to 4.0.0** — major documentation restructuring

### Added

- Added [@roy2392](https://github.com/roy2392) as a contributor

## [3.5.0] - 2026-03-03

### Added

- **GitHub Pricing Tools** — full GitHub product pricing catalog
  - `github_pricing` — look up pricing for Plans, Copilot, Actions runners, Advanced Security, Codespaces, Git LFS, and Packages
  - `github_cost_estimate` — estimate monthly/annual GitHub costs based on team size and usage
  - Static pricing table verified against github.com/pricing (no API calls required)
  - Natural-language product aliases (e.g., 'ci/cd' → Actions, 'pair programmer' → Copilot)
  - Full test suite with config validation, service logic, formatter, and handler integration tests

## [3.4.0] - 2026-03-03

### Added

- **Azure Databricks DBU Pricing Tools** (contributed by PR #28)
  - `databricks_dbu_pricing` - Search and list Azure Databricks DBU rates by workload type, tier, and region
  - `databricks_cost_estimate` - Estimate monthly and annual Databricks costs based on DBU consumption
  - `databricks_compare_workloads` - Compare DBU costs across workload types or regions
  - Supports 14 workload types with fuzzy alias matching (e.g., 'etl' -> 'jobs', 'warehouse' -> 'serverless sql')
  - Real-time pricing from Azure Retail Prices API — no authentication required
  - Photon pricing comparison included automatically

### Changed

- **Orphaned Resource Detection** expanded from 5 to 11 resource types (contributed by [@iditbnaya](https://github.com/iditbnaya), PR #30)
  - Removed NICs and NSGs (no cost impact — not billable resources)
  - Added: SQL Elastic Pools, Application Gateways, NAT Gateways, Load Balancers, Private DNS Zones, Private Endpoints, Virtual Network Gateways, DDoS Protection Plans
  - Fixed SQL Elastic Pools query to correctly filter for pools with no databases (leftanti join)
  - Fixed Private Endpoints query to check both auto-approved and manual-approval connections
  - Updated all documentation (FEATURES.md, ORPHANED_RESOURCES.md, TOOLS.md, USAGE_EXAMPLES.md)

### Documentation

- Added Databricks DBU pricing tools to TOOLS.md
- Updated orphaned resource documentation across all docs

## [3.3.0] - 2026-02-12

### Added

- **PTU Sizing + Cost Planner** (`azure_ptu_sizing` tool)
  - Estimate required Provisioned Throughput Units (PTUs) for Azure OpenAI / AI Foundry model deployments
  - Supports 19 models: gpt-5.2, gpt-5.1, gpt-5, gpt-5-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o3, o4-mini, gpt-4o, gpt-4o-mini, o3-mini, o1, Llama-3.3-70B-Instruct, DeepSeek-R1, DeepSeek-V3-0324, DeepSeek-R1-0528, and codex variants
  - Applies official rounding rules (minimum PTUs + scale increments per model and deployment type)
  - Supports Global, Data Zone, and Regional Provisioned deployment types
  - Accounts for output token multipliers (e.g., gpt-5: 1 output = 8 input tokens)
  - Supports cached token deduction (100% deducted from utilization per docs)
  - Optional live cost estimation via Azure Retail Prices API ($/PTU/hr, monthly projections)
  - Full calculation transparency: shows intermediate math, rounding rules, and data sources
  - Includes reservation guidance and benchmarking recommendations

- **PTU Service** (`services/ptu.py`, `services/ptu_models.py`)
  - `PTUService` class with pure computation methods and async orchestrator
  - Versioned model data table sourced from official Microsoft PTU documentation
  - Case-insensitive model lookup with canonical name resolution

### Documentation

- Added `azure_ptu_sizing` tool to TOOLS.md
- Added PTU Sizing section to FEATURES.md

## [3.2.0] - 2026-02-10

### Added

- **Orphaned Resource Detection Tool** (contributed by [@iditbnaya](https://github.com/iditbnaya))
  - `find_orphaned_resources` - Detect orphaned Azure resources and compute wasted costs
  - Initial release: scans for unattached managed disks, orphaned NICs, public IPs, NSGs, and empty App Service Plans
  - Integrates with Azure Cost Management API for historical cost lookup
  - Groups results by resource type with per-type summary tables
  - Configurable lookback period (default: 60 days)
  - Supports scanning all subscriptions or a single subscription

- **Orphaned Resources Service** (`services/orphaned_resources.py`, `services/orphaned.py`)
  - `OrphanedResourceScanner` for async Resource Graph queries
  - Azure Cost Management integration for per-resource cost lookup
  - Uses existing aiohttp and azure-identity - no new dependencies

### Documentation

- Added orphaned resource detection to TOOLS.md
- Added detailed feature documentation in FEATURES.md
- Added [@iditbnaya](https://github.com/iditbnaya) as contributor

## [3.1.0] - 2026-01-28

### Added

- **Spot VM Tools** (requires Azure authentication)
  - `spot_eviction_rates` - Query Spot VM eviction rates for SKUs across regions
  - `spot_price_history` - Get up to 90 days of Spot pricing history
  - `simulate_eviction` - Trigger eviction simulation on Spot VMs for resilience testing

- **Azure Authentication Module** (`auth.py`)
  - `AzureCredentialManager` for Azure AD authentication
  - Non-interactive credential support (environment variables, managed identity, Azure CLI)
  - Graceful error handling with authentication help messages
  - Least-privilege permission guidance for each tool

- **New Dependencies**
  - `azure-identity>=1.15.0` for Azure AD authentication (Spot VM tools)

- **Spot Service** (`services/spot.py`)
  - Azure Resource Graph integration for eviction rates and price history
  - Azure Compute API integration for eviction simulation
  - Lazy initialization - auth only checked when Spot tools are called

### Configuration

- `AZURE_RESOURCE_GRAPH_URL` - Resource Graph API endpoint
- `AZURE_RESOURCE_GRAPH_API_VERSION` - API version for Resource Graph
- `AZURE_COMPUTE_API_VERSION` - API version for Compute operations
- `SPOT_CACHE_TTL` - Cache TTL for Spot data (1 hour default)
- `SPOT_PERMISSIONS` - Least-privilege permission documentation

## [3.0.0] - 2026-01-26

### ⚠️ Breaking Changes

#### Entry Point Changed

- **Console script entry point changed from `main` to `run`**
  - The `run()` function is now the synchronous entry point that wraps `asyncio.run(main())`
  - Existing console script configurations (`azure-pricing-mcp`) will continue to work
  - Code directly importing and calling `main()` still works (it's async)
  - This change improves the structure by clearly separating sync/async entry points

#### `create_server()` Return Value

- **`create_server()` now returns a tuple `(Server, AzurePricingServer)` by default**
  - This change exposes the pricing server for testing and advanced use cases
  - Use `create_server(return_pricing_server=False)` for the previous behavior (returns only `Server`)
  - The `AzurePricingServer` instance is needed for lifecycle management

#### Session Lifecycle Management

- **HTTP session is now managed at the server level, not per-tool-call**
  - Previously: Each tool call created and destroyed a new HTTP session (inefficient)
  - Now: A single HTTP session is created at server startup and reused for all tool calls
  - This significantly improves performance and reduces overhead
  - When using `AzurePricingServer` directly, you must manage its lifecycle:

    ```python
    # Option 1: Context manager (recommended)
    async with AzurePricingServer() as pricing_server:
        result = await pricing_server.tool_handlers.handle_price_search(...)

    # Option 2: Manual lifecycle management
    pricing_server = AzurePricingServer()
    await pricing_server.initialize()
    try:
        result = await pricing_server.tool_handlers.handle_price_search(...)
    finally:
        await pricing_server.shutdown()
    ```

### Added

- **Modular Services Architecture**
  - `client.py` - HTTP client for Azure Pricing API
  - `services/` - Business logic (PricingService, SKUService, RetirementService)
  - `handlers.py` - MCP tool routing
  - `formatters.py` - Response formatting
  - `models.py` - Data structures
  - `tools.py` - Tool definitions
  - `config.py` - Configuration constants

- **New `AzurePricingServer` Methods**
  - `initialize()` - Explicitly start the HTTP session
  - `shutdown()` - Explicitly close the HTTP session
  - `is_active` property - Check if session is active

- **Improved Documentation**
  - Comprehensive docstrings for all public APIs
  - Breaking change documentation in module docstring

### Changed

- Restructured codebase from monolithic to modular architecture
- Updated all tests to use service-based architecture with proper dependency injection
- Improved error handling with session state checks

### Removed

- Obsolete documentation files:
  - `DOCUMENTATION_UPDATES.md`
  - `MIGRATION_GUIDE.md`
  - `QUICK_START.md` (replaced by README quick start section)
  - `USAGE_EXAMPLES.md` (replaced by README examples)

### Migration Guide

#### For Console Script Users

No changes required. The `azure-pricing-mcp` command continues to work.

#### For Library Users

1. **If you call `create_server()`:**

   ```python
   # Old (v2.x)
   server = create_server()

   # New (v3.0) - if you don't need pricing_server
   server = create_server(return_pricing_server=False)

   # New (v3.0) - if you need pricing_server for testing
   server, pricing_server = create_server()
   ```

2. **If you use `AzurePricingServer` directly:**
   ```python
   # You MUST initialize the session before tool calls
   async with AzurePricingServer() as pricing_server:
       # All tool calls within this block share the same HTTP session
       result = await pricing_server.tool_handlers.handle_price_search(...)
   ```

## [2.3.0] - Previous Release

See git history for changes in previous versions.
