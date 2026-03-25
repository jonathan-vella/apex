<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Routing Guide

- **Architecture diagrams** → Draw.io XML (`.drawio`) — this is the DEFAULT
- **WAF bar charts, cost donuts, cost projections, compliance gaps** → Python matplotlib (`.py` + `.png`)
- **Swimlane / ERD / timeline** → Python graphviz (`.py` + `.png`)

## Prerequisites

- drawio-mcp-server configured in `.vscode/mcp.json` (at `mcp/drawio-mcp-server/`)
- Azure icon libraries: `npm run build:drawio-icons` (pre-built in `assets/drawio-libraries/`)
- For Python charts: `pip install diagrams matplotlib pillow && apt-get install -y graphviz`

## Architecture Diagram Contract (Draw.io — Default)

### Required outputs

| Step | Draw.io files                                               | Python chart files (if applicable)                                   |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 3    | `03-des-diagram.drawio`                                     | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 4    | `04-dependency-diagram.drawio`, `04-runtime-diagram.drawio` | —                                                                    |

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Python Charts (WAF / Cost / Compliance)

WAF/cost charts use Python `matplotlib` (never Mermaid).
See `references/python-charts.md` for execution, design tokens, and output standards.
See `references/waf-cost-charts.md` for full chart implementations.

## Common Architecture Patterns

See `references/drawio-common-patterns.md` (draw.io), `references/common-patterns.md` (Python),
`references/iac-to-diagram.md` (Bicep/Terraform to diagram).

## Workflow Integration

| Step | Draw.io files           | Python chart files                                                   |
| ---- | ----------------------- | -------------------------------------------------------------------- |
| 2    | —                       | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-diagram.drawio` | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 7    | `07-ab-diagram.drawio`  | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

> _See SKILL.md for full content._

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid).
See `references/waf-cost-charts.md` for implementations
and `references/python-charts.md` for design tokens.
