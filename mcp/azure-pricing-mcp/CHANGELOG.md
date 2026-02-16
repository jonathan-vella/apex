# Changelog

All notable changes to the Azure Pricing MCP Server are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.1.0] - 2026-02-16

### Added

- **Error infrastructure** (`error_codes.py`, `validation.py`):
  `ErrorCode` enum with 14 machine-readable codes, `error_response()` factory,
  `validate_arguments()` per-tool checks, `_safe_handle()` boundary on all
  13 handlers
- **`azure_cache_stats` tool**: cache hit/miss counts, size, and hit-rate
  percentage via `PricingCache.stats`
- **Bulk estimate improvements**: service-name alias resolution
  (`SERVICE_NAME_MAPPINGS`), request deduplication with summed quantities,
  `asyncio.gather()` with `Semaphore(5)` concurrency, per-item retry
  (2 × exponential backoff), `unique_specs`/`indices` in response
- **Lint hooks**: `python-lint` (ruff) pre-commit, `python-typecheck` (mypy)
  post-commit, npm scripts `lint:python` and `lint:python:fix`

### Changed

- All error responses use standardized `ErrorCode` format
- Bulk errors expose `indices` (list) instead of `index` (int)
- Handlers split into public entry-point + private `_do_*` implementation

### Tests

94 tests (was 47): `test_error_codes` (6), `test_validation` (13),
`test_handlers` (12), `test_cache_stats` (6), `test_bulk` (13, was 3).

## [4.0.0] - 2025-07-22

### Added

- **`azure_bulk_estimate` tool**: multi-resource cost estimation with
  per-resource `quantity`, aggregated totals, and discount support
  (`BulkEstimateService` in `services/bulk.py`)
- **Response caching** (`cache.py`): `TTLCache` with configurable TTL
  (default 300 s), max size (default 256), SHA-256 keys, hit/miss stats
- **Pagination**: `fetch_all_prices()` follows `NextPageLink` up to
  `MAX_PAGINATION_PAGES` (default 10)
- **Multi-unit pricing**: `_compute_monthly_cost()` handles per-hour,
  per-GB/month, per-GB, per-month, per-day, per-10 K transactions;
  `quantity` parameter on `azure_cost_estimate`; `pricing_model` and
  `unit_rate` in response
- **Compact output**: `output_format` parameter (`verbose` | `compact`) on
  5 tools — strips metadata keys for reduced LLM context
- **Expanded service mappings**: ~95 entries (was ~35)
- **Test suite**: 47 tests across cache, pricing, bulk, formatters, tools,
  config

### Changed

- Agent definitions updated to include `azure_bulk_estimate`
- `azure_cost_estimate` response uses `unit_rate` instead of `hourly_rate`

### Removed

- Dead code: `.archive/`, unused scripts, stale docs, 6 unused dataclass
  models, 4 broken test files

### Dependencies

- Added `cachetools>=5.3.0`

## [3.1.0] - 2026-01-28

### Added

- **Spot VM tools** (require Azure authentication):
  `spot_eviction_rates`, `spot_price_history`, `simulate_eviction`
- **Azure authentication** (`auth.py`): `AzureCredentialManager` with
  environment-variable / managed-identity / CLI credential chain,
  least-privilege permission guidance
- **Spot service** (`services/spot.py`): Resource Graph + Compute API
  integration, lazy-init auth

### Configuration

- `AZURE_RESOURCE_GRAPH_URL`, `AZURE_RESOURCE_GRAPH_API_VERSION`,
  `AZURE_COMPUTE_API_VERSION`, `SPOT_CACHE_TTL`, `SPOT_PERMISSIONS`

### Dependencies

- Added `azure-identity>=1.15.0`

## [3.0.0] - 2026-01-26

### Breaking Changes

- **Entry point**: console script now calls `run()` (sync wrapper around
  `asyncio.run(main())`)
- **`create_server()`** returns `(Server, AzurePricingServer)` by default;
  pass `return_pricing_server=False` for the old single-value return
- **Session lifecycle**: single HTTP session created at startup and reused
  across all tool calls (was per-call)

### Added

- **Modular architecture**: `client.py`, `services/`, `handlers.py`,
  `formatters.py`, `models.py`, `tools.py`, `config.py`
- `AzurePricingServer.initialize()`, `.shutdown()`, `.is_active`

### Changed

- Codebase restructured from monolithic to modular
- Tests updated with service-based DI and session-state checks

### Removed

- Obsolete docs: `DOCUMENTATION_UPDATES.md`, `MIGRATION_GUIDE.md`,
  `QUICK_START.md`, `USAGE_EXAMPLES.md`

## [2.3.0] - Previous Release

See git history for changes in previous versions.
