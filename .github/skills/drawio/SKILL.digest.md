<!-- digest:auto-generated from SKILL.md — do not edit manually -->

---

name: drawio
description: "Compact reference for Draw.io Azure architecture diagrams via simonkurtz-MSFT MCP server. Load at >60% context."
metadata:
tier: digest
version: "2.0"

---

# Draw.io Diagrams — Digest

## MCP Server (simonkurtz-MSFT)

700+ built-in Azure icons, batch operations, transactional mode.
The server's `src/instructions.md` is the authoritative reference.

## Icon Handling

- Use `shape_name` in `add-cells` (e.g., `shape_name: "Front Doors"`)
- Do NOT specify `width`, `height`, or `style` for shaped vertices — server auto-applies
- Use `search-shapes` with `queries` array to find icon names
- Every shaped vertex MUST have a `text` label or omit `text` entirely (never `text: ""`)

## Batch-Only Workflow (CRITICAL)

Each tool called exactly ONCE with ALL items:

1. `search-shapes` — ONE call, ALL queries
2. `create-groups` — ONE call, ALL groups (`text: ""`, label vertex above)
3. `add-cells` — ONE call, ALL vertices + edges (vertices first, `shape_name`, `temp_id`)
4. `add-cells-to-group` — ONE call, ALL assignments
5. `edit-cells`/`edit-edges` — ONE call if needed
6. `finish-diagram` (transactional) or `export-diagram` — with `compress: true`

Save via terminal command, NOT LLM read-back.

## Transactional Mode (Recommended)

Pass `transactional: true` on all tool calls for multi-step diagrams.
Intermediate responses use lightweight placeholders (~2KB).
**MUST** call `finish-diagram` at end to resolve to real SVGs.

## Layout Rules

- Primary flow: left-to-right, columns for stages
- Cross-cutting services at bottom (120px below main flow, NO edges)
- Page: US Letter 850×1100px, 40px margins
- Groups: `text: ""`, separate bold text vertex above
- Edges: orthogonal only, NO anchor points (entryX/exitX etc.)
- Spacing: 120px horizontal, 80px vertical, 40px around cells

## Color Palette

- Azure Blue `#0078D4` — strokes, data flow
- VNet `#E7F5FF` — network backgrounds
- App subnet `#E6F5E6` — green
- Data subnet `#FFF2CC` — yellow
- Security `#F8CECC` — red
- Resource group `#F5F5F5` — gray

Call `get-style-presets` once for full Azure presets.

## Output Files

| Step | Filename                                                    |
| ---- | ----------------------------------------------------------- |
| 3    | `03-des-diagram.drawio`                                     |
| 4    | `04-dependency-diagram.drawio`, `04-runtime-diagram.drawio` |
| 7    | `07-ab-diagram.drawio`                                      |

All in `agent-output/{project}/`.

## Validation

Run `node scripts/validate-drawio-files.mjs` — 14-point checklist.
After group assignments: `validate-group-containment`.

## Quality Gate (≥9/10)

Readable at 100% zoom, no label overlap, minimal edge crossing, clear grouping,
correct Azure icons, security boundaries visible, no stray elements, centered labels.
