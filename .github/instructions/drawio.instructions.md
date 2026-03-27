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

- **MUST** embed official Azure icons from `assets/drawio-libraries/azure-icons/`
- Use `shape=image;image=data:image/svg+xml;base64,...` for icon cells
- Icon reference: `assets/drawio-libraries/azure-icons/reference.md`
- Resource groups → swimlane containers with `fillColor=#F5F5F5`
- VNets → swimlane containers with `fillColor=#E7F5FF;strokeColor=#0078D4`
- Use `edgeStyle=orthogonalEdgeStyle;rounded=1;` for connections

## Validation

Files are validated by `scripts/validate-drawio-files.mjs` against the
14-point checklist from the draw.io style reference.

Full skill guidance: `.github/skills/drawio/SKILL.md`
