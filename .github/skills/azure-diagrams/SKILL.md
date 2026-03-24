---
name: azure-diagrams
description: "Azure architecture diagrams (editable .drawio with official icons + SVG export) and WAF/cost charts (Python matplotlib). Draw.io is the default for architecture diagrams. USE FOR: architecture diagrams, dependency diagrams, runtime flow diagrams, as-built diagrams, WAF radar charts, cost pie charts. DO NOT USE FOR: Bicep/Terraform code, ADR writing, troubleshooting, cost calculations."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Requires drawio-mcp-server (Deno) configured in .vscode/mcp.json. Python diagrams library for charts.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "5.0"
  repository: https://github.com/mingrammer/diagrams
---

# Azure Architecture Diagrams Skill

Unified skill for all diagram generation: architecture diagrams (draw.io default)
and WAF/cost charts (Python matplotlib).

## Routing Guide

- **Architecture diagrams** → Draw.io XML (`.drawio` + `.drawio.svg`) — this is the DEFAULT
- **WAF bar charts, cost donuts, cost projections, compliance gaps** → Python matplotlib (`.py` + `.png`)
- **Swimlane / ERD / timeline** → Python graphviz (`.py` + `.png`)

## Prerequisites

- drawio-mcp-server configured in `.vscode/mcp.json` (at `mcp/drawio-mcp-server/`)
- Azure icon libraries: `npm run build:drawio-icons` (pre-built in `assets/drawio-libraries/`)
- For Python charts: `pip install diagrams matplotlib pillow && apt-get install -y graphviz`

## Architecture Diagram Contract (Draw.io — Default)

### Required outputs

| Step | Draw.io files                                                                               | Python chart files (if applicable)                                   |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3    | `03-des-diagram.drawio` + `.drawio.svg`                                                     | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.drawio` + `.drawio.svg`, `04-runtime-diagram.drawio` + `.drawio.svg` | —                                                                    |
| 7    | `07-ab-diagram.drawio` + `.drawio.svg`                                                      | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

### SVG export

After generating `.drawio`, optionally export to SVG for doc embedding via
VS Code (right-click → Export) or `scripts/drawio/drawio-export.sh`.
Embed: `![Architecture](03-des-diagram.drawio.svg)`

### Output format

`.drawio` files are standard mxGraphModel XML — editable in VS Code or draw.io,
version-controlled in git, exportable to PNG/SVG/PDF.

### Quality gate (/10)

Readable at 100% zoom · No label overlap · Minimal line crossing ·
Clear tier grouping · Correct icons · Security boundary visible.
If < 9/10, regenerate with simplification.

## Naming Conventions

Cell IDs: `{resource-type}-{number}` (e.g., `vm-1`). Container IDs: `{scope}-{name}` (e.g., `rg-prod`).
Edge IDs: `e-{source}-to-{target}`. Labels: actual resource names from architecture.

## Azure Design Tokens

Azure Blue `#0078D4` (borders, edges) · VNet fill `#F0F8FF` · Warning `#FF8C00` ·
Security `#C00000` · Font: Arial · Icon: 48×48 · DPI: 150.

## Diagram Abstraction Rules (MANDATORY)

Show primary data flow clearly; omit implementation noise (PEs, ASPs, NSGs, RG boundaries).
Place cross-cutting services (KV, monitoring, DNS) in a bottom row with NO edges.
Consolidate external APIs into one grouped box.
See `references/abstraction-rules.md` for full rules.

## Layout Best Practices

- **Flow**: Left-to-right or top-to-bottom. Group data resources inside VNet container.
- **Labels**: `labelWidth=160;overflow=width;html=1;fontSize=9` on all icon cells.
  Space icons ≥260px apart. Max 2-line labels. Never `labelWidth` < 160.
- **Containers**: VNet min 250×250px, Canvas 1600×1000px.
- **Spacing**: Icons min 50px from edges, 120px vertical between stacked icons.

## Icon Discovery (MCP-Only)

Use `search-shapes` to find Azure icon shape names. Do NOT manually embed
base64 SVG. Common marketing names are auto-aliased (e.g., `"Entra External ID"` →
`"External Identities"`, `"Azure SQL"` → `"SQL Database"`).

## MCP Tool Integration

Key MCP tools: `search-shapes` (icon discovery), `add-cells` (batch build),
`create-groups` (containers), `finish-diagram` (resolve placeholders),
`validate-diagram` (quality score), `save-to-file` (write to disk).

See `references/mcp-tool-integration.md` for full tool table, workflow steps,
transactional mode, add-cells examples, and save-to-file usage.

## Python Charts (WAF / Cost / Compliance)

WAF/cost charts use Python `matplotlib` (never Mermaid).
See `references/python-charts.md` for execution, design tokens, and output standards.
See `references/waf-cost-charts.md` for full chart implementations.

## Common Architecture Patterns

See `references/drawio-common-patterns.md` (draw.io), `references/common-patterns.md` (Python),
`references/iac-to-diagram.md` (Bicep/Terraform to diagram).

## Workflow Integration

| Step | Draw.io files                           | Python chart files                                                   |
| ---- | --------------------------------------- | -------------------------------------------------------------------- |
| 2    | —                                       | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-diagram.drawio` + `.drawio.svg` | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 7    | `07-ab-diagram.drawio` + `.drawio.svg`  | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid).
See `references/waf-cost-charts.md` for implementations
and `references/python-charts.md` for design tokens.

## Generation Workflow

### Architecture Diagrams (Draw.io via MCP — Default)

1. Gather context → 2. Identify resources & flow → 3. Search shapes
   → 4. Create containers → 5. Build diagram (transactional) → 6. Assign to groups
   → 7. Finish diagram → 8. Quality gate (≥9/10) → 9. Save to file.

See `references/mcp-tool-integration.md` for detailed steps.

### Saving .drawio Files (via MCP `save-to-file`)

Call `save-to-file` after `finish-diagram` — no terminal extraction needed.
**NEVER** use `read_file` on MCP content.json responses.
See `references/mcp-tool-integration.md` for examples.

### Charts (Python matplotlib)

1. Gather context → 2. Generate Python code → 3. Execute & verify PNG.
   See `references/python-charts.md` for details.

## Guardrails

**DO:** Generate `.drawio` using MCP tools · Use `search-shapes` for icons ·
Use `create-groups` for VNet containers · Place cross-cutting services at bottom with NO edges ·
Consolidate external APIs · Omit PEs/ASPs/NSGs · Include diagram title and footer ·
Apply design tokens · Generate WAF scores PNG when WAF scores are assigned.

**DON'T:** Use Python `diagrams` for architecture (use draw.io MCP) ·
Manually embed base64 SVG · Draw edges to cross-cutting services ·
Show PEs, ASPs, NSGs, or RG boundaries · Create separate boxes per external API ·
Skip quality gate · Use Mermaid for charts · Read MCP content.json via `read_file`.

## Scope Exclusions

Does NOT: generate Bicep/Terraform · create workload docs · deploy resources ·
create ADRs · perform WAF assessments · render Mermaid diagrams.

## Scripts

`scripts/generate_diagram.py` (interactive) · `scripts/multi_diagram_generator.py` (multi-type) ·
`scripts/ascii_to_diagram.py` (ASCII→diagram) · `scripts/verify_installation.py` (prerequisites)

## Reference Index

### Draw.io References (architecture diagrams)

| File                                   | Content                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `references/mcp-tool-integration.md`   | MCP tool table, workflow steps, transactional mode, save-to-file        |
| `references/abstraction-rules.md`      | Show/omit rules, cross-cutting services, edge labels, title/footer      |
| `references/drawio-common-patterns.md` | Complete architecture pattern templates (3-tier, hub-spoke, serverless) |

> **Note:** Icon discovery and component mapping are handled by the MCP `search-shapes` tool.
> Do NOT load large reference files for icon lookups.

### Python References (charts and specialized diagrams)

| File                                         | Content                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `references/python-charts.md`                | Python chart execution, design tokens, output standards                      |
| `references/azure-components.md`             | Complete list of 700+ Azure diagram components                               |
| `references/business-process-flows.md`       | Workflow and swimlane diagram patterns                                       |
| `references/common-patterns.md`              | Ready-to-use Python architecture patterns (3-tier, microservices, hub-spoke) |
| `references/entity-relationship-diagrams.md` | Database ERD patterns                                                        |
| `references/iac-to-diagram.md`               | Generate diagrams from Bicep/Terraform/ARM templates                         |
| `references/integration-services.md`         | Integration service diagram patterns                                         |
| `references/migration-patterns.md`           | Migration architecture patterns                                              |
| `references/preventing-overlaps.md`          | Layout troubleshooting and overlap prevention                                |
| `references/quick-reference.md`              | Copy-paste snippets: connections, attributes, clusters, templates            |
| `references/sequence-auth-flows.md`          | Authentication flow sequence patterns                                        |
| `references/timeline-gantt-diagrams.md`      | Project timeline and Gantt diagrams                                          |
| `references/ui-wireframe-diagrams.md`        | UI mockup and wireframe patterns                                             |
| `references/waf-cost-charts.md`              | WAF pillar bar, cost donut & projection chart implementations                |
