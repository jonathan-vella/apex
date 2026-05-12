# Plan: Azure Pricing MCP — Independent Fork v5.0

Modernize the user-owned `tools/mcp-servers/azure-pricing/` server (currently
v4.0.0) into a token-efficient, performant, self-attributed independent
project. Keep the architect agent + cost subagent working without breakage,
modernize internals (FastMCP, Streamable HTTP, uv, on-disk caching),
consolidate the duplicate SKU-discovery tools via a deprecation alias path,
and bump to v5.0.0.

> **Revised post adversarial review.** All 🔴 hallucinations, 🟠 errors,
> 🟡 risks, 🟢 gaps, and 🔵 minors from the review applied. See
> "Findings Addressed" at the bottom for traceability.

## Decisions (from clarification round)

- **Breaking changes**: Free hand → bump to v5.0.0
- **Token strategy**: `response_format: compact|table|full` parameter, default `compact`. **No prior `output_format` flag exists in the server source** — agent prompts reference one, but it's silently ignored (logged as bug B1). Build from scratch.
- **Fork status**: Independent project. Acknowledgments credit upstream, all URLs/badges/CI point to `jonathan-vella/azure-agentic-infraops`.
- **Package name**: keep `azure-pricing-mcp`.
- **Publish target**: monorepo only (no PyPI / no spinoff repo / no GHCR).
- **Transport**: stdio is the only consumer; modernize HTTP→Streamable HTTP for optional Docker; deprecate raw SSE.
- **Destructive tools**: keep `simulate_eviction` as-is (user choice).
- **Dep mgmt**: switch to `uv` lockfile, drop `requirements.txt`.
- **Tool overlap**: `azure_discover_skus` + `azure_sku_discovery` both referenced — merge cautiously with alias.
- **Scope** (selected): performance, token reduction, documentation, repo hygiene, tool-surface redesign, FastMCP migration, Streamable HTTP, CI (skip PyPI per `publish-target`).
- **Ad-hoc tools retained**: `spot_*`, `azure_ptu_sizing`, `databricks_*`, `github_*`, `get_customer_discount`, `find_orphaned_resources`, `simulate_eviction` all stay (manual/ad-hoc invocation by humans). They get annotations + outputSchema + FastMCP treatment but are NOT promoted in agent flows. `response_format` is added only to tools whose current responses exceed ~100 tokens (see step 4 scope list).
- **`[azure]` extras split** (Option A): separate `[admin]` extra. Gate registration of admin-tier tools via a multi-import probe at module load.
- **Negative-result TTL**: configurable via `AZURE_PRICING_NEG_TTL` (default 60 s).
- **FastMCP**: lands in v5.0 (not deferred).
- **Logging**: drop `structlog` plan — out of scope for v5.0; revisit if HTTP transport gets external deployment.
- **Python floor**: bumped to **Python 3.14** (latest stable, released Oct 2025) — **already applied repo-wide** (devcontainer, root pyproject, apex-recall, azure-pricing, CI, weekly-maintenance, instructions, project skills, dev-containers doc). Drop 3.10/3.11/3.12 support; 3.10 EOLs Oct 2026. See "Modernization Floor" below.
- **Dependency strategy**: pin every runtime dep to its **latest stable** in `pyproject.toml`; regenerate `uv.lock` from scratch; kill legacy build cruft (`wheel`, `[tool.black]`, etc.).

## Modernization Floor (Python + dependencies)

Goal: zero forward-tech-debt. The MCP runs the latest stable of everything
the day v5.0 ships. Re-checked monthly via `weekly-maintenance.yml`
(extended in step 19).

### Python pin — STATUS: ✅ APPLIED (May 2026)

All project surfaces below were bumped to **Python 3.14** in the same commit
that introduced this plan. Step 18 (Dockerfile + CI) is therefore
_verification + dep modernization_, not a fresh bump.

| Surface                                                              | Old      | New                  | Status |
| -------------------------------------------------------------------- | -------- | -------------------- | ------ |
| `.devcontainer/devcontainer.json` Python feature                     | `3.13`   | `3.14`               | ✅     |
| `.devcontainer/README.md`                                            | `3.13`   | `3.14`               | ✅     |
| Root `pyproject.toml requires-python`                                | `>=3.10` | `>=3.14`             | ✅     |
| Root `[tool.ruff] target-version`                                    | `py310`  | `py314`              | ✅     |
| `tools/apex-recall/pyproject.toml requires-python`                   | `>=3.10` | `>=3.14`             | ✅     |
| `tools/apex-recall` `license`                                        | `{text}` | SPDX `"MIT"`         | ✅     |
| `tools/apex-recall` build `setuptools`                               | `>=68`   | `>=77`               | ✅     |
| `tools/mcp-servers/azure-pricing/pyproject.toml requires-python`     | `>=3.10` | `>=3.14`             | ✅     |
| `tools/mcp-servers/azure-pricing` classifiers                        | 3.10–12  | `3.14` only          | ✅     |
| `tools/mcp-servers/azure-pricing` `[tool.ruff]`                      | `py310`  | `py314`              | ✅     |
| `tools/mcp-servers/azure-pricing` `[tool.mypy]`                      | `3.10`   | `3.14`               | ✅     |
| `tools/mcp-servers/azure-pricing` `[tool.black]`                     | py310-12 | `py314` (drop in 19) | ✅     |
| `tools/mcp-servers/azure-pricing/Dockerfile`                         | `3.13`   | `python:3.14-slim`   | ✅     |
| `tools/mcp-servers/azure-pricing/.pre-commit-config.yaml` black hook | `3.10`   | `3.14` (drop in 19)  | ✅     |
| `tools/mcp-servers/azure-pricing/README.md` badge                    | 3.10+    | 3.14                 | ✅     |
| `.github/workflows/ci.yml`                                           | `3.12`   | `3.14`               | ✅     |
| `.github/workflows/weekly-maintenance.yml`                           | `3.12`   | `3.14`               | ✅     |
| `.github/instructions/python.instructions.md`                        | 3.10+    | 3.14                 | ✅     |
| `.github/instructions/code-quality.instructions.md`                  | 3.10+    | 3.14                 | ✅     |
| `.github/skills/azure-governance-discovery/SKILL{,.digest}.md`       | 3.10+    | 3.14                 | ✅     |
| `.github/skills/context-optimizer/SKILL{,.digest}.md`                | 3.10+    | 3.14                 | ✅     |
| `site/src/content/docs/getting-started/dev-containers.md`            | 3.13+    | 3.14                 | ✅     |
| `egg-info/` directories (stale Python classifiers)                   | tracked  | deleted (gitignored) | ✅     |

**Files deliberately NOT bumped** (user-facing skill recipes describing the
Azure _runtime_ version for end-user apps, not the project's own Python):

- `.github/skills/azure-prepare/references/recipes/azd/docker.md` (`python:3.13-slim`)
- `.github/skills/azure-prepare/references/services/functions/terraform.md` (`python_version = "3.11"`)
- `.github/skills/azure-prepare/references/services/app-service/README.md` (`Python 3.12`)
- `.github/skills/microsoft-foundry/foundry-agent/create/create.md` (`python:3.12-slim`)

**Pending follow-up** (requires devcontainer rebuild):

- The current `.venv` at `tools/mcp-servers/azure-pricing/.venv` is on Python 3.13. Rebuilding the devcontainer will trigger `post-create.sh` to recreate it on Python 3.14. The `weekly-maintenance.yml` `uv lock --upgrade` job (step 19) will keep deps fresh thereafter.

### Runtime deps (pyproject.toml)

| Package         | Current floor | New floor (latest stable, May 2026) | Notes                                                          |
| --------------- | ------------- | ----------------------------------- | -------------------------------------------------------------- |
| `mcp`           | `>=1.0.0`     | `>=1.27.0` (vendored in `.venv`)    | FastMCP + streamable_http both stable                          |
| `aiohttp`       | `>=3.9.0`     | `>=3.11.0`                          | 3.11 has the connection-pool fixes we exercise                 |
| `pydantic`      | `>=2.0.0`     | `>=2.10.0`                          | needed for FastMCP v2 outputSchema gen                         |
| `uvicorn`       | `>=0.27.0`    | `>=0.32.0`                          | drop `uvicorn[standard]` extras unless we measurably need them |
| `starlette`     | `>=0.36.0`    | `>=0.41.0`                          | required by FastMCP streamable_http                            |
| `sse-starlette` | `>=1.8.0`     | **DROP**                            | replaced by `mcp.server.streamable_http` (step 16)             |

Add (new for v5.0):

- `cachetools>=5.5.0` — typed TTL cache for the negative-result + retirement
  layers (replaces hand-rolled dict eviction in [pricing.py:73-80](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/pricing.py)).

### `[admin]` deps (formerly `[azure]`)

| Package                     | New floor  |
| --------------------------- | ---------- |
| `azure-identity`            | `>=1.19.0` |
| `azure-mgmt-compute`        | `>=33.0.0` |
| `azure-mgmt-network`        | `>=28.0.0` |
| `azure-mgmt-resource`       | `>=23.0.0` |
| `azure-mgmt-subscription`   | `>=3.1.1`  |
| `azure-mgmt-web`            | `>=8.0.0`  |
| `azure-mgmt-resourcegraph`  | `>=8.0.1`  |
| `azure-mgmt-costmanagement` | `>=4.0.1`  |

Verify each `azure-mgmt-*` actually has a 3.14 wheel before pinning — track
in step 18; fall back to `>=3.13` only if a specific package blocks 3.14.

### `[dev]` deps

| Package          | Current    | New        | Notes                        |
| ---------------- | ---------- | ---------- | ---------------------------- |
| `pytest`         | `>=7.0.0`  | `>=8.3.0`  |                              |
| `pytest-asyncio` | `>=0.21.0` | `>=0.24.0` | strict-mode default in 0.23+ |
| `pytest-mock`    | `>=3.12.0` | `>=3.14.0` |                              |
| `ruff`           | `>=0.1.0`  | `>=0.7.0`  | `ruff format` replaces black |
| `mypy`           | `>=1.0.0`  | `>=1.13.0` | 3.14 type-syntax support     |
| `black`          | `>=23.0.0` | **DROP**   | use `ruff format`            |
| `pre-commit`     | `>=3.5.0`  | `>=4.0.0`  |                              |
| `bandit`         | `>=1.7.0`  | `>=1.8.0`  |                              |

Add:

- `tiktoken>=0.8.0` — for the Phase-0b token-budget bench harness (move
  later to a `[bench]` extra if it bloats default install).

### Build-system (`pyproject.toml [build-system]`)

| Field           | Old                             | New                         |
| --------------- | ------------------------------- | --------------------------- |
| `requires`      | `["setuptools>=65.0", "wheel"]` | `["setuptools>=77.0"]`      |
| `build-backend` | `setuptools.build_meta`         | unchanged                   |
| `license` field | `{text = "MIT"}` (deprecated)   | `"MIT"` (PEP 639 SPDX expr) |

Drop `wheel` from `requires` — modern setuptools/pip handles it; PEP 517
build frontends provide their own wheel builder.

### Files deleted by modernization

- `requirements.txt` (uv.lock owns it)
- `MANIFEST.in` (no sdist publishing; broken refs)
- `[tool.black]` block in pyproject.toml
- `black` from `[dev]` extras
- `sse-starlette` from runtime deps
- `scripts/setup.py` (legacy)

### Files unchanged but verified compatible

- `.pre-commit-config.yaml` — bumped to use new ruff hook (ruff replaces
  black + isort + flake8). See step 19.

## Consumer Impact Map (verified)

Tools called by agents in this repo (must stay or alias):
| Tool | Architect | Cost Subagent | Templates |
| -------------------------- | --------- | ------------- | --------- |
| `azure_bulk_estimate` | primary | primary | yes |
| `azure_region_recommend` | yes | yes | yes |
| `azure_price_search` | yes | yes (fallback)| yes |
| `azure_price_compare` | — | yes | — |
| `azure_cost_estimate` | fallback | fallback | yes |
| `azure_discover_skus` | yes | yes | — |
| `azure_sku_discovery` | — | — | yes |

Tools with no internal agent consumer — kept for **ad-hoc / human-driven**
invocation. They get FastMCP + annotations + outputSchema (where the response
justifies it) but are NOT promoted in agent prompts. `response_format` is
applied selectively per the step-4 scope list:
`spot_*`, `simulate_eviction`, `find_orphaned_resources`, `azure_ptu_sizing`,
`databricks_*`, `github_*`, `get_customer_discount`.

Transport: stdio only (per `.vscode/mcp.json`). HTTP/SSE unused.

## Known Bugs Surfaced

- **B1** — Agent prompts at [cost-estimate-subagent.agent.md:251](.github/agents/_subagents/cost-estimate-subagent.agent.md) instruct calls with `output_format: "compact"`, but no such parameter exists in the server. The argument is silently dropped. Fixed by step 4 (introduce `response_format`) + step 7 (rewrite agent prompts).

## Phases & Steps

### Phase 0 — Baseline, safety net & bug audit (PREREQUISITE)

0a. **Tag the rollback point.** Before any v5.0 work: `git tag v4.0.0-final && git push --tags`. Document recovery path in CHANGELOG.
0b. **Capture token-budget baselines** (referenced by verification step 2). - Boot the current main, call `azure_bulk_estimate` with a fixed canonical workload (10 resources × 3 regions, USD, no discount). Record byte size + token estimate (use `tiktoken` or character/4 heuristic). Same for `azure_price_search`, `azure_region_recommend`, `azure_cost_estimate`, `azure_price_compare`, `azure_sku_discovery`, `find_orphaned_resources`, `databricks_dbu_pricing`, `github_pricing`. Store as `tools/mcp-servers/azure-pricing/tests/fixtures/baseline-bytes.json`. - Threshold rule for verification: compact ≤ **20 %** of baseline; full ≤ **80 %** of baseline. Exact KB targets are derived, not guessed.
0c. **Confirm count-manifest scope.** Read [tools/registry/count-manifest.json](tools/registry/count-manifest.json) once; if it tracks MCP tool counts, step 3 must update it; if not, drop that sub-step. (G3)
0d. **Inventory output-shape consumers (R1).** `grep` every consumer for hard-coded substrings of current responses (`💰 Customer Discount Applied:`, `**Detailed Pricing:**`, `🥇 Cheapest:`, `Found N Azure pricing results`, `Region Recommendations for`, etc.). Record matches in `tests/fixtures/consumer-grep.txt`. Each match is a step-7 deliverable to update in lockstep.

### Phase 1 — Repo hygiene & re-attribution (low risk)

1. Re-attribute the project as independent.
   - [README.md](tools/mcp-servers/azure-pricing/README.md): replace `msftnadavbh/AzurePricingMCP` clone URL + Tests badge + Issues + Discussions links with `jonathan-vella/azure-agentic-infraops` + path. Move existing maintainers (Nadav, Michael, charris-msft) into a single "Acknowledgments" section.
   - [pyproject.toml](tools/mcp-servers/azure-pricing/pyproject.toml): replace `authors`/`maintainers` with `Jonathan Vella`. Bump version to `5.0.0`.
   - [scripts/setup.py](tools/mcp-servers/azure-pricing/scripts/setup.py): delete (legacy file — `pyproject.toml` is canonical; setup.py with hard-coded URL is redundant).
   - Delete `src/azure_pricing_mcp.egg-info/` after metadata changes (regenerated by `pip install -e .`).
2. Delete dead/cruft files.
   - Add `src/azure_pricing_mcp.egg-info/` and `.venv/` to [.gitignore](tools/mcp-servers/azure-pricing/.gitignore) and `git rm -r --cached`.
   - Move dev-only scripts into `scripts/dev/`: `debug_handler_return.py`, `debug_suggestions.py`, `simulate_mcp_call.py`, `exact_mcp_handler_test.py`, `find_app_service.py`, `run_server.py`.
   - **Preserve in `scripts/`** (referenced by Dockerfile/.dockerignore or shipped tooling): `healthcheck.py` ([Dockerfile:20,31](tools/mcp-servers/azure-pricing/Dockerfile)), `install.py`, `setup.ps1`, `test_setup.ps1`, `docker-build.sh`, `docker-build.ps1`. (G2)
   - Delete dead `register_tool_handlers()` in [handlers.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/handlers.py#L264) (server.py owns the active `_register_tool_handlers`; the duplicate has a stale tool list missing `azure_bulk_estimate`/`databricks_*`/`github_*`).
3. Fix tool-count drift.
   - README "18 tools" → reflect actual registered count from server.py (currently 19 with `azure_bulk_estimate`).
   - If [count-manifest.json](tools/registry/count-manifest.json) tracks MCP tools (verified in step 0c), update it and run `npm run validate:agents`.

### Phase 2 — Token reduction (highest user-visible win)

_Parallel with phase 1; both touch documentation only on the surface._

4. Add `response_format` parameter (`compact|table|full`, default `compact`) — **scoped, not blanket** (G1).
   - **Apply to** the 11 high-volume read tools: `azure_bulk_estimate`, `azure_price_search`, `azure_price_compare`, `azure_cost_estimate`, `azure_region_recommend`, `azure_discover_skus`, `azure_sku_discovery`, `azure_ri_pricing`, `find_orphaned_resources`, `databricks_dbu_pricing`, `github_pricing`.
   - **Skip** trivial-response tools (return as-is): `get_customer_discount`, `simulate_eviction`, `spot_eviction_rates` (already short), `spot_price_history`, `azure_ptu_sizing`, `databricks_cost_estimate`, `databricks_compare_workloads`, `github_cost_estimate`.
   - This is **net-new code** — there is no `output_format` flag to "generalize" (B1; see Decisions). Implement once in a shared [formatters.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/formatters.py) helper.
   - `compact` = markdown table or single-line summary, no `json.dumps(indent=2)`, no decorative emoji on detail rows, drop redundant fields (`location` when `armRegionName` present, empty `savings_plans` arrays, identical `original_price` when no discount).
   - `table` = markdown table only, no JSON.
   - `full` = current behavior (back-compat for any client that depends on JSON shape).
5. Refactor formatters to compute response from a typed model, not concat-loops.
   - Replace the `response_text += f"..."` chains in [formatters.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/formatters.py) with a `ResponseBuilder` (header → table → footnotes) that emits `compact` / `table` / `full` based on the format flag.
   - Pull discount-tip messages to a single conditional footer that's omitted in `compact` mode (currently emitted on every result — high token cost).
   - Drop `**Detailed Pricing:**\n` + indented JSON dump from `format_price_search_response` in compact mode.
6. Audit tool/argument descriptions for redundancy.
   - Many `discount_percentage` / `show_with_discount` description blocks repeat 3-line prose across 4 tools — extract to a shared description constant and shorten.
   - Same for `currency_code` (default USD) repeated everywhere.
7. Update agent templates + downstream consumers in lockstep with the default flip.
   - From the Phase-0d grep results, update every match: [.github/agents/03-architect.agent.md](.github/agents/03-architect.agent.md), [.github/agents/\_subagents/cost-estimate-subagent.agent.md](.github/agents/_subagents/cost-estimate-subagent.agent.md), [.github/skills/azure-artifacts/references/cost-estimate-sections.md](.github/skills/azure-artifacts/references/cost-estimate-sections.md), [.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md](.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md), [.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md](.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md).
   - Replace `output_format: "compact"` with `response_format: "compact"` (B1).
   - Migrate any string-shape parsers to use `response_format: "full"` for back-compat OR adopt the new compact shape.

### Phase 3 — Performance

8. On-disk cache for slow-changing static data.
   - Retirement docs (24 h TTL) and previous-gen docs currently re-fetch from GitHub on every cold start. Persist to `${XDG_CACHE_HOME:-~/.cache}/azure-pricing-mcp/retirement.json` with the existing `RETIREMENT_CACHE_TTL`.
   - Target: [retirement.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/retirement.py#L156).
9. Add in-flight request coalescing to the pricing client.
   - When N concurrent agent calls hit the same `(filter, currency, limit)` key, share one in-flight `asyncio.Future` (current dedup cache only deduplicates _completed_ responses, not in-flight ones).
   - Target: `_fetch_prices_cached` in [pricing.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/pricing.py#L59).
10. Parallelize sequential fan-out paths.
    - **Audit `azure_region_recommend` only** — it iterates regions sequentially.
    - [bulk.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/bulk.py) **already uses** `BULK_CONCURRENCY_LIMIT = 5` semaphore-style dispatch; verify the limit is enforced after `response_format` plumbing changes, no rewrite needed (E2).
11. Add negative-result caching with shorter TTL — configurable via `AZURE_PRICING_NEG_TTL` (default 60 s).
    - Currently empty `Items` results are cached with the same 5-min TTL as hits — agents retry within minutes and pay full HTTP latency.
    - Wire env var into [config.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/config.py) alongside the existing `REQUEST_DEDUP_TTL`.

### Phase 4 — Tool-surface redesign (depends on phases 1-2)

12. Consolidate `azure_discover_skus` + `azure_sku_discovery` without breaking consumers.
    - Make `azure_sku_discovery` the canonical implementation (it has fuzzy matching).
    - Keep `azure_discover_skus` as a _thin alias_ that forwards to `azure_sku_discovery` with `service_hint = service_name`. Mark as deprecated in description (`[DEPRECATED v5.0 — use azure_sku_discovery]`).
    - Update [03-architect.agent.md](.github/agents/03-architect.agent.md) and skills templates that reference `azure_discover_skus` to migrate.
    - Schedule full removal in v6.0.
13. Add MCP tool annotations.
    - `readOnlyHint: true` on all read tools; `idempotentHint: true` on pricing reads.
    - `destructiveHint: true` + `openWorldHint: true` on `simulate_eviction`.
    - Per current MCP spec — reduces agent confusion + improves client UX.
14. Add `outputSchema` to each tool definition (per MCP spec).
    - Lets clients validate responses + reduces "free-form parsing" tokens on the agent side.
    - **The dataclasses in [models.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/models.py) are NOT pydantic** (H2). Two options: (a) selectively migrate the 6 dataclasses needed for tool outputs to `pydantic.BaseModel` (FastMCP-friendly, auto-schema); (b) hand-author JSON Schema dicts in a new `schemas.py`. Pick (a) for the 11 tools getting `response_format`; hand-author for trivial responses. Budget for the migration is non-trivial — schedule before step 15.
15. Migrate to **FastMCP** (`mcp.server.fastmcp`).
    - Rewrite [server.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/server.py) with `@mcp.tool()` decorators + type hints — eliminates the manual `if name == "x": return await handler.x(...)` ladder (currently ~70 lines in `_register_tool_handlers`).
    - Use type annotations + docstrings + the pydantic models from step 14 as the schema source of truth (kills the duplication between [tools.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/tools.py) `inputSchema` blocks and Python signatures).
    - **Port the shared aiohttp session into a FastMCP `lifespan`** async context manager (R2). Otherwise the per-call session reuse from v3.0.0 silently regresses. Pattern:
      ```python
      @asynccontextmanager
      async def lifespan(app):
          async with AzurePricingClient() as client:
              yield {"client": client, ...}
      mcp = FastMCP("azure-pricing", lifespan=lifespan)
      ```
    - **Test rewrite required** (E3). Inventory + update:
      - [tests/test_mcp_server.py:74](tools/mcp-servers/azure-pricing/tests/test_mcp_server.py) `create_server(return_pricing_server=False)` — no longer applicable.
      - Any test instantiating `AzurePricingServer` directly or asserting the `(Server, AzurePricingServer)` tuple shape.
      - The `register_tool_handlers` import path (deleted in step 2).
        Run `npm run test:azure-pricing-mcp` after every renaming pass; the suite is the regression net.
16. Modernize HTTP transport.
    - Replace `mcp.server.sse.SseServerTransport` (deprecated) with `mcp.server.streamable_http` per current MCP spec. stdio remains primary.
    - Update [Dockerfile](tools/mcp-servers/azure-pricing/Dockerfile) entrypoint flags accordingly.
17. **Split `[azure]` extras → `[admin]` extra** (Option A, confirmed).
    - Move `azure-identity`, `azure-mgmt-compute`, `azure-mgmt-network`, `azure-mgmt-resource`, `azure-mgmt-subscription`, `azure-mgmt-web`, `azure-mgmt-resourcegraph`, `azure-mgmt-costmanagement` from `[azure]` to a new `[admin]` extra in [pyproject.toml](tools/mcp-servers/azure-pricing/pyproject.toml).
    - **Restructure**: move admin-tier tools (`spot_*`, `simulate_eviction`, `find_orphaned_resources`) into a new `azure_pricing_mcp/admin/` package (R3). FastMCP decorators run at import time, so gating must happen via _conditional import_, not in-decorator try/except:
      ```python
      # server.py
      try:
          from .admin import register_admin_tools
          _ADMIN_OK = True
      except ImportError as e:
          _ADMIN_MISSING = str(e)
          _ADMIN_OK = False
      if _ADMIN_OK:
          register_admin_tools(mcp)
      else:
          logger.info(
              "[admin] extras not installed — N admin tools unavailable. "
              "Install with: pip install 'azure-pricing-mcp[admin]'. (%s)",
              _ADMIN_MISSING,
          )
      ```
    - **Multi-import probe** (R4) — admin package's `__init__.py` imports all required modules at top:
      ```python
      import azure.identity                    # auth
      import azure.mgmt.resourcegraph          # spot + orphaned
      import azure.mgmt.compute                # simulate_eviction + spot eviction sim
      import azure.mgmt.costmanagement         # orphaned cost lookup
      ```
      Any single missing module → ImportError → all admin tools cleanly skipped.
    - Keep the empty `[azure]` extra as a deprecation alias of `[admin]` for one release; remove in v6.0.
    - Update [.vscode/mcp.json](.vscode/mcp.json#L7) and [.github/workflows/ci.yml](.github/workflows/ci.yml#L132) to install `[dev,admin]` so CI continues to exercise admin-tier tests.
    - Update [docs/TOOLS.md](tools/mcp-servers/azure-pricing/docs/TOOLS.md) with an "Extras required" column.

### Phase 5 — Tooling, CI & Docker

18. Switch dependency management to `uv` and bump every dep to latest (per Modernization Floor).
    - Generate `uv.lock` from a freshly-rewritten [pyproject.toml](tools/mcp-servers/azure-pricing/pyproject.toml). Delete [requirements.txt](tools/mcp-servers/azure-pricing/requirements.txt).
    - Delete [MANIFEST.in](tools/mcp-servers/azure-pricing/MANIFEST.in) — it currently references **non-existent files** (`QUICK_START.md`, `config_examples.json`) and we are not publishing sdists (E1). README inclusion is handled by `project.readme` in pyproject.toml; no other non-package data is needed.
    - Update [.github/workflows/ci.yml](.github/workflows/ci.yml) and [.github/workflows/weekly-maintenance.yml](.github/workflows/weekly-maintenance.yml) to **Python 3.14** + `uv pip install -e '.[dev,admin]'`. (Repo-wide bump — flag in PR.)
    - Update [Dockerfile](tools/mcp-servers/azure-pricing/Dockerfile) to multi-stage with `uv` builder + non-root runtime user, base `python:3.14-slim`. **3.14 is the latest stable** (Oct 2025); 3.10–3.12 dropped because 3.10 EOLs Oct 2026 and the modernization mandate is zero forward tech debt (H3 reframed).
    - Per-dep `azure-mgmt-*` wheel availability check on 3.14: run `uv pip install --dry-run 'azure-pricing-mcp[admin]'` against the 3.14 image; if any package blocks, fall back to `>=3.13` for _that package only_ and file a tracking issue.
19. Refresh CI workflow.
    - Ruff is **already wired** via `npm run lint:python` ([package.json:37](package.json)) (E4). Add **mypy + bandit** gates (configured in pyproject.toml but never invoked).
    - `ruff format` replaces `black` (Modernization Floor); update `npm run lint:python` to also run `ruff format --check`.
    - Add `npm run bench:azure-pricing` script (not `make:` — repo uses npm scripts; [package.json](package.json)) that exercises `azure_bulk_estimate` with `response_format=compact` and asserts response ≤ 20 % of the Phase-0b baseline. Uses `tiktoken` for token counting.
    - **Sync [.pre-commit-config.yaml](tools/mcp-servers/azure-pricing/.pre-commit-config.yaml) with the CI gates** (G5) so local commits enforce ruff (lint + format) + mypy + bandit. Drop any black hook.
    - Extend [.github/workflows/weekly-maintenance.yml](.github/workflows/weekly-maintenance.yml) to run `uv lock --upgrade` weekly and open a PR on dep drift — keeps the "latest of everything" promise without manual nagging.

### Phase 6 — Documentation

_Parallel with phase 5 once Phase 4 stabilizes._

20. Update [README.md](tools/mcp-servers/azure-pricing/README.md).
    - Re-attribution (done in step 1).
    - "What's new in v5.0" section: response_format, FastMCP, Streamable HTTP, alias deprecations, `[admin]` extras split.
    - Drop the broken upstream Tests badge URL until CI is wired in step 19.
    - Add migration guide: `output_format → response_format`, `azure_discover_skus → azure_sku_discovery`, `[azure] → [admin]`.
21. Add [tools/mcp-servers/azure-pricing/ARCHITECTURE.md](tools/mcp-servers/azure-pricing/ARCHITECTURE.md).
    - Replaces stale `docs/PROJECT_STRUCTURE.md` reference. Diagram the `client → service → handler → formatter` path, the cache layers, FastMCP `lifespan` ownership, and the `admin/` conditional package.
22. Refresh [tools/mcp-servers/azure-pricing/docs/TOOLS.md](tools/mcp-servers/azure-pricing/docs/TOOLS.md).
    - Add `response_format` column (only for the 11 in-scope tools). Mark `azure_discover_skus` deprecated. Add MCP annotation column. Add "Extras required" column.
23. Add [tools/mcp-servers/azure-pricing/docs/PERFORMANCE.md](tools/mcp-servers/azure-pricing/docs/PERFORMANCE.md).
    - Document the cache layers (request dedup, retirement disk, in-flight coalescing, negative-result), env-var tuning, expected token sizes per `response_format` (with the Phase-0b baseline as the reference point).
24. Update [tools/mcp-servers/azure-pricing/CHANGELOG.md](tools/mcp-servers/azure-pricing/CHANGELOG.md) with full v5.0.0 entry. **Fix the batch-edit dating issue** — every v3.x and v4.0 entry currently shows `2026-03-03`. Set v5.0.0 to actual release date and add a footnote acknowledging that pre-fork dates may be approximate.
25. Update repo-level docs that cross-reference this MCP.
    - [docs/CHANGELOG.md](docs/CHANGELOG.md), [.github/skills/copilot-customization/references/mcp-servers.md](.github/skills/copilot-customization/references/mcp-servers.md), [.github/skills/azure-artifacts/references/cost-estimate-standards.md](.github/skills/azure-artifacts/references/cost-estimate-standards.md), [.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md](.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md), [.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md](.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md).

## Relevant Files

- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/server.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/server.py) — FastMCP rewrite + `lifespan`-owned aiohttp session (step 15); modernize HTTP transport (step 16); conditional admin import (step 17).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/handlers.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/handlers.py) — delete dead `register_tool_handlers()` (step 2); add `response_format` plumbing (step 4).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/formatters.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/formatters.py) — biggest token surface; introduce `ResponseBuilder` + format flag (steps 4-5).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/tools.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/tools.py) — extract shared description constants (step 6); add annotations + outputSchema (steps 13-14).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/models.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/models.py) — selective dataclass→pydantic migration for outputSchema-bearing tools (step 14).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/pricing.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/pricing.py) — in-flight coalescing on `_fetch_prices_cached` (step 9); negative-result TTL (step 11); `azure_region_recommend` parallelization (step 10).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/retirement.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/retirement.py) — disk-backed cache (step 8).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/bulk.py](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/services/bulk.py) — add `response_format` plumbing only; concurrency already exists (step 4 + step 10 verification).
- [tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/admin/](tools/mcp-servers/azure-pricing/src/azure_pricing_mcp/admin/) — _new_ package for spot/orphaned/simulate-eviction tools (step 17).
- [tools/mcp-servers/azure-pricing/pyproject.toml](tools/mcp-servers/azure-pricing/pyproject.toml) — version bump, authors, `[admin]` extra, drop legacy refs.
- [tools/mcp-servers/azure-pricing/Dockerfile](tools/mcp-servers/azure-pricing/Dockerfile) — multi-stage, `uv`, non-root, `python:3.14-slim` (Modernization Floor).
- [tools/mcp-servers/azure-pricing/.pre-commit-config.yaml](tools/mcp-servers/azure-pricing/.pre-commit-config.yaml) — sync with CI gates (step 19).
- [tools/mcp-servers/azure-pricing/README.md](tools/mcp-servers/azure-pricing/README.md), [CHANGELOG.md](tools/mcp-servers/azure-pricing/CHANGELOG.md), [docs/TOOLS.md](tools/mcp-servers/azure-pricing/docs/TOOLS.md) — re-attribution + v5.0 entries.
- [.github/agents/03-architect.agent.md](.github/agents/03-architect.agent.md), [.github/agents/\_subagents/cost-estimate-subagent.agent.md](.github/agents/_subagents/cost-estimate-subagent.agent.md) — propagate `response_format: compact` (replace bogus `output_format`) and the `azure_sku_discovery` migration.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — uv install path + mypy/bandit gates (ruff already wired) + bench smoke test.
- [tools/mcp-servers/azure-pricing/tests/fixtures/baseline-bytes.json](tools/mcp-servers/azure-pricing/tests/fixtures/baseline-bytes.json) — _new_ (Phase 0b output).
- [tools/mcp-servers/azure-pricing/tests/fixtures/consumer-grep.txt](tools/mcp-servers/azure-pricing/tests/fixtures/consumer-grep.txt) — _new_ (Phase 0d output).

## Verification

1. **Unit tests** — pytest suite under `tools/mcp-servers/azure-pricing/tests/` passes after each phase. Run: `npm run test:azure-pricing-mcp` ([package.json:85](package.json)).
2. **Token-budget assertion** — `npm run bench:azure-pricing` (added in step 19) compares against the Phase-0b baseline at `tests/fixtures/baseline-bytes.json`. Compact must be ≤ 20 % of baseline; full ≤ 80 %. No absolute KB target — derived per tool.
3. **Deprecation alias smoke test** — call `azure_discover_skus` and assert it returns equivalent shape to `azure_sku_discovery` (step 12) with the deprecation header in compact mode.
4. **Architect + cost subagent dry run** — replace fixture-replay attempt with the real harness: `npm run e2e:validate && npm run e2e:benchmark` (per [AGENTS.md](AGENTS.md)). Confirm cost-estimate phase finishes and the artifact passes `npm run validate:agents` + the cost-estimate-standards skill (G6).
5. **CI green** — `npm run lint:md`, `npm run lint:json`, `npm run lint:python` (ruff, already wired), `npm run validate:agents`, `npm run test:azure-pricing-mcp`, plus the **new mypy + bandit** gates and `npm run bench:azure-pricing`.
6. **Docker boot test** — `docker build -t azure-pricing-mcp .` then `docker run -i azure-pricing-mcp` (stdio) responds to the MCP `initialize` handshake; `--transport http` variant responds to a Streamable HTTP probe.
7. **Cold-start cache test** — fresh `${XDG_CACHE_HOME:-~/.cache}/azure-pricing-mcp/` deleted; first call to a VM SKU populates retirement cache; second run within 24 h hits disk (no GitHub fetch).
8. **`[admin]` extras gating test** — fresh venv with `pip install -e .` (no `[admin]`): server starts, logs the "[admin] extras not installed — N admin tools unavailable" hint, and `tools/list` excludes `spot_*`, `simulate_eviction`, `find_orphaned_resources`. After `pip install -e '.[admin]'`, tools reappear without code changes.
9. **`lifespan` session reuse** — instrument the FastMCP `lifespan` to count `aiohttp.ClientSession` instantiations across 100 sequential tool calls; must be exactly 1 (R2 regression guard).
10. **Manual MCP inspector** — `npx @modelcontextprotocol/inspector` against stdio transport shows all tools with annotations + `outputSchema` populated.
11. **Consumer migration** — replay every match from `tests/fixtures/consumer-grep.txt` (Phase 0d) and confirm none break with `response_format=full` (back-compat) and the new compact default after step 7 updates.
12. **Modernization floor audit** — `python --version` prints 3.14.x in CI + Dockerfile + devcontainer venv; `grep -r "py3\(10\|11\|12\|13\)\|python_version.*3\.\(10\|11\|12\|13\)" pyproject.toml` returns no hits; `uv pip list` shows every package at the floor pinned in pyproject.toml or higher; `[tool.black]` / `black` references absent from the entire MCP folder.

## Findings Addressed (review traceability)

| ID  | Severity     | Finding                                        | Resolution                                                                                                                                  |
| --- | ------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | 🔴 Hallucin. | `output_format` flag claimed to exist          | Removed everywhere; logged as bug B1; step 4 says "net-new"                                                                                 |
| H2  | 🔴 Hallucin. | `models.py` claimed to be pydantic             | Step 14 explicitly migrates dataclasses → pydantic for the 11 in-scope tools                                                                |
| H3  | 🔴 Hallucin. | "Python 3.13 wheel issues" justification       | Reframed: pin to **Python 3.14** (latest stable, Oct 2025) per Modernization Floor; drop 3.10–12 floor; weekly-maintenance bumped repo-wide |
| E1  | 🟠 Error     | `MANIFEST.in` rationale incorrect              | Step 18 cites real reason: references non-existent files; no sdist publishing                                                               |
| E2  | 🟠 Error     | `bulk.py` falsely described as sequential      | Step 10 narrowed to `azure_region_recommend`; `bulk.py` is verify-only                                                                      |
| E3  | 🟠 Error     | Test rewrite needed for FastMCP migration      | Step 15 lists `test_mcp_server.py:74` and patterns to update                                                                                |
| E4  | 🟠 Error     | Ruff already wired in CI                       | Step 19 adds **only** mypy + bandit (and pre-commit sync)                                                                                   |
| R1  | 🟡 Risk      | Default flip breaks string-shape consumers     | Phase 0d grep audit + step 7 lockstep update                                                                                                |
| R2  | 🟡 Risk      | FastMCP loses shared aiohttp session           | Step 15 `lifespan` pattern + verification step 9                                                                                            |
| R3  | 🟡 Risk      | `[admin]` gating must use conditional import   | Step 17 `admin/` package + sample code                                                                                                      |
| R4  | 🟡 Risk      | Single `azure-identity` probe insufficient     | Step 17 multi-import probe (identity + mgmt-resourcegraph + mgmt-compute + mgmt-costmanagement)                                             |
| R5  | 🟡 Risk      | "≈25 KB baseline" was unverified               | Phase 0b empirical capture + relative thresholds                                                                                            |
| G1  | 🟢 Gap       | `response_format` over-applied                 | Step 4 lists 11 in-scope + 8 skipped tools                                                                                                  |
| G2  | 🟢 Gap       | `healthcheck.py` could be deleted accidentally | Step 2 explicit "preserve" list                                                                                                             |
| G3  | 🟢 Gap       | `count-manifest.json` scope unverified         | Phase 0c reads it; step 3 gated on result                                                                                                   |
| G4  | 🟢 Gap       | No rollback safety net                         | Phase 0a `git tag v4.0.0-final`                                                                                                             |
| G5  | 🟢 Gap       | Pre-commit hooks unsynced from CI              | Step 19 explicit sync                                                                                                                       |
| G6  | 🟢 Gap       | `eslint-adoption/` is not a runnable fixture   | Verification 4 uses `npm run e2e:validate`                                                                                                  |
| M1  | 🔵 Minor     | Numbering "16a"                                | Renumbered to step 17 (subsequent steps shifted)                                                                                            |
| M2  | 🔵 Minor     | Wrong path on `bulk.py` link                   | Fixed in Relevant Files                                                                                                                     |
| M3  | 🔵 Minor     | `structlog` over-investment                    | Dropped from scope (logged in Decisions)                                                                                                    |
| M4  | 🔵 Minor     | CHANGELOG batch-edit dating                    | Step 24 fixes v5.0.0 date + adds footnote                                                                                                   |
| M5  | 🔵 Minor     | `make:azure-pricing-bench` naming inconsistent | Step 19 uses `npm run bench:azure-pricing`                                                                                                  |
