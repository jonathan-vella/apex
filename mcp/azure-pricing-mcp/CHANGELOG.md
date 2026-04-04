# Changelog

All notable changes to the Azure Pricing MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
