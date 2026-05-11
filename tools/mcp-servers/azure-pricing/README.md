# Azure Pricing MCP Server

[![Python 3.14](https://img.shields.io/badge/python-3.14-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-1.27+-green.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that
gives AI assistants real-time access to **Azure retail pricing**, SKU discovery,
region recommendations, RI/SP analysis, multi-resource cost estimates, plus
ad-hoc tools for Azure Databricks, GitHub, Spot VMs, and orphaned-resource
detection.

> **v5.1 — independent fork.** This server now lives in
> [`jonathan-vella/azure-agentic-infraops`](https://github.com/jonathan-vella/azure-agentic-infraops/tree/main/tools/mcp-servers/azure-pricing)
> as part of the APEX agentic platform-engineering toolkit. Upstream
> contributors credited in [Acknowledgments](#acknowledgments).

## Quick start

```bash
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops/tools/mcp-servers/azure-pricing

# uv (preferred — uv.lock is the source of truth)
uv venv && uv pip install -e ".[dev]"

# Or pip
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Smoke test
python -m azure_pricing_mcp
```

The server speaks **stdio only** — wire it up in `.vscode/mcp.json` (this
repo's parent `.vscode/mcp.json` already does so) or any other MCP client
that supports stdio. There is no HTTP transport; v4's optional Docker/SSE
delivery vehicle was removed in v5.0.

## Tools

19 tools split across two tiers. All read tools are tagged with the MCP
`readOnlyHint + idempotentHint` annotations so clients can skip confirmation
prompts. `simulate_eviction` is the only tool flagged
`destructiveHint + openWorldHint`.

Tools marked **rf** accept a `response_format` parameter
(`compact | table | full`, default `compact`) — see
[Response format](#response-format) below.

### Core (always available)

| Tool                           | Purpose                                                  | rf  |
| ------------------------------ | -------------------------------------------------------- | --- |
| `azure_price_search`           | Search retail prices with filters                        | yes |
| `azure_price_compare`          | Compare prices across regions/SKUs                       | yes |
| `azure_cost_estimate`          | Usage-based cost estimation (single resource)            | yes |
| `azure_region_recommend`       | Find cheapest regions for a service+SKU                  | yes |
| `azure_ri_pricing`             | Reserved Instance pricing & savings analysis             | yes |
| `azure_bulk_estimate`          | Multi-resource cost estimate in **one** call (preferred) | yes |
| `azure_sku_discovery`          | Fuzzy SKU lookup (canonical)                             | yes |
| `azure_discover_skus`          | **Deprecated v5.0** — alias of `azure_sku_discovery`     | yes |
| `get_customer_discount`        | Customer discount metadata                               | —   |
| `azure_ptu_sizing`             | Estimate PTUs for Azure OpenAI deployments               | —   |
| `databricks_dbu_pricing`       | Databricks DBU rates by workload + region                | yes |
| `databricks_cost_estimate`     | Databricks cost projection                               | —   |
| `databricks_compare_workloads` | Compare DBU rates across workloads                       | —   |
| `github_pricing`               | GitHub catalog (Plans, Copilot, Actions, …)              | yes |
| `github_cost_estimate`         | GitHub cost projection                                   | —   |

### Admin tier (require `[admin]` extras + Azure auth)

Install with `pip install -e ".[admin]"` and authenticate via
`az login` or `DefaultAzureCredential` env vars.

| Tool                      | Purpose                           | Annotation                  |
| ------------------------- | --------------------------------- | --------------------------- |
| `spot_eviction_rates`     | Spot VM eviction rates            | readOnly                    |
| `spot_price_history`      | 90-day Spot price history         | readOnly                    |
| `simulate_eviction`       | Trigger a Spot eviction (testing) | **destructive + openWorld** |
| `find_orphaned_resources` | Detect orphans + cost rollup      | readOnly                    |

Full input schemas live in
[`src/azure_pricing_mcp/tools.py`](src/azure_pricing_mcp/tools.py) — the
canonical source of truth.

## Response format

`compact` (default) returns a markdown table summary; `table` returns the
markdown table only; `full` reproduces the verbose v4 string shape
(decorative emoji, embedded `json.dumps(items, indent=2)`, inline discount
tip footer) for byte-for-byte v4 back-compat. Per the post-implementation
bench, **aggregate compact output is ≈ 46 % of the v4 baseline** for the
canonical 10-resource × 3-region workload (≈ 12 KB / 3000 tokens saved per
call). Run `npm run bench:azure-pricing` from the repo root for fresh
numbers; results land in
[`tests/fixtures/compact-bench.json`](tests/fixtures/compact-bench.json).

## Tuning

All knobs are env-var driven; defaults are tuned for typical agent flows.

| Env var                              | Default                                         | Purpose                                               |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------------------------- |
| `AZURE_PRICING_HTTP_TIMEOUT`         | 30.0 s                                          | Per-request timeout for the Retail Prices API.        |
| `AZURE_PRICING_HTTP_POOL_SIZE`       | 20                                              | Total connections in the aiohttp pool.                |
| `AZURE_PRICING_HTTP_POOL_PER_HOST`   | 10                                              | Per-host cap (Azure Retail Prices is a single host).  |
| `AZURE_PRICING_DEDUP_TTL`            | 300 s                                           | Reuse window for successful pricing responses.        |
| `AZURE_PRICING_NEG_TTL`              | 60 s                                            | Short reuse window for empty (`Items: []`) responses. |
| `AZURE_PRICING_DEDUP_MAX_ENTRIES`    | 512                                             | LRU cap for the in-memory dedup cache.                |
| `AZURE_PRICING_CACHE_DIR`            | `${XDG_CACHE_HOME:-~/.cache}/azure-pricing-mcp` | Disk-backed retirement + pricing cache root.          |
| `AZURE_PRICING_DISK_CACHE_ENABLED`   | `true`                                          | Mirror successful pricing responses to disk.          |
| `AZURE_PRICING_DISK_CACHE_TTL`       | 86400 s (24 h)                                  | TTL for disk-cached pricing responses.                |
| `AZURE_PRICING_DISK_CACHE_MAX_BYTES` | 524288000 (500 MB)                              | Size cap for the disk pricing cache.                  |
| `AZURE_PRICING_SSL_VERIFY`           | `true`                                          | Set to `false` behind a proxy with self-signed certs. |

In-flight request coalescing is automatic: N concurrent calls with the same
`(filter, currency, limit)` key share one HTTP round-trip via an
`asyncio.Future`.

## Architecture sketch

```text
stdio MCP client (VS Code, Claude Desktop)
        │
        ▼
mcp.server.Server   ← create_server() in server.py
        │   • list_tools  → tools.py
        │   • call_tool   → ToolHandlers
        ▼
ToolHandlers (handlers.py)
        │   pop response_format → call service → format response
        ▼
PricingService / SKUService / BulkEstimateService / Spot / Orphaned / PTU
        │   request-dedup cache + in-flight coalescing + negative-result TTL
        │
        ▼
AzurePricingClient (aiohttp.ClientSession; lifetime: server-scoped)
        │
        ▼
Azure Retail Prices API   +   MicrosoftDocs/azure-compute-docs
                              (retirement cache → memory + disk)
```

`ToolHandlers` composes a service call with a presentation-layer formatter;
`response_format` is popped at the handler boundary so service kwargs stay
clean. The aiohttp session is opened once via
`async with AzurePricingServer(): ...` and shared across every tool call.

## What's new in v5.4

- **Usage-aware projection.** `azure_bulk_estimate` and
  `azure_cost_estimate` accept a `usage` dict per resource so
  transaction-based and storage-retention meters get projected
  correctly. Keys: `transactions_per_month`, `gb_stored`,
  `gb_transferred`, `seconds_runtime`. Without `usage`, those meters
  still return $0 with a warning (v5.3 behaviour preserved).
- **`product_filter` per resource.** Substring match against
  `productName` so multi-product services like Storage Account
  (Tables / Block Blob / Queues / Files share the same skuName) can be
  modelled as separate line items with their own usage assumptions.
- **Zero-cost service fallbacks.** Virtual Network base, Resource Group,
  and Managed Identity now resolve to `$0` via static fallbacks
  instead of matching unrelated meters (e.g. v5.3 picked
  "Public IP Prefix Standard" for "Virtual Network / Standard"
  → bogus $4.38/mo).
- **Smarter meter tie-breaks.** When `usage` is supplied, the meter
  selector prefers the dimension matching the supplied usage key, then
  picks the **cheapest** rate in that dimension (typical baseline) —
  reverses v5.3's descending-price tie-break which was right for
  surfacing the actual SKU rate over add-ons but wrong for picking
  Key Vault Operations ($0.03/10K) over Renewals ($0.15/10K).
- **Private Endpoint static fallback** tuned to Microsoft's flat
  $7.20/PE/month from the public pricing page (was $0.01/hr × 730 = $7.30).
- **Reproducibility verified** against the
  [bmit-2026 malta-catering](https://github.com/jonathan-vella/bmit-2026/blob/main/agent-output/malta-catering/03-des-cost-estimate.md)
  reference cost estimate (generated 2026-04-14): v5.4 returns $147.22
  for the same 8-resource workload vs the reference's $154.87 — within
  5%. The remaining $7.65 gap is the Storage Tables write-ops line, where
  the reference used $0.0325/10K ($8.45/mo); the current Microsoft API
  returns $0.00036/10K for swedencentral Standard LRS ($0.09/mo). v5.4
  uses live API data, so the result is **more accurate** than the
  reference for that line.

## What's new in v5.3

- **Unit-aware monthly-cost projection.** Fixes the v5.0–v5.2 bug where
  `azure_bulk_estimate` and `azure_cost_estimate` blindly multiplied
  `retailPrice × 730` regardless of the actual `unitOfMeasure`. The
  Retail Prices API frequently returns multiple meters per SKU (ACR
  Premium has 7: GB/Month, 1/Day, 1 Second, …). v5.3 picks the most
  likely primary billing meter (Hour > Day > Month > GB-Month > …) and
  projects to monthly using the meter's actual dimension. Verified
  example: ACR Premium now returns the correct ≈$50.65/mo (was $73).
- **Service-name and SKU-name normalization.** `"Storage Account"` →
  `"Storage"`, `"Standard LRS GPv2"` → `"Standard LRS"`. Trailing user
  suffixes that the API doesn't carry are stripped before lookup.
- **Static-fallback prices for un-API'd SKUs.** Private DNS Zone and
  Private Endpoint flat-fee meters are documented on Microsoft's
  pricing page but not exposed through the public Retail Prices API.
  v5.3 ships a small fallback table sourced from the pricing pages so
  these meters no longer return `no pricing found`.
- **Exact-SKU-match preference in meter selection.** Prevents the v5.2
  regression where `Key Vault Standard` matched the much more
  expensive `Standard B1` (Managed HSM Pool) at $3.20/hr because both
  contained the substring "Standard".
- **`available_meters[]` array in `estimate_costs` output.** Surfaces
  the alternative meters the heuristic considered, so the
  cost-estimate-subagent can flag mismatches and re-query.
- **Hardened cost-estimate-subagent.** New "Sanity checks" rules guide
  the subagent to retry per-line with `azure_price_search` when
  bulk_estimate emits a `projection_warning` or returns a sku-name that
  differs from what the caller requested.

## What's new in v5.2

- **`outputSchema` on every in-scope tool.** All 11 high-volume read
  tools now declare a permissive pydantic-derived JSON Schema in
  `Tool.outputSchema`, and the handlers emit a structured-content
  payload validated against it. MCP clients can now consume both the
  rendered text and the underlying typed dict in a single tool call.
- **`MCPToolResponse` envelope.** A small list-subclass that carries an
  optional `.structured` payload as an attribute. Existing list-shape
  callers (and every test from v5.0/v5.1) work unchanged; the
  dispatcher in `server.py` translates `.structured` into the SDK's
  tuple form when present.
- **`schemas.py` registry.** Per-tool envelope models with
  `extra="allow"` so service-layer additions stay contract-stable.
  Permissive by design — strict typing scheduled for v6.0.
- **No behavior change for legacy text-only tools.** Out-of-scope
  trivial-response tools (`get_customer_discount`, `azure_ptu_sizing`,
  `simulate_eviction`, etc.) still return plain `list[TextContent]`.

## What's new in v5.1

- **`models.py` is now pydantic.** All 6 internal models migrated from
  `@dataclass` to `pydantic.BaseModel`, unblocking future MCP
  `outputSchema` derivation and structured-content emission.
- **Admin tier extracted to `admin/` package.** Spot VM tools and
  orphaned-resource detection now live under
  `azure_pricing_mcp/admin/` with an import-time probe that gates
  registration on the presence of `azure-identity`. Without `[admin]`
  extras, those tools simply aren't registered and the server logs a
  friendly install hint.
- **Tool dispatch ladder eliminated.** The v5.0 `if name == "x" / elif`
  chain in `server.py` is now an O(1) dispatch dict. Adding a tool no
  longer requires editing a routing branch.
- **No behavior change for existing consumers.** All 208 tests pass
  unchanged; aggregate compact bench unchanged at 45.9% of v4 baseline.

## What's new in v5.0

- **Token-efficient default.** New `response_format` parameter
  (`compact | table | full`, default `compact`) on the high-volume read
  tools. Compact output is ≈ 46 % of v4 byte size in aggregate.
- **MCP tool annotations on every tool.** Read tools advertise
  `readOnlyHint + idempotentHint`; `simulate_eviction` is flagged
  `destructiveHint + openWorldHint`.
- **Performance hardening.** On-disk retirement cache (cold-start warmup),
  in-flight request coalescing, configurable negative-result TTL via
  `AZURE_PRICING_NEG_TTL`.
- **`[azure]` → `[admin]` extras** rename (alias preserved for one release).
- **`azure_discover_skus` deprecated** to a thin alias of
  `azure_sku_discovery`.
- **Stdio-only.** v4's HTTP/SSE transport (and its Docker delivery vehicle)
  was removed in v5.0 — every consumer uses stdio.
- **Repo modernization.** Python ≥ 3.14, uv lockfile replaces
  `requirements.txt`, `ruff format` replaces `black`, CI gates `mypy` +
  `bandit`, multi-arch wheels for every pinned dep.

Full release notes: [CHANGELOG.md](CHANGELOG.md).

## Migration from v4

| v4                                    | v5                                                            |
| ------------------------------------- | ------------------------------------------------------------- |
| `output_format: "compact"`            | `response_format: "compact"` (was silently dropped in v4)     |
| `azure_discover_skus(service_name=…)` | `azure_sku_discovery(service_hint=…)` — alias still works     |
| `pip install '.[azure]'`              | `pip install '.[admin]'` (`[azure]` is a deprecation alias)   |
| `pip install -r requirements.txt`     | `uv pip install -e ".[dev]"` (uv.lock is the source of truth) |
| `--transport http` (Docker/SSE)       | _removed_ — stdio only                                        |

If a client depends on the verbose v4 string shape (e.g. parses
`Found N pricing results...` + JSON dump), pin
`response_format: "full"` for byte-for-byte back-compat.

## Project structure

```
tools/mcp-servers/azure-pricing/
├── src/azure_pricing_mcp/
│   ├── server.py             # MCP server bootstrap (stdio)
│   ├── handlers.py           # Tool handlers (response_format-aware)
│   ├── tools.py              # Tool definitions + annotations + shared schemas
│   ├── formatters.py         # compact|table|full renderers
│   ├── response_format.py    # ResponseFormat literal + RESPONSE_FORMAT_SCHEMA
│   ├── client.py             # aiohttp.ClientSession + Retail Prices API
│   ├── config.py             # Defaults + env-var bindings
│   ├── models.py             # pydantic models (v5.1)
│   ├── services/             # PricingService, SKUService, Bulk, Spot, …
│   ├── admin/                # Admin-tier tools — gated by [admin] extras (v5.1)
│   ├── databricks/           # Databricks DBU sub-package
│   └── github_pricing/       # GitHub pricing sub-package
├── tests/                    # pytest suite + fixtures (incl. baseline-bytes.json)
├── scripts/                  # install.py, setup helpers, dev/ debug scripts
├── pyproject.toml            # uv-driven; v5.4.0
├── CHANGELOG.md
└── README.md                 # (you are here)
```

## API reference

This server proxies the public
[Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)
at `https://prices.azure.com/api/retail/prices`. **No authentication required**
for the core tools. Admin-tier tools (spot, orphaned-resources) call Azure
Resource Graph + Cost Management and require `az login` (or
`DefaultAzureCredential`-compatible env vars).

## Acknowledgments

Independent fork of upstream
[`msftnadavbh/AzurePricingMCP`](https://github.com/msftnadavbh/AzurePricingMCP).
Substantial contributions from the upstream project are gratefully
acknowledged:

- Original author: [@charris-msft](https://github.com/charris-msft)
- Upstream maintainer: [@msftnadavbh](https://github.com/msftnadavbh)
- Upstream contributors:
  [@notoriousmic](https://github.com/notoriousmic),
  [@iditbnaya](https://github.com/iditbnaya),
  [@roy2392](https://github.com/roy2392)
- v5.0+ maintainer: [@jonathan-vella](https://github.com/jonathan-vella)

Built on the [Model Context Protocol](https://modelcontextprotocol.io/) and
the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).

## Support

- Issues: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- Discussions: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)

## License

[MIT](LICENSE).
