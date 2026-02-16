# Azure Pricing MCP Server

> v4.1.0 | Model Context Protocol server for querying Azure retail pricing

## Quick Start

### VS Code (stdio — recommended)

The server is pre-configured in `.vscode/mcp.json`. After opening the devcontainer:

```bash
cd mcp/azure-pricing-mcp
pip install -e .
```

The MCP server starts automatically when VS Code invokes it via stdio.

### Docker (HTTP transport)

```bash
cd mcp/azure-pricing-mcp
docker build -t azure-pricing-mcp .
docker run -p 8080:8080 azure-pricing-mcp
```

Connect your MCP client to `http://localhost:8080`.

## Tools

All 13 tools query the
[Azure Retail Prices API][azure-retail-api].
Spot VM tools (`spot_*`, `simulate_eviction`) require Azure authentication.

<!-- markdownlint-disable MD013 -->

| Tool | Purpose | Required Params | Auth |
|------|---------|-----------------|------|
| `azure_price_search` | Search retail prices with filters | — | No |
| `azure_price_compare` | Compare prices across regions/SKUs | `service_name` | No |
| `azure_cost_estimate` | Estimate costs based on usage | `service_name`, `sku_name`, `region` | No |
| `azure_discover_skus` | List available SKUs for a service | `service_name` | No |
| `azure_sku_discovery` | Intelligent SKU name matching | `service_hint` | No |
| `azure_region_recommend` | Find cheapest regions | `service_name`, `sku_name` | No |
| `azure_ri_pricing` | Reserved Instance pricing/savings | `service_name` | No |
| `azure_bulk_estimate` | Multi-resource estimate (one call) | `resources[]` | No |
| `azure_cache_stats` | API cache hit/miss statistics | — | No |
| `get_customer_discount` | Customer discount percentage | — | No |
| `spot_eviction_rates` | Spot VM eviction rates | `skus[]`, `locations[]` | Yes |
| `spot_price_history` | Spot VM price history (90 days) | `sku`, `location` | Yes |
| `simulate_eviction` | Simulate Spot VM eviction | `vm_resource_id` | Yes |

<!-- markdownlint-enable MD013 -->

### Common Optional Parameters

Most pricing tools accept these optional parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `currency_code` | `USD` | ISO currency code |
| `discount_percentage` | — | Custom discount to apply |
| `show_with_discount` | `false` | Show discounted prices |
| `output_format` | `verbose` | `verbose` (text) or `compact` (JSON) |
| `limit` | varies | Max results to return |

## Configuration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AZURE_PRICING_SSL_VERIFY` | `true` | Set `false` for corporate proxies |
| `AZURE_TENANT_ID` | — | Azure AD tenant (Spot tools) |
| `AZURE_CLIENT_ID` | — | Service principal (Spot tools) |
| `AZURE_CLIENT_SECRET` | — | Service principal secret (Spot tools) |

### Cache Settings

Defined in `config.py`:

| Setting | Value | Description |
|---------|-------|-------------|
| `PRICING_CACHE_TTL_SECONDS` | 300 (5 min) | Price query cache TTL |
| `PRICING_CACHE_MAX_SIZE` | 256 | Max cached entries |
| `RETIREMENT_CACHE_TTL` | 24 hours | VM retirement data cache |
| `SPOT_CACHE_TTL` | 1 hour | Spot VM data cache |

### Service Name Mappings

`config.py` contains ~95 mappings from user-friendly terms to official
Azure service names (e.g., `"vm"` → `"Virtual Machines"`,
`"aks"` → `"Azure Kubernetes Service"`). Tools resolve these
automatically — users don't need exact API names.

## Authentication

**Most tools require NO authentication** — they use the public
Azure Retail Prices API.

**Spot VM tools** (`spot_eviction_rates`, `spot_price_history`,
`simulate_eviction`) require Azure credentials. The server uses
`DefaultAzureCredential` and tries, in order:

1. Environment variables (`AZURE_CLIENT_ID` + `AZURE_TENANT_ID`
   + `AZURE_CLIENT_SECRET`)
2. Managed Identity (when running in Azure)
3. Azure CLI (`az login`)

Install the optional dependency: `pip install azure-pricing-mcp[spot]`

Required permissions:

| Tool | Permission |
|------|------------|
| `spot_eviction_rates` | `Microsoft.Compute/skus/read` |
| `spot_price_history` | `Microsoft.ResourceGraph/resources/read` |
| `simulate_eviction` | VM Contributor role on the target VM |

## Architecture

```text
src/azure_pricing_mcp/
├── __init__.py
├── __main__.py          # python -m azure_pricing_mcp
├── server.py            # MCP server, tool dispatch, lifecycle
├── tools.py             # Tool definitions (names, schemas)
├── handlers.py          # Handler dispatch with error boundaries
├── client.py            # HTTP client (aiohttp), retry, pagination
├── cache.py             # TTL cache (cachetools), SHA256 keys
├── config.py            # Constants, env vars, service mappings
├── auth.py              # Azure credential manager
├── models.py            # RetirementStatus, VMSeriesRetirementInfo
├── error_codes.py       # ErrorCode enum, error_response()
├── validation.py        # Per-tool input validation
├── formatters.py        # Verbose/compact output formatting
└── services/
    ├── pricing.py       # Search, compare, estimate, region recommend
    ├── bulk.py          # Multi-resource bulk estimation
    ├── retirement.py    # VM series retirement tracking
    ├── sku.py           # SKU discovery and matching
    └── spot.py          # Spot VM eviction and pricing
```

### Error Codes

Tools return structured errors with codes from `error_codes.py`:

| Code | Category |
|------|----------|
| `MISSING_REQUIRED_FIELD` | Input validation |
| `INVALID_FIELD_VALUE` | Input validation |
| `EMPTY_RESOURCE_LIST` | Input validation |
| `NO_PRICES_FOUND` | API response |
| `API_ERROR` | API failure |
| `RATE_LIMITED` | API throttling |
| `TIMEOUT` | API timeout |
| `AUTHENTICATION_REQUIRED` | Missing Azure credentials |
| `BULK_PARTIAL_FAILURE` | Some bulk items failed |
| `INTERNAL_ERROR` | Unexpected server error |
| `UNKNOWN_TOOL` | Unrecognized tool name |

## Development

### Prerequisites

+ Python 3.10+
+ [uv](https://docs.astral.sh/uv/) (recommended) or pip

### Setup

```bash
cd mcp/azure-pricing-mcp
pip install -e ".[dev]"
```

### Run Tests

```bash
pytest                      # all tests (94 tests)
pytest -m "not integration" # skip network-dependent tests
pytest tests/test_bulk.py   # specific test file
```

### Lint

```bash
ruff check src/ tests/
black --check src/ tests/
mypy src/
bandit -r src/ -c pyproject.toml
```

### Adding a New Tool

1. Define the tool schema in `tools.py`
2. Add required-field entries in `validation.py`
3. Create a handler method in `handlers.py`
4. Add the dispatch branch in `server.py` `handle_call_tool()`
5. Create a formatter in `formatters.py`
6. Add a service method if needed (in `services/`)
7. Write tests

## Docker

### Build and Run

```bash
docker build -t azure-pricing-mcp .
docker run -p 8080:8080 azure-pricing-mcp
```

With Spot VM authentication:

```bash
docker run -p 8080:8080 \
  -e AZURE_TENANT_ID=... \
  -e AZURE_CLIENT_ID=... \
  -e AZURE_CLIENT_SECRET=... \
  azure-pricing-mcp
```

The container includes a healthcheck that verifies server initialization
and API connectivity.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| SSL errors behind proxy | Set `AZURE_PRICING_SSL_VERIFY=false` |
| `AUTHENTICATION_REQUIRED` | Run `az login` or set service principal env vars |
| `NO_PRICES_FOUND` | Check `SERVICE_NAME_MAPPINGS` in `config.py` |
| `RATE_LIMITED` | Auto-retries with backoff (3 attempts) |
| Stale prices | Restart server to clear cache |

## License

MIT — see [LICENSE](LICENSE).

[azure-retail-api]: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
