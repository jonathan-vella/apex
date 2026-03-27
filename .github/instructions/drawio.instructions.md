---
description: "Draw.io diagram generation and editing conventions"
applyTo: "**/*.drawio"
---

# Draw.io Diagram Conventions

## File Format

- Always use **uncompressed XML** (no `compressed="true"`)
- Root element must be `<mxfile>` containing `<diagram>` elements
- Every diagram must include structural cells: `<mxCell id="0"/>` and `<mxCell id="1" parent="0"/>`
- All cell IDs must be unique within a diagram

## Element Rules

- Shapes use `vertex="1"`, connectors use `edge="1"` — never both on the same cell
- Edge `source` and `target` must reference existing vertex IDs
- Vertices require `<mxGeometry>` with x, y, width, height
- Edges require `<mxGeometry relative="1" as="geometry"/>`

## Style Conventions

- Style strings: semicolon-separated `key=value;` pairs (case-sensitive)
- Boolean values: `0` and `1` (not true/false)
- Colors: `#RRGGBB` hex format, `none`, or `default`
- No spaces around `=` or `;`
- Non-rectangular shapes must set matching `perimeter=` value

## Azure Architecture Diagrams

For Steps 3, 4, and 7 architecture deliverables:

- **MUST** embed official Azure icons — the MCP server resolves them automatically via `shape_name`
- Use `drawio/add-cells` with `shape_name` for Azure icons (e.g., `shape_name: "Front Doors"`)
- When using `shape_name`, do NOT specify `width`, `height`, or `style` — server auto-applies
- Use `drawio/search-shapes` with `queries` array to find icon names (ONE call with ALL queries)
- Use `drawio/create-groups` for VNets, subnets, resource groups — set `text: ""`, add separate label vertex above
- Edges: orthogonal only, NEVER set `entryX/entryY/exitX/exitY` — server auto-calculates anchors
- Cross-cutting services at bottom (120px below main flow) — NO edges to them
- For multi-step diagrams, use transactional mode (`transactional: true` on all calls), then `finish-diagram`
- Use `compress: true` on `export-diagram`/`finish-diagram` for smaller payloads
- Save exported `.drawio` via terminal command (extract from JSON), NOT by reading XML through the LLM
- Each batch tool (search-shapes, create-groups, add-cells, add-cells-to-group) called exactly ONCE with ALL items

## Validation

Files are validated by `scripts/validate-drawio-files.mjs` against the
14-point checklist from the draw.io style reference.

Full skill guidance: `.github/skills/drawio/SKILL.md`
