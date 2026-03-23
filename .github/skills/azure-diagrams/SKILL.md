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

- drawio-mcp-server (Deno) configured in `.vscode/mcp.json` (already configured at `mcp/drawio-mcp-server/`)
- Azure icon libraries built: `npm run build:drawio-icons` (pre-built in `assets/drawio-libraries/`)
- For SVG export: use the `hediet.vscode-drawio` VS Code extension (right-click → Export) — `.drawio` files are the primary output
- For Python charts: `pip install diagrams matplotlib pillow && apt-get install -y graphviz`

## Architecture Diagram Contract (Draw.io — Default)

### Required outputs

| Step | Draw.io files                                                                               | Python chart files (if applicable)                                   |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 3    | `03-des-diagram.drawio` + `.drawio.svg`                                                     | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.drawio` + `.drawio.svg`, `04-runtime-diagram.drawio` + `.drawio.svg` | —                                                                    |
| 7    | `07-ab-diagram.drawio` + `.drawio.svg`                                                      | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

### SVG export

After generating `.drawio`, export to SVG for doc embedding:

- **VS Code**: Right-click the `.drawio` file → "Export" → SVG
- **CLI fallback**: `scripts/drawio/drawio-export.sh` (requires draw.io Desktop, not installed by default)

The `.drawio` file is the primary deliverable. SVG export is optional.

Embed in markdown: `![Architecture](03-des-diagram.drawio.svg)`

### Output format

Each `.drawio` file is a standard mxGraphModel XML file that can be:

- Opened directly in VS Code (via `hediet.vscode-drawio` extension) or draw.io web editor
- Version-controlled as XML in git (human-readable diffs)
- Exported to PNG/SVG/PDF with embedded XML (round-trip editing)

### Quality gate (/10)

Readable at 100% zoom · No label overlap or truncation · Minimal line crossing ·
Clear tier grouping · Correct Azure icons · Security boundary visible ·
Data flow direction clear · Identity/auth flow visible ·
Telemetry path visible · Naming conventions followed ·
All labels fully visible (no "..." truncation) · Icons not cramped in containers.
If < 9/10, regenerate with simplification.

## Naming Conventions

- **Cell IDs**: `{resource-type}-{number}` (e.g., `vm-1`, `sql-1`, `kv-1`)
- **Container IDs**: `{scope}-{name}` (e.g., `rg-prod`, `vnet-hub`, `snet-app`)
- **Edge IDs**: `e-{source}-to-{target}` (e.g., `e-appgw-to-app`)
- **Labels**: Use actual resource names from architecture (e.g., `app-vm-prod-01`)

## Azure Design Tokens

| Element         | Color     | Usage                          |
| --------------- | --------- | ------------------------------ |
| Azure Blue      | `#0078D4` | Primary borders, edges, labels |
| RG Background   | `#E8F0FE` | Resource group fill            |
| VNet Background | `#F0F8FF` | Virtual network fill           |
| Subnet fill     | `#FFFFFF` | Subnet containers              |
| Edge stroke     | `#0078D4` | Connection lines               |
| Warning edge    | `#FF8C00` | Advisory/warn flows            |
| Security edge   | `#C00000` | Security-critical flows        |
| Font            | Arial     | All labels                     |
| Icon size       | 48×48     | Standard Azure icon size       |
| DPI             | 150       | Export resolution              |

## Layout Best Practices

### Flow & Grouping

- Use a **left-to-right** (LR) or **top-to-bottom** (TB) flow
- Group related resources in container cells (RG, VNet, subnet)
- Place labels below icons (`verticalLabelPosition=bottom`)
- Use `gridSize=10` alignment for professional positioning
- Include CIDR blocks in VNet/subnet labels

### Icon & Label Sizing (MANDATORY)

- Use `labelWidth=160;overflow=width;html=1;fontSize=9` on **all** icon cells
- Space icons **at least 260px apart** horizontally within the same container
- Keep icon labels to **max 2 lines** — abbreviate resource names if needed
  (e.g., `appi-nff-prod` not `appi-nordic-fresh-foods-prod`)
- Never use `labelWidth` below 160 — values < 160 cause label truncation

### Container Minimum Sizes

| Container | Min Width | Min Height | Notes                                         |
| --------- | --------- | ---------- | --------------------------------------------- |
| Subnet    | 500px     | 170px      | Must fit 2 icons at 260px spacing + padding   |
| VNet      | 600px     | 500px      | Must contain all subnets with 40px margins    |
| RG        | 800px     | 600px      | Must contain VNet + sidebar (KV, monitoring)  |
| Canvas    | 1600px    | 1000px     | Scale up 200px per additional resource column |

### Spacing Rules

- Icons inside containers: min 50px from left edge, min 45px from top edge
- Vertical spacing between stacked icons (outside VNet): min 180px
- Sidebar icons (monitoring, KV): position at `VNet.width + 80px` inside RG
- External boxes (SaaS): position at `RG.x + RG.width + 60px`
- Edge labels must not overlap with source/target resource labels

## Icon Discovery (MCP-Only)

Icons are resolved automatically by the drawio MCP server. Use `search-shapes`
to find the correct shape name for any Azure service. Do NOT manually embed
base64 SVG data — the MCP server handles icon resolution.

```json
{
  "queries": ["App Services", "SQL Database", "Key Vaults", "Virtual Networks"]
}
```

Use the returned `shape_name` values in `add-cells` calls.

## MCP Tool Integration

The drawio-mcp-server provides rich diagram tools. Key tools:

| Category        | Tools                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Shape discovery | `search-shapes`, `get-shape-categories`, `get-shapes-in-category`, `get-style-presets`       |
| Diagram build   | `add-cells` (batch), `edit-cells`, `edit-edges`, `set-cell-shape`, `delete-cell-by-id`       |
| Containers      | `create-groups`, `add-cells-to-group`, `list-group-children`                                 |
| Inspection      | `list-paged-model`, `get-diagram-stats`, `export-diagram`, `import-diagram`, `clear-diagram` |
| Pages/layers    | `create-page`, `list-pages`, `create-layer`, `set-active-layer`                              |
| Finish          | `finish-diagram` (resolves placeholders to full SVG)                                         |

### MCP-First Diagram Workflow

1. `search-shapes` — Find icons for required Azure services
2. `add-cells` (batch, `transactional: true`) — Add all resources with placeholders
3. `create-groups` — Create VNet/subnet/RG containers
4. `add-cells-to-group` — Place resources inside containers
5. `add-cells` (edges) — Add labeled connections with protocol/port
6. `edit-cells` — Adjust positions, styles, labels
7. `finish-diagram` — Resolve all placeholders to full SVG
8. `export-diagram` — Get final XML (writes to content.json when large)
9. Save `.drawio` via **terminal extraction** (see Guardrails > Saving .drawio Files)

### Transactional Mode (50+ shapes)

For complex diagrams, pass `transactional: true` on each tool call to use lightweight
placeholder SVGs (~2-5KB per call instead of 200KB+). Call `finish-diagram` at the
end to resolve all placeholders to production-ready SVG XML.

### Example: add-cells with Azure icons

```json
{
  "cells": [
    {
      "type": "vertex",
      "temp_id": "web",
      "x": 100,
      "y": 100,
      "width": 64,
      "height": 64,
      "text": "Web App",
      "shape_name": "App Services"
    },
    {
      "type": "vertex",
      "temp_id": "sql",
      "x": 300,
      "y": 100,
      "width": 64,
      "height": 64,
      "text": "SQL Database",
      "shape_name": "SQL Database"
    },
    {
      "type": "edge",
      "source_id": "web",
      "target_id": "sql",
      "text": "SQL:1433"
    }
  ]
}
```

## Python Charts (WAF / Cost / Compliance)

For WAF bar charts, cost donuts, and compliance visualizations, use Python `matplotlib`.

### Execution

Save `.py` source in `agent-output/{project}/`, then run to produce `.png`:

```bash
python3 agent-output/{project}/03-des-cost-distribution.py
```

### Professional Output Standards

Critical settings for clean output — use `labelloc="t"` to keep labels inside clusters:

```python
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}
graph_attr = {"bgcolor": "white", "pad": "0.8", "nodesep": "0.9", "ranksep": "0.9",
              "splines": "spline", "fontname": "Arial Bold", "fontsize": "16", "dpi": "150"}
cluster_style = {"margin": "30", "fontname": "Arial Bold", "fontsize": "14"}
```

Requirements: `labelloc='t'` · `Arial Bold` fonts ·
full resource names from IaC · `dpi="150"+` · `margin="30"+` ·
CIDR blocks in VNet/Subnet labels.

See `references/quick-reference.md` for full template, connection syntax, cluster hierarchy, and diagram attributes.

## Azure Service Categories (Python)

13 categories: Compute, Networking, Database, Storage, Integration, Security,
Identity, AI/ML, Analytics, IoT, DevOps, Web, Monitor — all under `diagrams.azure.*`.

See `references/azure-components.md` for the complete list of 700+ components.

## Common Architecture Patterns

- **Draw.io patterns**: See `references/drawio-common-patterns.md` (3-tier, hub-spoke, serverless XML templates)
- **Python patterns**: See `references/common-patterns.md` (3-tier, microservices, serverless, hub-spoke code)
- **IaC to diagram**: See `references/iac-to-diagram.md` to generate diagrams from Bicep/Terraform/ARM

## Workflow Integration

| Step | Draw.io files                           | Python chart files                                                   |
| ---- | --------------------------------------- | -------------------------------------------------------------------- |
| 2    | —                                       | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-diagram.drawio` + `.drawio.svg` | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 7    | `07-ab-diagram.drawio` + `.drawio.svg`  | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid). See `references/waf-cost-charts.md` for full implementations.

**Design tokens:** Background `#F8F9FA` · Azure blue `#0078D4` ·
Min line `#DC3545` · Target line `#28A745` · Trend `#FF8C00` · Grid `#E0E0E0` · DPI 150.

**WAF pillar colours:** Security `#C00000` · Reliability `#107C10` ·
Performance `#FF8C00` · Cost `#FFB900` · Operational Excellence `#8764B8`.

## Generation Workflow

### Architecture Diagrams (Draw.io via MCP — Default)

1. **Gather Context** — Read architecture assessment or Bicep/Terraform templates
2. **Identify Resources & Hierarchy** — List Azure resources, map RG → VNet → Subnet
3. **Search shapes** — Call MCP `search-shapes` with all needed Azure service names in one batch
4. **Build diagram** — Use MCP `add-cells` (transactional mode), `create-groups`, `add-cells-to-group`
5. **Finish** — Call MCP `finish-diagram` to resolve placeholders to full SVG
6. **Export** — Call MCP `export-diagram` with `compress: true`
7. **Save `.drawio` file** — Use terminal command to extract XML from content.json (see below)
8. **Verify quality gate** — Score ≥ 9/10; regenerate if below threshold

### Saving .drawio Files from MCP Results

`export-diagram` returns compressed XML in a content.json file.
**NEVER** use `read_file` on the content.json — the compressed data pollutes LLM context.
Save with a terminal command:

**Bash:**

```bash
cat '<content-json-path>' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['xml'], end='')" > 'agent-output/{project}/{filename}.drawio'
```

### Charts (Python matplotlib)

1. **Gather Context** — Read WAF scores, cost data, or compliance results
2. **Generate Python Code** — Create chart script with matplotlib
3. **Execute & Verify** — Run Python to generate PNG, confirm file exists

## Guardrails

**DO:** Create files in `agent-output/{project}/` with step-prefixed names ·
Generate architecture diagrams as `.drawio` using MCP tools (not raw XML) ·
Use `search-shapes` to find Azure icons · Include CIDR blocks ·
Use `create-groups` for resource hierarchy ·
Apply design tokens to every chart ·
Generate `02-waf-scores.png` when WAF scores are assigned.

**DON'T:** Use Python `diagrams` library for architecture diagrams (use draw.io MCP) ·
Manually write mxCell XML with embedded base64 SVG ·
Read `references/drawio-quick-reference.md` or `references/drawio-component-mapping.md` (use MCP `search-shapes` instead) ·
Create diagrams mismatched to architecture ·
Skip quality gate verification · Overwrite diagrams without consent ·
Output to legacy `docs/diagrams/` · Use placeholder names ·
Use Mermaid for WAF/cost charts ·
Read compressed MCP content.json through the LLM (use terminal extraction).

## Scope Exclusions

Does NOT: generate Bicep/Terraform code · create workload docs ·
deploy resources · create ADRs · perform WAF assessments ·
build dashboards · render Mermaid diagrams.

## Scripts

| Script                               | Purpose                              |
| ------------------------------------ | ------------------------------------ |
| `scripts/generate_diagram.py`        | Interactive pattern generator        |
| `scripts/multi_diagram_generator.py` | Multi-type diagram generator         |
| `scripts/ascii_to_diagram.py`        | Convert ASCII diagrams from markdown |
| `scripts/verify_installation.py`     | Check prerequisites                  |

## Reference Index

### Draw.io References (architecture diagrams)

| File                                   | Content                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `references/drawio-common-patterns.md` | Complete architecture pattern templates (3-tier, hub-spoke, serverless) |

> **Note:** Icon discovery and component mapping are handled by the MCP `search-shapes` tool.
> Do NOT load large reference files for icon lookups.

### Python References (charts and specialized diagrams)

| File                                         | Content                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
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
