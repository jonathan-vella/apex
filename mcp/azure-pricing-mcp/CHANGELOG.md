# Changelog

All notable changes to the Azure Pricing MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
