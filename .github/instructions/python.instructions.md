---
description: 'Python coding conventions for diagram generation, MCP servers, and tooling scripts'
applyTo: '**/*.py'
---

# Python Guidelines

Instructions for writing clean, consistent Python in this repository. Target Python 3.10+
with Ruff for linting and formatting.

## Project Context

Python is used for three purposes in this repo:

1. **Architecture diagrams** — `diagrams` library scripts in `agent-output/` and `.github/skills/`
2. **Azure Pricing MCP server** — async `aiohttp`/`starlette` server in `mcp/azure-pricing-mcp/`
3. **Utility scripts** — Checkov scanning, diagram verification

## Style & Formatting

- **Formatter**: Ruff (`ruff format`) — double quotes, space indentation
- **Linter**: Ruff with rules: E, W, F, I, B, C4, UP, SIM
- **Line length**: 120 characters (matches project-wide setting)
- **Imports**: sorted by isort rules via Ruff — stdlib, third-party, first-party
- **Quotes**: double quotes for strings
- **Type hints**: use for function signatures; `pyproject.toml` sets `basic` type checking

## Package Management

- Use `uv` (Astral) as the package manager — installed in devcontainer
- Root dependencies in `requirements.txt`: `diagrams`, `matplotlib`, `pillow`, `checkov`
- MCP server dependencies in `mcp/azure-pricing-mcp/pyproject.toml`
- Use virtual environments: MCP server has its own `.venv`

## Diagram Scripts

Follow the existing pattern for architecture diagram generation:

```python
"""Brief description of what the diagram shows."""

from diagrams import Cluster, Diagram
from diagrams.azure.compute import AppServices
from diagrams.azure.network import FrontDoors

with Diagram("Diagram Title", show=False, filename="output-name", direction="TB"):
    with Cluster("Resource Group"):
        # Resources...
        pass
```

- Always set `show=False` to prevent auto-opening
- Use `direction="TB"` (top-to-bottom) for consistency
- Group resources in `Cluster` blocks matching Azure resource groups
- Set explicit `filename` parameter to control output location

## Async Patterns (MCP Server)

The Azure Pricing MCP server uses async patterns:

- Use `async def` with `await` — never mix sync and async I/O
- Use `aiohttp.ClientSession` for HTTP requests — create once, reuse
- Use `cachetools.TTLCache` for pricing data caching
- Handle `azure.identity` credential errors gracefully with fallback

## Conventions

- Use `snake_case` for functions, variables, and modules
- Use `PascalCase` for classes
- Use `UPPER_SNAKE_CASE` for constants
- Prefer f-strings over `.format()` or `%` formatting
- Use pathlib `Path` for new code — existing scripts may use `os.path`
- Use context managers (`with`) for file and network operations

## Testing

- Test framework: `pytest` with `pytest-asyncio` for async tests
- Mock framework: `pytest-mock`
- Tests live alongside source in `tests/` subdirectories
- Use `@pytest.mark.asyncio` for async test functions
