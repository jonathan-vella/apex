---
name: drawio
description: "Draw.io architecture diagrams for Azure via simonkurtz-MSFT MCP server — 700+ Azure icons, batch creation, transactional mode. USE FOR: architecture diagrams, dependency diagrams, runtime flow diagrams, as-built diagrams. DO NOT USE FOR: WAF/cost charts (use python-diagrams), inline Mermaid (use mermaid), Excalidraw diagrams (use excalidraw)."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Uses simonkurtz-MSFT/drawio-mcp-server configured in .vscode/mcp.json.
license: MIT
metadata:
  author: azure-agentic-infraops
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

## MCP Tool Overview

### Shape Discovery

| Tool                     | Purpose                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `search-shapes`          | Fuzzy search for shapes including 700+ Azure icons. Pass ALL queries in the `queries` array. |
| `get-shape-categories`   | List all shape categories (General, Flowchart, Azure categories).                            |
| `get-shapes-in-category` | List all shapes in a category by `category_id`.                                              |
| `get-style-presets`      | Get built-in style presets (Azure colors, flowchart shapes, edge styles).                    |

### Diagram Modification

| Tool                | Purpose                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `add-cells`         | Add vertices and/or edges. Use `shape_name` for icon resolution, `temp_id` for within-batch references. |
| `edit-cells`        | Update vertex cell properties (position, size, text, style).                                            |
| `edit-edges`        | Update edge properties (text, source, target, style).                                                   |
| `set-cell-shape`    | Apply library shape styles to existing cells.                                                           |
| `delete-cell-by-id` | Remove a cell by ID. Cascade-deletes connected edges for vertices.                                      |

### Diagram Inspection

| Tool                | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `list-paged-model`  | Paginated view of all cells with filtering by type.           |
| `get-diagram-stats` | Statistics about cell counts, bounds, and layer distribution. |
| `export-diagram`    | Export the diagram as Draw.io XML. Use `compress: true`.      |
| `import-diagram`    | Import a Draw.io XML string, replacing the current diagram.   |
| `clear-diagram`     | Clear all cells and reset the diagram.                        |
| `finish-diagram`    | Resolve placeholders to real SVGs (transactional mode).       |

### Group / Container Management

| Tool                         | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `create-groups`              | Create group/container cells for VNets, subnets, resource groups. |
| `add-cells-to-group`         | Assign cells to groups. Server auto-converts coordinates.         |
| `remove-cell-from-group`     | Remove a cell from its group, returning it to the active layer.   |
| `list-group-children`        | List all cells contained in a group.                              |
| `validate-group-containment` | Detect children that exceed group bounds.                         |
| `suggest-group-sizing`       | Calculate recommended group dimensions.                           |

### Layer & Page Management

| Tool                                                                             | Purpose        |
| -------------------------------------------------------------------------------- | -------------- |
| `list-layers` / `create-layer` / `set-active-layer` / `move-cell-to-layer`       | Manage layers. |
| `create-page` / `list-pages` / `set-active-page` / `rename-page` / `delete-page` | Manage pages.  |

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

When `export-diagram` or `finish-diagram` returns XML in a JSON response, use a
terminal command to extract and save — do NOT read the XML back through the LLM:

```bash
cat '<temp-content-json-path>' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['xml'], end='')" > '<output-path>.drawio'
```

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
- **NO anchor points**: Never set `entryX`, `entryY`, `exitX`, `exitY` — server auto-calculates.
- **Side exits preferred**: edges exit/enter through left or right sides.
- **One edge per source into a group**: target the group cell, not children inside.
- **No edges to cross-cutting services**: their presence is implied.

### Cross-Cutting & Supporting Services

Place Azure Monitor, Entra ID, Key Vault, Azure Policy, Defender for Cloud,
Container Registry, DNS Zones, Application Insights, Log Analytics at the
**bottom** of the diagram, 120px below the main flow. No edges to them.
Space 100px apart (center-to-center). Wrap into multiple rows at page width.

### Color Palette (Azure-Aligned)

| Color              | Hex       | Use                              |
| ------------------ | --------- | -------------------------------- |
| Azure Blue         | `#0078D4` | Primary strokes, data flow edges |
| VNet fill          | `#E7F5FF` | Virtual network backgrounds      |
| Subnet fill (app)  | `#E6F5E6` | Application tier subnets         |
| Subnet fill (data) | `#FFF2CC` | Data tier subnets                |
| Security zone      | `#F8CECC` | Security boundaries, WAF zones   |
| Light gray         | `#F5F5F5` | Resource group backgrounds       |
| Monitoring         | `#E1D5E7` | Monitoring/governance containers |

Call `get-style-presets` once to retrieve Azure color presets and apply consistently.

## Output File Conventions

| Step | Filename                       | Content                        |
| ---- | ------------------------------ | ------------------------------ |
| 3    | `03-des-diagram.drawio`        | Conceptual architecture        |
| 4    | `04-dependency-diagram.drawio` | Resource dependency graph      |
| 4    | `04-runtime-diagram.drawio`    | Runtime data flow              |
| 7    | `07-ab-diagram.drawio`         | As-built deployed architecture |

All outputs go to `agent-output/{project}/`.

## Validation

After generating a `.drawio` file, run:

```bash
node scripts/validate-drawio-files.mjs agent-output/{project}/<diagram>.drawio
```

The validator checks 14 points: valid XML, mxfile root, unique IDs, structural
cells, parent refs, vertex/edge flags, edge source/target, geometry, style format,
perimeter match, HTML escaping, coordinates, group hierarchy, and Azure icon presence.

## Quality Gate

A diagram passes quality review when it scores ≥9/10 on:

1. Readable at 100% zoom — all labels visible
2. No label overlap
3. Minimal edge crossing
4. Clear tier grouping — resources grouped by function/subnet/RG
5. Correct Azure icons — every Azure service has its official icon
6. Security boundaries visible
7. No stray elements — no floating unconnected shapes
8. Service labels centered
9. Footer unobtrusive
10. Dense canvas usage — compact, no excessive whitespace

## Reference Materials

For detailed style properties: Read `.github/skills/drawio/references/style-reference.md`
For Azure-specific MCP tool patterns: Read `.github/skills/drawio/references/azure-patterns.md`
For full validation details: Read `.github/skills/drawio/references/validation-checklist.md`
Quality target samples: `tmp/azure-architecture-example.drawio`, `tmp/03-des-diagram.svg`
