<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Excalidraw Architecture Diagrams (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Mandatory Icon Embedding

Every Step 3, Step 4, and Step 7 architecture deliverable MUST embed official
Azure or Fabric icons directly in the `.excalidraw` JSON.

This is an execution requirement, not a prompt suggestion. If the saved file
still has box-only service tiles, the skill failed and the diagram is not ready
for handoff.

> _See SKILL.md for full content._

## Prerequisites

- Excalidraw MCP configured in `.vscode/mcp.json` (remote: `https://mcp.excalidraw.com/mcp`)
- Azure icon library: `assets/excalidraw-libraries/azure-icons.excalidrawlib` (pre-built)
- Icon reference: `assets/excalidraw-libraries/azure-icons/reference.md` (icon lookup table)
- Fabric icon library: `assets/excalidraw-libraries/fabric-icons.excalidrawlib` (pre-built)
- Fabric icon reference: `assets/excalidraw-libraries/fabric-icons/reference.md` (icon lookup table)
- VS Code extension: `pomdtr.excalidraw-editor` (installed via devcontainer)

> _See SKILL.md for full content._

## Required Outputs

| Step | Excalidraw files                                                    |
| ---- | ------------------------------------------------------------------- |
| 3    | `03-des-diagram.excalidraw`                                         |
| 4    | `04-dependency-diagram.excalidraw`, `04-runtime-diagram.excalidraw` |
| 7    | `07-ab-diagram.excalidraw`                                          |

> _See SKILL.md for full content._

## Required Icon Workflow

Follow this loop every time the skill generates or repairs an Excalidraw
architecture diagram:

1. Build the outer shell, zones, and service tiles first.
2. Resolve every Azure or Fabric tile to an official icon from the bundled
   library before treating the diagram as complete.

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Diagram Abstraction Rules (MANDATORY)

Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).
Place cross-cutting services (KV, monitoring, DNS) in a bottom row with NO edges.
Consolidate external APIs into one grouped box.
Keep architecture diagrams conceptual by default: omit SKU names, service tiers,
node counts, policy revisions, product versions, and similar inventory detail unless
the architecture cannot be understood without that distinction.

> _See SKILL.md for full content._

## Detail Level By Step (MANDATORY)

- **Step 3 design diagrams**: conceptual architecture only. Use service names,
  major boundaries, key trust zones, and the primary flow. Do not include SKU,
  tier, node-count, or policy-version text in tiles unless the design decision
  itself depends on that distinction.
- **Step 7 as-built diagrams**: architecture first, inventory second. Actual deployed
  resource names may appear when they materially improve traceability, but SKU,

> _See SKILL.md for full content._

## Preferred Visual Language (MANDATORY)

Use an enterprise Azure reference-architecture style modeled on Microsoft landing-zone and
workload topology diagrams rather than a loose whiteboard aesthetic.

- **Outer shell first**: Start with a clear outer boundary for the Azure
  subscription, landing zone, or workload shell.
- **Nested responsibility zones**: Use color-coded inner regions for workload,

> _See SKILL.md for full content._

## Anti-Patterns (DO NOT DO THIS)

- Sparse layouts with most content compressed into one corner or band of the canvas
- Long, meandering connectors that travel through unused space
- Dense low-level wiring that exposes every implementation detail instead of the
  primary architecture
- Tiny text, low-contrast labels, or labels pushed too close to lines and icon edges
- Over-compressed layouts where zones, cards, legend, and footer all compete in the

> _See SKILL.md for full content._

## Layout Best Practices

- **Flow**: Left-to-right or top-to-bottom. Group data resources inside VNet rectangle.
- **Composition**: Use outer shell → zones → service groups → services as the
  default build order.
- **Hierarchy**: Emphasize the main architecture story first. Supporting bands,
  legends, and secondary groups must read as subordinate content.
- **Labels**: Service-box labels must be center-aligned within the box body,

> _See SKILL.md for full content._

## Icon Discovery

Look up Azure service icons in `assets/excalidraw-libraries/azure-icons/reference.md`.
Look up Fabric icons in `assets/excalidraw-libraries/fabric-icons/reference.md`.
Use Fabric icons for Fabric-native services such as Fabric, Data Factory,
Real-Time Intelligence, Lakehouse, Eventhouse/KQL Database, and Power BI.
Use Azure icons for Azure-native services such as AKS, App Gateway,
PostgreSQL, Event Hubs, Key Vault, Storage, Entra, Monitor, and Defender.

> _See SKILL.md for full content._

## MCP Tool Integration

The Excalidraw MCP server at `https://mcp.excalidraw.com/mcp` provides interactive
diagram creation. Use it for visual diagram building when available.

**MCP Fallback**: If the remote MCP is unavailable, generate `.excalidraw` JSON
directly using the Excalidraw element conventions in `references/quick-reference.md`
and Python scripts for icon placement.

> _See SKILL.md for full content._

## Common Architecture Patterns

See `references/excalidraw-common-patterns.md` for complete pattern templates with
icon positions and arrow connections.

## Curated Reference Example

When the target output should resemble a polished enterprise Azure reference
architecture, consult `references/enterprise-reference-example.md` and
`references/enterprise-reference-example.excalidraw` on demand.

Use this example as a benchmark for hierarchy, spacing discipline, anchored
shared-service placement, conceptual labeling, and support-band geometry.

> _See SKILL.md for full content._

## Cross-Step Visual Continuity

Treat Step 3, Step 4, and Step 7 architecture diagrams as one visual family.
Step 3 establishes the baseline visual language; Step 4 dependency/runtime
diagrams and Step 7 as-built diagrams must keep the same composition grammar,
spacing discipline, zone hierarchy, connector discipline, anchored shared-service
placement, and support-band geometry.

> _See SKILL.md for full content._

## Generation Workflow

1. Gather context → 2. Identify resources & flow
   → 3. Look up Azure/Fabric icons in reference.md
   → 4. Define outer shell, nested zones, and grouped dependency boxes
   → 5. Create a clean base diagram JSON (do not mutate a broken layout in place)
   → 6. Add icons, normalizing imported vector icon bounds before placement
   → 7. Add centered labels and edge-anchored arrows with explicit bend points

> _See SKILL.md for full content._

## IaC-to-Diagram Translation

See `references/iac-to-diagram.md` for generating Excalidraw diagrams from existing
Bicep, Terraform, or ARM template files.

## Guardrails

**DO:** Generate `.excalidraw` JSON files · Look up icons in `reference.md` ·
Use Python scripts or direct JSON generation for icon/arrow placement ·
Place cross-cutting services at bottom with NO edges · Consolidate external APIs ·
Omit PEs/ASPs/NSGs · Include diagram title · Apply design tokens ·
Use `fontFamily: 5` (Excalifont) for all text ·
Use Fabric vector icons for Fabric services when available ·

> _See SKILL.md for full content._

## Scope Exclusions

Does NOT: generate Bicep/Terraform · create workload docs · deploy resources ·
create ADRs · perform WAF assessments · render Mermaid diagrams · generate
WAF/cost/compliance charts (use `python-diagrams` skill) · generate Draw.io
diagrams (use `drawio` skill — planned).
