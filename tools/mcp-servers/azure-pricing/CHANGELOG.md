# Changelog

All notable changes to the Azure Pricing MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on dates.** Entries up to and including v4.0.0 carry the date the
> upstream project last batch-edited them (`2026-03-03`); the actual chronological
> order of v3.x releases is approximate. From v5.0.0 onward, dates reflect the
> actual fork-release date in this repository.

## [5.0.0] - 2026-05-09

> **Independent fork.** This release marks the v5.0 transition of the server
> into the [`jonathan-vella/azure-agentic-infraops`](https://github.com/jonathan-vella/azure-agentic-infraops)
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
  (azure-identity + azure-mgmt-*) are now installed via `pip install '.[admin]'`.
  The legacy `[azure]` name remains as a deprecation alias for one release and
  will be removed in v6.0.
- **HTTP transport removed.** v4 shipped an optional Streamable HTTP transport
  intended for Docker delivery. v5.0 drops both: the `--transport http`,
  `--host`, and `--port` CLI flags are gone; `mcp.server.streamable_http_manager`
  + `starlette` + `uvicorn` are no longer runtime dependencies. Every
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
- **Multi-stage Dockerfile** — *removed in this same release.* (See the
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
  `jonathan-vella/azure-agentic-infraops`. Upstream contributors recognised
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

### Deferred to v5.1

The following Phase-4 plan items are tightly coupled (each blocks the next)
and require a full test-suite rewrite. They land in v5.1 once that work is
sequenced:

- **Phase 4.14** — Migrate the dataclasses in `models.py` for the 11
  in-scope tools to `pydantic.BaseModel` to populate MCP `outputSchema`
  fields automatically.
- **Phase 4.15** — Rewrite `server.py` with `mcp.server.fastmcp.FastMCP`
  decorators + a `lifespan` async context manager that owns the shared
  `aiohttp.ClientSession`. The current `if name == "x":` ladder
  (~70 lines) collapses into one decorated handler per tool.
- **Phase 4.17** — Extract admin-tier tools (`spot_*`, `simulate_eviction`,
  `find_orphaned_resources`) into a new `azure_pricing_mcp/admin/`
  package and gate registration via a multi-import probe (`azure.identity`
  + `azure.mgmt.resourcegraph` + `azure.mgmt.compute` +
  `azure.mgmt.costmanagement`). Today the admin SDKs are still imported
  by the existing `services/` modules whether or not the user installed
  `[admin]` extras; v5.0 ships the rename + deprecation alias of the
  extras themselves but keeps the import structure unchanged.

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
