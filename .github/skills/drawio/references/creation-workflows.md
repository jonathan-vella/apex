<!-- ref:creation-workflows-v1 -->

# Drawio Diagram Creation Workflows

> Loaded by `drawio` SKILL.md. Two workflow modes for the
> simonkurtz-MSFT Drawio MCP server, plus the local save procedure.

## Workflow A — Non-Transactional (small diagrams)

Each tool call returns full XML with complete SVG image data.

```text
search-shapes → add-cells → export-diagram(compress: true) → save .drawio
```

Use this for tiny single-step diagrams (≤ 5 shapes, no groups).

## Workflow B — Transactional (recommended for multi-step)

Intermediate responses use lightweight placeholders (~2 KB vs ~200 KB); real
SVGs resolve once at the end.

```text
search-shapes
→ create-groups(transactional: true)
→ add-cells(transactional: true)
→ add-cells-to-group(transactional: true)
→ edit-cells(transactional: true)     [if needed]
→ finish-diagram(compress: true)       [resolves all placeholders]
→ save .drawio via terminal command
```

**MUST end with `finish-diagram`** — otherwise the saved diagram keeps the ~2 KB placeholders
instead of real SVG icons.

## Saving `.drawio` Files

When `finish-diagram` or `export-diagram` returns XML in a JSON response, use the helper
script to decompress, strip edge anchors, and save:

```bash
python3 tools/scripts/save-drawio.py '<temp-content-json-path>' '<output-path>.drawio'
node tools/scripts/validate-drawio-files.mjs '<output-path>.drawio'
```

The script handles: compressed content decompression, `mxGraphModel` embedding (repo
validator format), edge anchor/waypoint stripping, and directory creation.

**Do NOT** read the large MCP JSON response back through the LLM — extract data via
terminal commands to avoid inflating the context window.

## Post-save Cleanup

After `save-drawio.py`, run the cleanup script for known MCP artifacts:

```bash
python3 .github/skills/drawio/scripts/cleanup-drawio.py '<output-path>.drawio'
```

Fixes: `value="New Cell"` → `value=""`, watermark cell height ≥ 70 px, reports
cross-cutting icons spaced < 120 px apart.
