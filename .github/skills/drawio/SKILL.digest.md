<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Draw.io Architecture Diagrams (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Prerequisites

- **MCP server**: `simonkurtz-MSFT/drawio-mcp-server` (Deno, stdio) configured in `.vscode/mcp.json`
- **Deno runtime**: installed via devcontainer feature
- **VS Code extension** (optional): `hediet.vscode-drawio` for in-editor preview

## MCP Workflow Summary

The MCP server's startup instructions are the authoritative tool reference.
This skill captures only the repo-specific sequence and guardrails:

- `search-shapes` — resolve all Azure icons up front in one batch
- `create-groups` — create VNets, subnets, resource groups, or app environments
- `add-cells` — add all vertices and edges in one batch (use `shape_name` + `temp_id`)
- `add-cells-to-group` — assign all children to groups in one batch
- `finish-diagram` or `export-diagram` — emit final XML with `compress: true`

Reusable call patterns: [`references/azure-patterns.md`](references/azure-patterns.md).

## Icon Handling

Icons are resolved automatically by the MCP server from its built-in library
(700+ Azure icons from `assets/azure-public-service-icons/`).

- `shape_name` in `add-cells` specifies an Azure icon (e.g., `"Front Doors"`).
  **Do NOT** pass `width`, `height`, or `style` alongside it — the server applies them.
- `search-shapes` with a `queries` array finds icon names by fuzzy match.
- Azure icons use official service names, often plural (`"Key Vaults"`, `"Container Apps"`).
- Every shaped vertex MUST have a `text` label or omit `text` entirely — never pass `""`.
- Output format is embedded base64 SVG in the style attribute.

## Diagram Creation Workflows

**Workflow A — Non-Transactional** (small diagrams): each tool call returns full XML
with complete SVG image data.

```text
search-shapes → add-cells → export-diagram(compress: true) → save .drawio
```

**Workflow B — Transactional** (recommended for multi-step): intermediate responses use
lightweight placeholders (~2KB vs ~200KB); real SVGs resolve once at the end.
> _See SKILL.md for full content._

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
> _See SKILL.md for full content._

## Layout Conventions

- **Primary flow**: left-to-right; parallel services stacked vertically per column.
- **Spacing minimums**: 120px between columns, 80px between rows, 40px around each cell;
  groups need ≥ 150px width per icon (labels are ~130px wide).
- **Page**: US Letter 850×1100px (extend to 1300px if a legend is included);
  keep content within 40px margins.
- **Edges**: orthogonal only (`edgeStyle=orthogonalEdgeStyle`); never set `entryX`/`entryY`/
  `exitX`/`exitY` and never add `<Array as="points">` waypoints. Target specific icons,
  not groups, when a service inside a group is the endpoint.
- **Cross-cutting services** (Azure Monitor, Entra ID, Key Vault, Defender, etc.):
  place in a single light-grey rounded container at the bottom, 120px apart,
> _See SKILL.md for full content._

## Gotchas

- **`text: ""` breaks shapes** — every shaped vertex MUST have a `text` label
  or omit `text` entirely; never pass `""`.
- **No dimensions with `shape_name`** — never pass `width`, `height`, or `style`
  when using `shape_name`; the MCP server auto-applies correct values.
- **Transactional mode MUST end with `finish-diagram`** — otherwise the diagram
  keeps ~2KB placeholders instead of real SVG icons.
- **Never read large MCP responses through the LLM** — extract data via terminal
  (Python script) to avoid context-window inflation.
- **Batch-only workflow** — every tool accepting arrays is called ONCE with ALL items.
- **No edge anchors or waypoints** — never set `entryX/Y`, `exitX/Y`, or add
> _See SKILL.md for full content._

## Reference Index

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `references/style-reference.md`      | Draw.io style properties for AI-generated files         |
| `references/azure-patterns.md`       | Reusable MCP tool call patterns for Azure architectures |
| `references/validation-checklist.md` | Validation rules for AI-generated `.drawio` files       |
| `references/abstraction-rules.md`    | Diagram abstraction and data-flow clarity rules         |
| `references/iac-to-diagram.md`       | Generate diagrams from Bicep/Terraform/ARM templates    |
| `references/quality-rubric.md`       | Canonical 0–4 quality rubric (7 dimensions, thresholds) |
| `references/semantic-zones.md`       | Subscription / region / trust-boundary / external zone templates |
| `references/diagram-types.md`        | Logical / network / sequence / deployment selection + signatures |
> _See SKILL.md for full content._
