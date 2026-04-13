---
name: drawio
description: "Draw.io architecture diagrams for Azure via simonkurtz-MSFT MCP server — 700+ Azure icons, batch creation, transactional mode. USE FOR: architecture diagrams, dependency diagrams, runtime flow diagrams, as-built diagrams. DO NOT USE FOR: WAF/cost charts (use python-diagrams), inline Mermaid (use mermaid), Excalidraw diagrams (use excalidraw)."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Uses simonkurtz-MSFT/drawio-mcp-server configured in .vscode/mcp.json.
license: MIT
metadata:
  author: apex
  version: "2.0"
---

# Draw.io Architecture Diagrams

Generate Azure architecture diagrams in `.drawio` format using the
simonkurtz-MSFT Draw.io MCP server. The server has 700+ built-in Azure icons,
fuzzy shape search, batch operations, group/layer/page management, and
transactional mode for efficient multi-step workflows.

**Authoritative reference**: The MCP server's own `src/instructions.md` (519 lines) is the
canonical guide for tool parameters, layout rules, and workflow patterns.
It is **automatically sent to the MCP client at startup** via the server's
`instructions` field — agents receive it in context without needing to read it.
This skill provides project-specific conventions that complement (not duplicate) it.

## Prerequisites

- **Draw.io MCP server**: `simonkurtz-MSFT/drawio-mcp-server` (Deno, stdio) configured in `.vscode/mcp.json`
- **Deno runtime**: Installed via devcontainer feature `ghcr.io/devcontainers-community/features/deno`
- **VS Code extension** (optional): `hediet.vscode-drawio` for in-editor preview

## MCP Workflow Summary

Use the MCP server's startup instructions as the authoritative tool reference.
This skill only captures the repo-specific sequence and guardrails that must stay
consistent across generated diagrams.

- `search-shapes` — resolve all Azure icons up front in one batch
- `create-groups` — create VNets, subnets, resource groups, or app environments
- `add-cells` — add all vertices and edges in one batch using `shape_name` and `temp_id`
- `add-cells-to-group` — assign all children to groups in one batch
- `finish-diagram` or `export-diagram` — emit final XML with `compress: true`

For reusable call patterns, see `references/azure-patterns.md`.

## Icon Handling

Icons are resolved automatically by the MCP server from its built-in library
(700+ Azure icons from `assets/azure-public-service-icons/`).

- Use `shape_name` in `add-cells` to specify Azure icons (e.g., `shape_name: "Front Doors"`)
- **Do NOT specify `width`, `height`, or `style`** when using `shape_name` —
  the server auto-applies correct dimensions and styling
- Use `search-shapes` with a `queries` array to find icon names by fuzzy match
- Azure icons use their official service names, often plural (e.g., "Key Vaults", "Container Apps", "App Services")
- Every shaped vertex **MUST** have a `text` label or omit `text` entirely — **never** pass `text: ""`
- Output format is **embedded base64 SVG** in the style attribute

## Diagram Creation Workflows

### Workflow A: Non-Transactional (small diagrams)

For simple diagrams or single operations. Each tool call returns full XML with
complete SVG image data.

```text
search-shapes → add-cells → export-diagram(compress: true) → save .drawio
```

### Workflow B: Transactional (recommended for multi-step)

For any multi-step diagram. Intermediate responses use lightweight placeholders
(~2KB instead of ~200KB). Real SVGs are resolved once at the end via `finish-diagram`.

```text
search-shapes
→ create-groups(transactional: true)
→ add-cells(transactional: true)
→ add-cells-to-group(transactional: true)
→ edit-cells(transactional: true)     [if needed]
→ finish-diagram(compress: true)       [resolves all placeholders]
→ save .drawio via terminal command
```

**CRITICAL**: When using transactional mode, you **MUST** call `finish-diagram`
at the end. Without it, the diagram contains placeholder shapes instead of real icons.

### Saving `.drawio` Files

When `finish-diagram` or `export-diagram` returns XML in a JSON response, use
the helper script to decompress, strip edge anchors, and save in one step:

```bash
python3 scripts/save-drawio.py '<temp-content-json-path>' '<output-path>.drawio'
node scripts/validate-drawio-files.mjs '<output-path>.drawio'
```

The script handles: compressed content decompression, `mxGraphModel` embedding
(repo validator format), edge anchor/waypoint stripping, and directory creation.

**Do NOT** read the large MCP JSON response back through the LLM — extract
data via terminal commands to avoid inflating the context window.

## Batch-Only Workflow (CRITICAL)

**Every tool that accepts an array MUST be called exactly ONCE with ALL items.**
Never call a tool repeatedly for individual items.

1. **`search-shapes`** — ONE call with ALL queries in the `queries` array (main flow + cross-cutting)
2. **`create-groups`** — ONE call with ALL groups. Set `text: ""` for groups; create separate text vertex above.
3. **`add-cells`** — ONE call with ALL vertices AND edges. Vertices before edges.
   Use `temp_id` for cross-refs, `shape_name` for icons.
4. **`add-cells-to-group`** — ONE call with ALL assignments. Server auto-converts absolute → group-relative coords.
5. **`edit-cells`/`edit-edges`** — ONE call if adjustments needed.
6. **`finish-diagram`** (transactional) or **`export-diagram`** (default) — with `compress: true`.

After group assignments, call `validate-group-containment` to detect any children that exceed group bounds.

### Token Efficiency

- **The MCP server is NOT stateful** between tool calls. You MUST pass
  `diagram_xml` from the previous call's response on every subsequent call.
  Save the XML to a temp file between steps and read it back rather than
  inflating the LLM context with the full XML in every turn.
- **Do NOT read back large MCP responses through the LLM**. When a tool result
  is written to a temp file, extract only the data you need via a terminal
  command (e.g., cell IDs) rather than reading the entire JSON into context.
- **Target 8–10 model turns** for a complete diagram. Pre-compute the full
  layout (all vertices, edges, groups, assignments) before making any MCP
  calls, then execute the batch workflow in sequence.

## Layout Conventions

### General Rules

- **Primary flow**: left-to-right. Each stage occupies a column.
- **Parallel services**: stacked vertically within their column, never side-by-side.
- **Spacing**: 120px horizontal between columns, 80px vertical between rows, 40px around each cell.
- **Page**: US Letter 850×1100px. Content within 40px margins (usable: 770×1020).
- **No overlapping**: Components must not overlap each other.

### Groups

- Create groups for VNets, subnets, Container Apps Environments, resource groups.
- Set `text: ""` for groups — create a separate bold text vertex above the group instead.
- Use `suggest-group-sizing` to calculate dimensions based on child count.

### Edges

- **Orthogonal only**: Use `edgeStyle=orthogonalEdgeStyle` (the default).
- **NO anchor points**: Never set `entryX`, `entryY`, `exitX`, `exitY` in your edge style.
- **NO waypoints**: Do not add `<Array as="points">` or `<mxPoint>` elements.
- **Side exits preferred**: edges exit/enter through left or right sides.
- **One edge per source into a group**: target the group cell, not children inside.
- **No edges to cross-cutting services**: their presence is implied.
- **Fan-out staggering**: When multiple edges leave the same source, keep them
  minimal. Consider merging semantically similar paths (e.g., "Partner Data Export"
  instead of Storage → Data Share → Partners as 3 separate edges).

> **CRITICAL — Post-Processing Required**: The MCP server's auto-router injects
> `exitX/exitY/entryX/entryY` anchor points and `<Array>` waypoints into every
> edge it creates. These computed routes are poor for fan-out patterns and cause
> edges to pile up in horizontal corridors. After `finish-diagram`, the agent
> **MUST** run `scripts/save-drawio.py` which strips these injected anchors and
> waypoints, letting Draw.io's client-side renderer calculate clean orthogonal
> paths when the file is opened.

### Cross-Cutting & Supporting Services

Place Azure Monitor, Entra ID, Key Vault, Azure Policy, Defender for Cloud,
Container Registry, DNS Zones, Application Insights, Log Analytics at the
**bottom** of the diagram, 120px below the main flow. No edges to them.
Space 100px apart (center-to-center). Wrap into multiple rows at page width.

Use the Azure-aligned color palette from `get-style-presets` and the style
examples in `references/style-reference.md`. Standard output filenames and the
validation checklist live in `references/validation-checklist.md`.

## Reference Index

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `references/style-reference.md`      | Draw.io style properties for AI-generated files         |
| `references/azure-patterns.md`       | Reusable MCP tool call patterns for Azure architectures |
| `references/validation-checklist.md` | Validation rules for AI-generated `.drawio` files       |
| `references/abstraction-rules.md`    | Diagram abstraction and data-flow clarity rules         |
| `references/iac-to-diagram.md`       | Generate diagrams from Bicep/Terraform/ARM templates    |

Quality target samples: `tmp/azure-architecture-example.drawio`, `tmp/03-des-diagram.svg`
