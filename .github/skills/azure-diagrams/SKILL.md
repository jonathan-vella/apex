---
name: azure-diagrams
description: "Azure architecture diagrams (editable .excalidraw with official icons) and WAF/cost charts (Python matplotlib). Excalidraw is the default for architecture diagrams. USE FOR: architecture diagrams, dependency diagrams, runtime flow diagrams, as-built diagrams, WAF radar charts, cost pie charts. DO NOT USE FOR: Bicep/Terraform code, ADR writing, troubleshooting, cost calculations."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Uses Excalidraw MCP (remote) configured in .vscode/mcp.json. Python diagrams library for charts.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "6.0"
  repository: https://github.com/excalidraw/excalidraw
---

# Azure Architecture Diagrams Skill

Unified skill for all diagram generation: architecture diagrams (Excalidraw default)
and WAF/cost charts (Python matplotlib).

## Routing Guide

- **Architecture diagrams** → Excalidraw JSON (`.excalidraw`) — this is the DEFAULT
- **WAF bar charts, cost donuts, cost projections, compliance gaps** → Python matplotlib (`.py` + `.png`)
- **Swimlane / ERD / timeline** → Python graphviz (`.py` + `.png`)

## Prerequisites

- Excalidraw MCP configured in `.vscode/mcp.json` (remote: `https://mcp.excalidraw.com/mcp`)
- Azure icon library: `assets/excalidraw-libraries/azure-icons.excalidrawlib` (pre-built)
- Icon reference: `assets/excalidraw-libraries/azure-icons/reference.md` (icon lookup table)
- Fabric icon library: `assets/excalidraw-libraries/fabric-icons.excalidrawlib` (pre-built)
- Fabric icon reference: `assets/excalidraw-libraries/fabric-icons/reference.md` (icon lookup table)
- VS Code extension: `pomdtr.excalidraw-editor` (installed via devcontainer)
- For Python charts: `pip install diagrams matplotlib pillow && apt-get install -y graphviz`

## Architecture Diagram Contract (Excalidraw — Default)

### Required outputs

| Step | Excalidraw files                                                    | Python chart files (if applicable)                                   |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3    | `03-des-diagram.excalidraw`                                         | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.excalidraw`, `04-runtime-diagram.excalidraw` | —                                                                    |
| 7    | `07-ab-diagram.excalidraw`                                          | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

### Output format

`.excalidraw` files are Excalidraw JSON — editable in VS Code (pomdtr extension)
or excalidraw.com, version-controlled in git. CI auto-generates `.excalidraw.svg`
for embedding in documentation.

### Quality gate (/10)

Readable at 100% zoom · No label overlap · Minimal line crossing ·
Clear tier grouping · Correct icons · Security boundary visible ·
No stray icon/vector elements outside their intended boxes ·
Service labels centered and visually consistent · Footer unobtrusive ·
Canvas usage dense enough to avoid architectural sprawl ·
No micro-text, compressed cards, or placeholder regions.
If < 9/10, regenerate from a clean base instead of patching the broken layout.

## Naming Conventions

Element IDs: `{resource-type}-{number}` (e.g., `vm-1`). Group IDs: `{scope}-{name}` (e.g., `rg-prod`).
Arrow IDs: `e-{source}-to-{target}`. Labels: actual resource names from architecture.

## Azure Design Tokens

Azure Blue `#0078D4` (borders, arrows) · VNet fill `#e7f5ff` · Warning `#FF8C00` ·
Security `#C00000` · Font: Excalifont (`fontFamily: 5`) · Icon: 48×48.

## Excalidraw Color Palette

| Purpose             | Color       | Hex       |
| ------------------- | ----------- | --------- |
| Primary elements    | Light Blue  | `#a5d8ff` |
| VNet / containers   | Pale Blue   | `#e7f5ff` |
| Security boundary   | Red         | `#ffc9c9` |
| Important / Central | Yellow      | `#ffd43b` |
| Data / Storage      | Light Green | `#b2f2bb` |
| Borders / Arrows    | Azure Blue  | `#0078D4` |
| Warning             | Orange      | `#FF8C00` |
| Text / Stroke       | Dark        | `#1e1e1e` |

## Diagram Abstraction Rules (MANDATORY)

Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).
Place cross-cutting services (KV, monitoring, DNS) in a bottom row with NO edges.
Consolidate external APIs into one grouped box.
Keep architecture diagrams conceptual by default: omit SKU names, service tiers,
node counts, policy revisions, product versions, and similar inventory detail unless
the architecture cannot be understood without that distinction.
See `references/abstraction-rules.md` for full rules.

## Detail Level By Step (MANDATORY)

- **Step 3 design diagrams**: conceptual architecture only. Use service names,
  major boundaries, key trust zones, and the primary flow. Do not include SKU,
  tier, node-count, or policy-version text in tiles unless the design decision
  itself depends on that distinction.
- **Step 7 as-built diagrams**: architecture first, inventory second. Actual deployed
  resource names may appear when they materially improve traceability, but SKU,
  tier, node-count, and similar inventory detail should stay in Step 7 documents,
  not on the main diagram canvas.

## Preferred Visual Language (MANDATORY)

Use an enterprise Azure reference-architecture style modeled on Microsoft landing-zone and
workload topology diagrams rather than a loose whiteboard aesthetic.

- **Outer shell first**: Start with a clear outer boundary for the Azure
  subscription, landing zone, or workload shell.
- **Nested responsibility zones**: Use color-coded inner regions for workload,
  analytics, security, connectivity, and supporting services.
- **Structured density**: Fill the canvas deliberately; avoid large empty areas
  that force long connectors or make the diagram feel unfinished.
- **Readable scale**: Solve layout pressure by enlarging the composition or reducing
  content density, not by shrinking labels until they become difficult to read.
- **Conceptual emphasis**: Favor service identity and architectural role over SKU,
  version, or operational metadata in tile text.
- **Anchored placement**: Important ingress, perimeter, or shared services must look
  intentionally placed relative to the zone they serve. Avoid isolated tiles floating
  in leftover canvas between the title, legend, and major regions.
- **Perimeter actors**: Keep users, devices, partners, internet, and external
  platforms on the perimeter, with the core workload in the middle.
- **Grouped dependencies**: Put related supporting or external dependencies into
  compact dashed containers instead of scattering them, but only if the group
  contains enough real content to justify a dedicated region.
- **Orthogonal flow**: Prefer horizontal and vertical routes with explicit bends
  and minimal crossings.
- **Legend discipline**: Add a compact legend only when connector colors or
  stroke styles carry semantic meaning.
- **Documentation tone**: White or near-white canvas, restrained fills,
  official icons, and crisp labels. The diagram should look publishable in
  architecture docs.

## Anti-Patterns (DO NOT DO THIS)

- Sparse layouts with most content compressed into one corner or band of the canvas
- Long, meandering connectors that travel through unused space
- Dense low-level wiring that exposes every implementation detail instead of the
  primary architecture
- Tiny text, low-contrast labels, or labels pushed too close to lines and icon
  edges
- Over-compressed layouts where zones, cards, legend, and footer all compete in the
  same narrow band of space
- Placeholder dependency regions or support bands that look half-empty or unfinished
- Mixed-size peer cards within the same support band or shared-service row
- Card subtitles dominated by SKU names, tier labels, node counts, or policy versions
  that add noise without improving architectural understanding
- Small free-floating labels near zone titles, centered whitespace, or unrelated arrows
  that read like accidental leftovers rather than deliberate annotation
- Integration lines with loops, decorative bends, or indirect detours when a simpler
  orthogonal route would communicate the same relationship
- Mixed connector colors without a legend or without stable semantics
- Weak hierarchy where primary workload, supporting services, and external
  systems all carry the same visual weight

## Layout Best Practices

- **Flow**: Left-to-right or top-to-bottom. Group data resources inside VNet rectangle.
- **Composition**: Use outer shell → zones → service groups → services as the
  default build order.
- **Hierarchy**: Emphasize the main architecture story first. Supporting bands,
  legends, and secondary groups must read as subordinate content.
- **Labels**: Service-box labels must be center-aligned within the box body,
  use a standardized size range (`13-16`), and stay below the icon area.
  All text uses `fontFamily: 5` (Excalifont).
- **Readable sizing**: Prefer service labels in the `16-20` range and titles in the
  `24-32` range. Reduce content, not legibility, when space gets tight.
- **Tile text**: Prefer a single service name and, at most, one short architectural
  role line. Do not use tiles as mini inventory cards.
- **Spacing**: Icons ≥200px apart horizontally, ≥150px vertically.
  Min 50px from container edges.
- **Service tiles**: Make the default service card materially larger than the icon.
  Avoid miniature cards whose subtitle, icon, and label compete for the same space.
- **Anchoring**: If a service is important enough to appear as its own tile,
  place it as part of a clear row, column, or zone cluster. Do not leave lone tiles
  stranded above the architecture without strong alignment.
- **Containers**: VNet min 300×300px rectangle with label. Prefer rounded outer
  shells and rectangular inner zones. Canvas starts at origin `(0, 0)`.
- **Arrows**: Prefer edge-anchored elbow or single-bend arrows with explicit
  points. Do not route arrows through icons or text labels.
- **Edge labels**: Use only the few labels that materially improve comprehension.
  Most flows should be understandable from placement and icon choice alone.
- **Subtitles**: If a subtitle is not necessary to distinguish architectural behavior,
  remove it.
- **Partner / external routes**: Use a single calm orthogonal route for file-sharing,
  partner exchange, or external integration paths whenever possible.
- **Dependency groups**: Use dashed containers for grouped external or
  supporting dependencies, not for primary workload zones.
- **Legend**: Place a small legend near the top-left or top-center only when
  the line system needs explanation.
- **Footer**: Keep attribution small, quiet, and bottom-right aligned inside
  the outermost region shell with clear separation from the supporting band.
- **Support band**: If a supporting-services band is shown, its cards and labels must
  remain comfortably readable. Peer cards within the same band must share identical
  width, height, corner treatment, and baseline alignment unless they are intentionally
  split into different visual classes. If the band becomes cramped, reduce items shown
  or enlarge the band.
- **Mixed icon sets**: Use Fabric-native vector icons for Fabric services and
  Azure service icons for Azure resources in the same diagram when both are
  present.

## Icon Discovery

Look up Azure service icons in `assets/excalidraw-libraries/azure-icons/reference.md`.
Look up Fabric icons in `assets/excalidraw-libraries/fabric-icons/reference.md`.
Use Fabric icons for Fabric-native services such as Fabric, Data Factory,
Real-Time Intelligence, Lakehouse, Eventhouse/KQL Database, and Power BI.
Use Azure icons for Azure-native services such as AKS, App Gateway,
PostgreSQL, Event Hubs, Key Vault, Storage, Entra, Monitor, and Defender.
For programmatic icon placement, use the Python scripts:

- `scripts/add-icon-to-diagram.py <diagram> <icon-name> <x> <y> [--label "Text"]`
- `scripts/add-arrow.py <diagram> <from-x> <from-y> <to-x> <to-y> [--label "Text"]`

Icons are loaded from `assets/excalidraw-libraries/azure-icons/icons/` (individual JSON files).

## MCP Tool Integration

The Excalidraw MCP server at `https://mcp.excalidraw.com/mcp` provides interactive
diagram creation. Use it for visual diagram building when available.

**MCP Fallback**: If the remote MCP is unavailable, generate `.excalidraw` JSON
directly using the Excalidraw schema and Python scripts for icon placement.
The schema reference is at `references/excalidraw-schema.md`.

See `references/mcp-tool-integration.md` for MCP tool details and workflow.

## Python Charts (WAF / Cost / Compliance)

WAF/cost charts use Python `matplotlib` (never Mermaid).
See `references/python-charts.md` for execution, design tokens, and output standards.
See `references/waf-cost-charts.md` for full chart implementations.

## Common Architecture Patterns

See `references/excalidraw-common-patterns.md` (Excalidraw),
`references/common-patterns.md` (Python), and
`references/iac-to-diagram.md` (Bicep/Terraform to diagram).

## Curated Reference Example

When the target output should resemble a polished enterprise Azure reference
architecture, consult `references/enterprise-reference-example.md` and
`references/enterprise-reference-example.excalidraw` on demand.

Use this example as a benchmark for hierarchy, spacing discipline, anchored
shared-service placement, conceptual labeling, and support-band geometry.
Do not copy workload-specific services or text from the example unless they are
actually part of the current architecture.

## Cross-Step Visual Continuity

Treat Step 3, Step 4, and Step 7 architecture diagrams as one visual family.
Step 3 establishes the baseline visual language; Step 4 dependency/runtime
diagrams and Step 7 as-built diagrams must keep the same composition grammar,
spacing discipline, zone hierarchy, connector discipline, anchored shared-service
placement, and support-band geometry.

What changes by step is the information emphasis, not the visual contract:

- **Step 3**: conceptual topology and major boundaries
- **Step 4**: dependency and runtime relationships using the same layout discipline
- **Step 7**: actual deployed names when useful, without turning the canvas into an inventory sheet

## Workflow Integration

| Step | Excalidraw files                                                    | Python chart files                                                   |
| ---- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2    | —                                                                   | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-diagram.excalidraw`                                         | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.excalidraw`, `04-runtime-diagram.excalidraw` | —                                                                    |
| 7    | `07-ab-diagram.excalidraw`                                          | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid).
See `references/waf-cost-charts.md` for implementations
and `references/python-charts.md` for design tokens.

## Generation Workflow

### Architecture Diagrams (Excalidraw — Default)

1. Gather context → 2. Identify resources & flow
   → 3. Look up Azure/Fabric icons in reference.md
   → 4. Define outer shell, nested zones, and grouped dependency boxes
   → 5. Create a clean base diagram JSON (do not mutate a broken layout in place)
   → 6. Add icons, normalizing imported vector icon bounds before placement
   → 7. Add centered labels and edge-anchored arrows with explicit bend points
   → 8. Add a legend only if connector semantics need explanation
   → 9. Remove non-essential edge labels, placeholder groups, low-value flows,
   and inventory-style tile text
   → 9.5. Normalize peer-card geometry in support bands or shared-service rows so
   same-role cards use the same size and alignment
   → 10. Check that perimeter tiles are visually anchored and that external routes use
   the simplest orthogonal path available
   → 11. Validate that no element sits outside its intended container
   → 12. Quality gate (≥9/10) → 13. Save `.excalidraw` file.

### Saving .excalidraw Files

Write the Excalidraw JSON directly to the output path using file creation tools.
CI will auto-generate `.excalidraw.svg` via the `excalidraw-svg-export` workflow.

### Charts (Python matplotlib)

1. Gather context → 2. Generate Python code → 3. Execute & verify PNG.
   See `references/python-charts.md` for details.

## Guardrails

**DO:** Generate `.excalidraw` JSON files · Look up icons in `reference.md` ·
Use Python scripts or direct JSON generation for icon/arrow placement ·
Place cross-cutting services at bottom with NO edges · Consolidate external APIs ·
Omit PEs/ASPs/NSGs · Include diagram title · Apply design tokens ·
Use `fontFamily: 5` (Excalifont) for all text ·
Use Fabric vector icons for Fabric services when available ·
Center service labels ·
Build the visual hierarchy with outer shells and nested zones first ·
Keep footer small at bottom-right ·
Increase tile size before decreasing font size ·
Keep only essential edge labels ·
Prefer conceptual service labels over SKU or version subtitles ·
Validate no orphaned vector elements remain outside the layout ·
Use compact legends only when connector semantics need explanation ·
Keep supporting-service bands readable and separated from the footer ·
Generate WAF scores PNG when WAF scores are assigned.

**DON'T:** Use Python `diagrams` for architecture (use Excalidraw) ·
Draw edges to cross-cutting services ·
Show PEs, ASPs, NSGs, or RG boundaries · Create separate boxes per external API ·
Skip quality gate · Use Mermaid for charts · Leave arrows crossing labels/icons ·
Use Azure substitute icons for Fabric-native services when a Fabric icon exists ·
Spread the architecture across a mostly empty canvas ·
Compress the layout until labels, legend text, or footer text become hard to read ·
Leave half-empty grouped dependency regions in the final output ·
Turn service tiles into mini inventory records full of SKU or configuration text ·
Leave lone ingress tiles floating in leftover canvas or use looping partner-share routes ·
Overload the diagram with low-level wiring or unexplained line colors.

## Scope Exclusions

Does NOT: generate Bicep/Terraform · create workload docs · deploy resources ·
create ADRs · perform WAF assessments · render Mermaid diagrams.

## Scripts

`scripts/add-icon-to-diagram.py` (add Azure icon to diagram) ·
`scripts/add-arrow.py` (add arrow between points) ·
`scripts/verify_installation.py` (prerequisites check)

## Reference Index

### Excalidraw References (architecture diagrams)

| File                                       | Content                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `references/mcp-tool-integration.md`       | MCP tool details, workflow steps, fallback protocol                        |
| `references/abstraction-rules.md`          | Show/omit rules, cross-cutting services, edge labels, title/footer         |
| `references/excalidraw-common-patterns.md` | Complete architecture pattern templates (3-tier, hub-spoke, serverless)    |
| `references/excalidraw-schema.md`          | Excalidraw JSON schema reference (element types, properties, coordinates)  |
| `references/element-types.md`              | Detailed element type specifications (rectangle, arrow, text, image, etc.) |

### Python References (charts and specialized diagrams)

| File                                         | Content                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `references/python-charts.md`                | Python chart execution, design tokens, output standards                      |
| `references/azure-components.md`             | Complete list of Azure diagram components                                    |
| `references/business-process-flows.md`       | Workflow and swimlane diagram patterns                                       |
| `references/common-patterns.md`              | Ready-to-use Python architecture patterns (3-tier, microservices, hub-spoke) |
| `references/entity-relationship-diagrams.md` | Database ERD patterns                                                        |
| `references/iac-to-diagram.md`               | Generate diagrams from Bicep/Terraform/ARM templates                         |
| `references/integration-services.md`         | Integration service diagram patterns                                         |
| `references/migration-patterns.md`           | Migration architecture patterns                                              |
| `references/preventing-overlaps.md`          | Layout troubleshooting and overlap prevention                                |
| `references/quick-reference.md`              | Copy-paste snippets for Excalidraw JSON patterns                             |
| `references/sequence-auth-flows.md`          | Authentication flow sequence patterns                                        |
| `references/timeline-gantt-diagrams.md`      | Project timeline and Gantt diagrams                                          |
| `references/ui-wireframe-diagrams.md`        | UI mockup and wireframe patterns                                             |
| `references/waf-cost-charts.md`              | WAF pillar bar, cost donut & projection chart implementations                |
