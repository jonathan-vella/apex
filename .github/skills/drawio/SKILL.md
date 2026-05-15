---
name: drawio
description: "**WORKFLOW SKILL** — Generate Azure architecture diagrams in .drawio via simonkurtz-MSFT MCP server (full Azure icon set, batch creation, transactional mode). Covers architecture, dependency, runtime-flow, and as-built diagrams. WHEN: 'draw.io diagram', 'Azure architecture diagram', 'as-built diagram', 'runtime flow diagram', 'dependency diagram'. DO NOT USE FOR: WAF/cost charts (python-diagrams), inline Mermaid (mermaid)."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Uses simonkurtz-MSFT/drawio-mcp-server configured in .vscode/mcp.json.
license: MIT
metadata:
  author: apex
  version: "2.0"
---

# Draw.io Architecture Diagrams

Generate Azure architecture diagrams in `.drawio` format using the
simonkurtz-MSFT Draw.io MCP server. The server ships the full Azure icon set
(see [`assets/azure-public-service-icons/`](../../../assets/drawio-libraries/azure-icons)),
fuzzy shape search, batch operations, group/layer/page management, and
transactional mode for efficient multi-step workflows.

The MCP server's own `src/instructions.md` is the authoritative tool reference;
it is auto-sent to the client at startup. This skill captures project-specific
conventions that complement (not duplicate) it.

> **Naming note**: "drawio" can refer to (a) this skill, (b) the MCP server slug
> `simonkurtz-MSFT/drawio-mcp-server`, or (c) the `mcp_drawio_*` tool family. In
> agent-facing references, disambiguate explicitly — say "the `drawio` skill" or
> "the drawio MCP server", not bare `drawio`.

## Prerequisites

- **MCP server**: `simonkurtz-MSFT/drawio-mcp-server` (Deno, stdio) configured in `.vscode/mcp.json`
- **Deno runtime**: installed via devcontainer feature
- **VS Code extension** (optional): `hediet.vscode-drawio` for in-editor preview

## MCP Workflow Summary

The MCP server's startup `src/instructions.md` is the authoritative tool reference. The
table below lists the most-used tools and the repo-specific batch sequence. Reusable call
patterns: [`references/azure-patterns.md`](references/azure-patterns.md).

| Tool                         | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `search-shapes`              | Fuzzy-search the Azure icon library; resolves names to shapes        |
| `create-groups`              | Create container cells (VNets, subnets, resource groups, envs)       |
| `add-cells`                  | Add vertices + edges in a single batch (use `shape_name`, `temp_id`) |
| `add-cells-to-group`         | Assign children to group containers                                  |
| `edit-cells` / `edit-edges`  | Update cell or edge properties post-creation                         |
| `validate-group-containment` | Detect children that exceed group bounds                             |
| `finish-diagram`             | Resolve transactional placeholders + emit final compressed XML       |
| `export-diagram`             | Non-transactional export with `compress: true`                       |

Standard sequence: `search-shapes` → `create-groups` → `add-cells` → `add-cells-to-group`
→ (optional `edit-*`) → `validate-group-containment` → `finish-diagram` /
`export-diagram` (`compress: true`).

> **`import-diagram` input contract (CRITICAL — Phase D3 of nordic-foods
> lessons plan)**: when calling `import-diagram` (or any tool whose schema
> declares an `xml` parameter), the field **MUST be XML content as a
> string** — never a file path. Passing a bare `path/to/file.drawio`
> string produces `INVALID_XML` from the server and burns an MCP round
> trip. If you have a path on disk:
>
> ```text
> WRONG: import-diagram(xml="agent-output/foo/03-des-diagram.drawio")
> RIGHT: read_file("agent-output/foo/03-des-diagram.drawio") → import-diagram(xml=<content>)
> ```
>
> Mirror this warning in `04-design.agent.md` next to every
> `import-diagram` reference. The two locations must stay in sync.

## CLI Fallback

**There is no programmatic CLI fallback for diagram authoring.** The Draw.io desktop app
is the only manual alternative; if the MCP server is unavailable, stop and surface the
failure rather than hand-rolling XML. The `tools/scripts/save-drawio.py` and
`cleanup-drawio.py` helpers are post-processing utilities for MCP output, not authoring
fallbacks.

## Icon Handling

Icons are resolved automatically by the MCP server from its built-in library
(the full Azure icon set bundled with the server).

- `shape_name` in `add-cells` specifies an Azure icon (e.g., `"Front Doors"`).
  **Do NOT** pass `width`, `height`, or `style` alongside it — the server applies them.
- `search-shapes` with a `queries` array finds icon names by fuzzy match.
- Azure icons use official service names, often plural (`"Key Vaults"`, `"Container Apps"`).
- Every shaped vertex MUST have a `text` label or omit `text` entirely — never pass `""`.
- Output format is embedded base64 SVG in the style attribute.

## Diagram Creation Workflows

Two modes — **non-transactional** (small diagrams, full XML each call) and
**transactional** (recommended for multi-step; lightweight placeholders during
the loop, real SVGs resolved by `finish-diagram` at the end). Full call chains,
the `save-drawio.py` save procedure, and the post-save cleanup script live in
[`references/creation-workflows.md`](references/creation-workflows.md).

> **Critical**: transactional mode MUST end with `finish-diagram(compress: true)`
> or the saved diagram keeps placeholder cells instead of real Azure icons.

## Rules

- **Batch-only workflow** — every tool that accepts an array MUST be called exactly ONCE with all items; never call a tool repeatedly for individual items (see [Batch-Only Workflow (CRITICAL)](#batch-only-workflow-critical) below)
- **Use `shape_name` for Azure icons** — do NOT pass `width`, `height`, or `style` alongside it; the server applies them
- **Every shaped vertex MUST have a `text` label or omit `text` entirely** — never pass `""`
- **Vertices first in `add-cells`** — edges must be ordered after the vertices they reference
- **Transactional mode for multi-step diagrams** — use placeholders + `finish-diagram` at the end (~2KB intermediate vs ~200KB)
- **Use `compress: true`** on `export-diagram` / `finish-diagram` to keep `.drawio` files small
- **Do NOT pipe large MCP JSON back through the LLM** — use `python3 tools/scripts/save-drawio.py` to extract via terminal
- **Out of scope**: WAF / cost charts (use `python-diagrams`), inline Mermaid (use `mermaid`)

## Steps

**Every tool that accepts an array MUST be called exactly ONCE with all items.** Never call a tool repeatedly for individual items.

1. `search-shapes` — ONE call with all queries (main flow + cross-cutting)
2. `create-groups` — ONE call with all groups. Set `text: ""` and create a separate text vertex above each group
3. `add-cells` — ONE call with all vertices AND edges, **vertices first**. Use `temp_id` for cross-refs, `shape_name` for icons
4. `add-cells-to-group` — ONE call with all assignments
5. `edit-cells` / `edit-edges` — ONE call if adjustments are needed
6. `finish-diagram` (transactional) or `export-diagram` (default) — with `compress: true`

After group assignments, call `validate-group-containment` to detect children that exceed group bounds.

### Token efficiency

- **MCP server is NOT stateful** — pass `diagram_xml` from the previous call on every subsequent call. Save XML to a temp file between steps; read only the IDs you need rather than the whole JSON.
- **Never read back large MCP responses through the LLM** — extract data via terminal commands.
- **Target 8–10 model turns** for a complete diagram. Pre-compute the full layout before making any MCP calls.

## Layout Conventions

Concise summary; load [`references/style-reference.md`](references/style-reference.md) → "Layout Conventions (extended)" for full detail (numbered callouts, fan-out staggering, legend HTML, group sizing, non-Azure component styling).

- **Primary flow**: left-to-right; parallel services stacked vertically per column
- **Spacing minimums**: 120px between columns, 80px between rows, 40px around each cell; groups need ≥150px width per icon
- **Page**: US Letter 850×1100px (extend to 1300px if a legend is included); 40px margins
- **Edges**: orthogonal only (`edgeStyle=orthogonalEdgeStyle`); never set `entryX/Y` / `exitX/Y` and never add `<Array as="points">` waypoints. Target specific icons inside groups, not the group cell
- **Cross-cutting services** (Azure Monitor, Entra ID, Key Vault, Defender): single light-grey rounded container at the bottom, 120px apart, no edges into them
- **Legend**: required on every diagram, below the cross-cutting box; use inline HTML for arrow indicators; explicitly set `text: ""` on shape samples
- **External actors** (Users, Operators): outside all group boundaries

> **Edge post-processing (CRITICAL)**: After `finish-diagram`, run `tools/scripts/save-drawio.py` to strip auto-router anchors and waypoints so Draw.io can recalculate clean orthogonal paths. The post-save cleanup script (`cleanup-drawio.py`) is documented in [`references/creation-workflows.md`](references/creation-workflows.md).

## Gotchas

- **`text: ""` breaks shapes** — every shaped vertex MUST have a `text` label
  or omit `text` entirely; never pass `""`.
- **No dimensions with `shape_name`** — never pass `width`, `height`, or `style`
  when using `shape_name`; the MCP server auto-applies correct values.
- **Transactional mode MUST end with `finish-diagram`** — otherwise the diagram
  keeps ~2KB placeholders instead of real SVG icons.
- **`shape=image` + `image=data:image/svg+xml;base64,…` is the RESOLVED form** —
  do NOT confuse it with `placeholder=1`. After `finish-diagram(compress: true)`,
  every Azure icon appears as `shape=image;…;image=data:image/svg+xml;base64,<svg>`
  with a multi-path Azure-brand SVG inside. The validator counts these as
  `totalImages` (real icons). The `placeholder=1` style attribute is the ONLY
  marker of an unresolved transactional cell — count it with
  `grep -c 'placeholder=1' file.drawio` before declaring a diagram broken.
- **Never read large MCP responses through the LLM** — extract data via terminal
  (Python script) to avoid context-window inflation.
- **Batch-only workflow** — every tool accepting arrays is called ONCE with ALL items.
- **No edge anchors or waypoints** — never set `entryX/Y`, `exitX/Y`, or add
  `<Array as="points">` to edges.

## Reference Index

| File                                             | Purpose                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `references/style-reference.md`                  | Draw.io style properties for AI-generated files                  |
| `references/azure-patterns.md`                   | Reusable MCP tool call patterns for Azure architectures          |
| `references/validation-checklist.md`             | Validation rules for AI-generated `.drawio` files                |
| `references/abstraction-rules.md`                | Diagram abstraction and data-flow clarity rules                  |
| `references/iac-to-diagram.md`                   | Generate diagrams from Bicep/Terraform/ARM templates             |
| `references/quality-rubric.md`                   | Canonical 0–4 quality rubric (7 dimensions, thresholds)          |
| `references/semantic-zones.md`                   | Subscription / region / trust-boundary / external zone templates |
| `references/diagram-types.md`                    | Logical / network / sequence / deployment selection + signatures |
| `references/legend-template.md`                  | Copy-pasteable legend block (inline + two-column variants)       |
| `references/icon-variants.md`                    | Service tier / SKU disambiguation + single-batch contract        |
| `references/large-architecture-decomposition.md` | Tier S/M/L/XL breakpoints, decomposition, density target         |

### Quality Reference Examples

| File                                             | Pattern                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `examples/azure-vm-baseline-architecture.drawio` | VM baseline — VNet + 6 subnets, vertical flow, legend  |
| `examples/azure-aks-microservices.drawio`        | AKS microservices — horizontal flow, namespaces, CI/CD |
| `examples/azure-dns-private-resolver.drawio`     | DNS Private Resolver — hub-spoke, numbered callouts    |
| `examples/azure-foundry-landing-zone.drawio`     | Foundry Chat — landing zone, multi-subscription        |
| `examples/azure-vm-baseline-architecture.svg`    | Source SVG from Microsoft Learn (reference comparison) |
