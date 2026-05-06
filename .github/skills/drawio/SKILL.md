---
name: drawio
description: "Use this skill to generate Azure architecture diagrams in .drawio format via the simonkurtz-MSFT MCP server (700+ Azure icons, batch creation, transactional mode). Covers architecture diagrams, dependency diagrams, runtime flow diagrams, and as-built diagrams. Do NOT use for WAF/cost charts (use python-diagrams), inline Mermaid (use mermaid), or Excalidraw diagrams (use excalidraw)."
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

The MCP server's own `src/instructions.md` is the authoritative tool reference;
it is auto-sent to the client at startup. This skill captures project-specific
conventions that complement (not duplicate) it.

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

```text
search-shapes
→ create-groups(transactional: true)
→ add-cells(transactional: true)
→ add-cells-to-group(transactional: true)
→ edit-cells(transactional: true)     [if needed]
→ finish-diagram(compress: true)       [resolves all placeholders]
→ save .drawio via terminal command
```

### Saving `.drawio` Files

When `finish-diagram` or `export-diagram` returns XML in a JSON response, use
the helper script to decompress, strip edge anchors, and save:

```bash
python3 tools/scripts/save-drawio.py '<temp-content-json-path>' '<output-path>.drawio'
node tools/scripts/validate-drawio-files.mjs '<output-path>.drawio'
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
  with no edges into them.
- **Legend**: required on every diagram, placed below the cross-cutting box.
  Use inline HTML for arrow indicators; explicitly set `text: ""` on shape samples.
- **External actors** (Users, Operators): positioned outside all group boundaries
  so they aren't visually swallowed by container fill.

> **CRITICAL — Edge post-processing**: The MCP server's auto-router injects
> anchor points and waypoints. After `finish-diagram`, the agent **MUST** run
> `tools/scripts/save-drawio.py` to strip these so Draw.io's renderer can
> calculate clean orthogonal paths client-side.

For full detail (layout patterns, numbered callouts, non-Azure component styling,
group-sizing rules, fan-out staggering, legend HTML), see
[`references/style-reference.md`](references/style-reference.md) under
"Layout Conventions (extended)".

### Post-Save Cleanup

After `save-drawio.py`, run the cleanup script to fix known MCP artifacts:

```bash
python3 .github/skills/drawio/scripts/cleanup-drawio.py '<output-path>.drawio'
```

The script fixes:

- `value="New Cell"` → `value=""` (MCP default for vertices without explicit text)
- Watermark cell height ≥ 70px (so all 4 lines of APEX attribution show)
- Reports any cross-cutting icons spaced less than 120px apart

Use the Azure-aligned color palette from `get-style-presets` and the style
examples in `references/style-reference.md`. Standard output filenames and the
validation checklist live in `references/validation-checklist.md`.

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
  `<Array as="points">` to edges.

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
| `references/legend-template.md`      | Copy-pasteable legend block (inline + two-column variants)         |
| `references/icon-variants.md`        | Service tier / SKU disambiguation + single-batch contract         |
| `references/large-architecture-decomposition.md` | Tier S/M/L/XL breakpoints, decomposition, density target |

### Quality Reference Examples

| File                                             | Pattern                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `examples/azure-vm-baseline-architecture.drawio` | VM baseline — VNet + 6 subnets, vertical flow, legend  |
| `examples/azure-aks-microservices.drawio`        | AKS microservices — horizontal flow, namespaces, CI/CD |
| `examples/azure-dns-private-resolver.drawio`     | DNS Private Resolver — hub-spoke, numbered callouts    |
| `examples/azure-foundry-landing-zone.drawio`     | Foundry Chat — landing zone, multi-subscription        |
| `examples/azure-vm-baseline-architecture.svg`    | Source SVG from Microsoft Learn (reference comparison) |
