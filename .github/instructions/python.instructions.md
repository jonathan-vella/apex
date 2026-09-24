---
description: "Python coding conventions for diagram generation, MCP servers, and tooling scripts"
applyTo: "**/*.py"
---

# Python Guidelines

Repository-specific rules for Python tooling. Target Python 3.14 (`requires-python >=3.14`)
with Ruff for linting and formatting; Ruff owns general style.

## Project Context

Python is used for:

1. **Architecture diagrams** — `diagrams` library scripts in `agent-output/` and `.github/skills/`
2. **Tooling** — `tools/apex-recall/`, governance discovery scripts, and diagram verification

## Style & Formatting

- Ruff config lives in root `pyproject.toml` (format, lint rules E, W, F, I, B, C4, UP, SIM,
  120-character lines). Run `ruff format` and `ruff check` rather than restating style rules.
- **Type hints**: use for function signatures. Root `pyproject.toml` configures
    Python/Ruff, not a type-checking mode; inspect the applicable package/editor
    configuration before claiming a Pyright/Pylance level is enforced.
- Prefer `pathlib.Path` in new code; existing scripts may use `os.path`.

## Package Management

- Use `uv` (Astral) as the package manager — installed in devcontainer
- Root dependencies in `requirements.txt`: `diagrams`, `matplotlib`, `pillow`, `pytest`, `ruff`

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

## Testing

- Test framework: `pytest` (in root `requirements.txt`); no async or mock plugins are
  installed, so use `unittest.mock` and synchronous tests unless a package adds its own.
- Tests sit next to the code they cover: `test_*.py` beside skill scripts,
  `tools/apex-recall/tests/`, and `tools/tests/python-diagrams/`.
