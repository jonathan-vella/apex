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

### General Rules

- **Primary flow**: left-to-right. Each stage occupies a column.
- **Parallel services**: stacked vertically within their column, never side-by-side.
- **Spacing**: 120px horizontal between columns, 80px vertical between rows,
  40px around each cell. These minimums prevent icon labels (often 100–140px wide)
  from colliding with adjacent icons.
- **Subnet row height**: For stacked subnet/namespace layouts, use **120–130px row height**
  per row — icon (48px) + label (~20px below) + 40px gap to next subnet border.
- **Page**: US Letter 850×1100px (extend to 1300px for diagrams with legend).
  Content within 40px margins on all sides (usable area = page size minus 80px
  in each dimension; e.g., 770×1020 at 1100px height, 770×1220 at 1300px).
- **No overlapping**: Components must not overlap each other.

### Layout Patterns

- **Left-to-right flow** (default — use unless the architecture is clearly
  hub-spoke or multi-subscription): Each stage occupies a column. Use for
  ingress → compute → data store architectures (VM baseline, AKS, App Service).
- **Center-column hub-spoke**: Hub VNet in the center column with spokes
  radiating right. External/on-prem services on the left. Use for networking
  architectures (DNS, firewall, hub-spoke topologies).
- **Multi-subscription landing zone**: Stacked color-coded containers for each
  subscription boundary (e.g., green for connectivity/hub, blue for app landing
  zone, purple for external PaaS like Foundry). External actors (Users) placed
  outside all containers. Use for enterprise landing zone architectures.

### Numbered Callout Annotations

For multi-step flow explanations (common in Microsoft reference architectures),
use circled Unicode numbers as small text vertices placed near the relevant
icon or edge: `①②③④⑤⑥⑦⑧⑨⑩`. Style them with `fontSize=11;fontColor=#CC0000;fontStyle=1`
so they stand out as red bold callouts without cluttering the diagram.

### Non-Azure Component Styling

For on-premises, external, or third-party services that don't have Azure icons,
use a **yellow-tinted rectangle** to visually distinguish them from Azure resources:

```text
shape=mxgraph.basic.rect;fillColor=#FFF9E6;strokeColor=#D4A017;rounded=1;
fontSize=10;fontColor=#8B6914;whiteSpace=wrap;
```

Examples: on-premises DNS servers, hosted public DNS, external partner systems,
client apps, CI/CD pipelines.

### Groups

- Create groups for VNets, subnets, Container Apps Environments, resource groups.
- Set `text: ""` for groups — create a separate bold text vertex above the group instead.
- Use `suggest-group-sizing` to calculate dimensions based on child count.
- **Minimum width per icon count**: Allow at least **150px per icon** horizontally,
  because icon labels like "Application Insights" or "DNS Private Resolver"
  are ~130px wide and collide at tighter spacing.
  A hub VNet with 5 icons needs ≥ 750px width.
- **Actor placement**: External actors (Users, Operators, Clients) must be
  positioned **outside** all container boundaries, because actors placed inside
  a group’s coordinate range get visually swallowed by the container fill.
  After placing actors, verify their coordinates don’t fall within any
  group’s x/y/width/height range.

### Edges

- **Orthogonal only**: Use `edgeStyle=orthogonalEdgeStyle` (the default).
- **NO anchor points**: Never set `entryX`, `entryY`, `exitX`, `exitY` in your edge style.
- **NO waypoints**: Do not add `<Array as="points">` or `<mxPoint>` elements.
- **Side exits preferred**: edges exit/enter through left or right sides.
- **Target icons, not groups**: Always connect edges to the specific icon vertex
  (via `temp_id`), not the parent group/subnet cell ID, because the orthogonal
  router calculates the path through every intervening group boundary between
  source and target — creating messy vertical corridors and label collisions.
- **One edge per source into a group**: When a source connects to a service
  inside a group, target the specific child icon. Only target the group cell
  itself when the container is the conceptual endpoint (rare).
- **No edges to cross-cutting services**: their presence is implied.
- **Fan-out staggering**: When multiple edges leave the same source, keep them
  minimal. Consider merging semantically similar paths (e.g., "Partner Data Export"
  instead of Storage → Data Share → Partners as 3 separate edges).

> **CRITICAL — Post-Processing Required**: The MCP server's auto-router injects
> `exitX/exitY/entryX/entryY` anchor points and `<Array>` waypoints into every
> edge it creates. These computed routes are poor for fan-out patterns and cause
> edges to pile up in horizontal corridors. After `finish-diagram`, the agent
> **MUST** run `tools/scripts/save-drawio.py` which strips these injected anchors and
> waypoints, letting Draw.io's client-side renderer calculate clean orthogonal
> paths when the file is opened.

### Cross-Cutting & Supporting Services

Place Azure Monitor, Entra ID, Key Vault, Azure Policy, Defender for Cloud,
Container Registry, DNS Zones, Application Insights, Log Analytics at the
**bottom** of the diagram, 120px below the main flow. No edges to them.
Space **120px apart** (center-to-center) — labels like "Application Insights"
and "Private DNS Zones" need this width. Wrap into multiple rows at page width.

Enclose all cross-cutting icons in a **single light-grey rounded container**
(`fillColor=#F5F5F5;strokeColor=#BDBDBD`) with a bold Azure-blue heading
("Cross-cutting platform services") inside at the top.

### Legend

Every diagram MUST include a legend. Place it in a horizontal bar **below** the
cross-cutting services box (not beside it — side-by-side causes overlap).

- Use inline HTML for colored arrow indicators:
  `<font color="#0078D4"><b>━━▶</b></font>  Data flow (HTTPS / TLS)`
- Add small colored rectangle swatches for container styles (e.g., blue dashed
  for data-path subnets, orange dashed for operational subnets).
- **When creating legend shape samples** via `add-cells`, always set `text: ""`
  explicitly — the MCP server defaults to `"New Cell"` which renders as visible text.

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

- **`text: ""` breaks shapes** — Every shaped vertex MUST have a `text`
  label or omit `text` entirely. NEVER pass `text: ""` (empty string).
- **Do NOT specify dimensions with `shape_name`** — Do NOT pass `width`,
  `height`, or `style` when using `shape_name` — the MCP server auto-applies
  correct dimensions. Specifying these breaks icon rendering.
- **Transactional mode MUST call `finish-diagram`** — When using
  `transactional: true`, MUST call `finish-diagram` at the end. Without it,
  diagram contains ~2KB placeholder shapes instead of real SVG icons.
- **Never read large MCP responses through LLM** — When a tool returns
  full XML in JSON (~200KB), extract via terminal (Python script) to avoid
  context window inflation.
- **Batch-only workflow** — Every tool accepting arrays MUST be called
  ONCE with ALL items. Never call repeatedly for individual items.
- **No anchor points or waypoints** — Never set `entryX`, `entryY`,
  `exitX`, `exitY` in edge style. Do not add `<Array as="points">` or
  `<mxPoint>` elements.

## Reference Index

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `references/style-reference.md`      | Draw.io style properties for AI-generated files         |
| `references/azure-patterns.md`       | Reusable MCP tool call patterns for Azure architectures |
| `references/validation-checklist.md` | Validation rules for AI-generated `.drawio` files       |
| `references/abstraction-rules.md`    | Diagram abstraction and data-flow clarity rules         |
| `references/iac-to-diagram.md`       | Generate diagrams from Bicep/Terraform/ARM templates    |

### Quality Reference Examples

| File                                             | Pattern                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `examples/azure-vm-baseline-architecture.drawio` | VM baseline — VNet + 6 subnets, vertical flow, legend  |
| `examples/azure-aks-microservices.drawio`        | AKS microservices — horizontal flow, namespaces, CI/CD |
| `examples/azure-dns-private-resolver.drawio`     | DNS Private Resolver — hub-spoke, numbered callouts    |
| `examples/azure-foundry-landing-zone.drawio`     | Foundry Chat — landing zone, multi-subscription        |
| `examples/azure-vm-baseline-architecture.svg`    | Source SVG from Microsoft Learn (reference comparison) |

Also see: `tmp/azure-architecture-example.drawio`, `tmp/03-des-diagram.svg`
