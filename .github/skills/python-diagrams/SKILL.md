---
name: python-diagrams
description: "**UTILITY SKILL** — Python diagram generation: WAF/cost/compliance charts (matplotlib), architecture diagrams (diagrams lib), ERDs, swimlanes, timelines, wireframes (graphviz). WHEN: 'WAF bar chart', 'cost donut chart', 'compliance gap chart', 'Python architecture diagram', 'ERD diagram', 'swimlane', 'UI wireframe'. DO NOT USE FOR: Draw.io architecture diagrams (drawio), inline Mermaid (mermaid)."
compatibility: Works with VS Code Copilot, Claude Code, and any tool capable of running Python scripts.
license: MIT
metadata:
  author: apex
  version: "1.0"
---

# Python Diagrams & Charts

Skill for generating diagrams and charts using Python libraries: `matplotlib`
for WAF/cost/compliance visualizations, `diagrams` for architecture diagrams,
and `graphviz` for ERDs, swimlanes, timelines, and wireframes.

## Prerequisites

```bash
pip install diagrams matplotlib pillow && apt-get install -y graphviz
```

## Routing Guide

Every Python diagram emits **both PNG and SVG** siblings via the shared
[`scripts/diagram_io.py`](scripts/diagram_io.py) helper — PNG for raster
preview, SVG for scalable / accessible / diff-friendly review.

| Diagram type                        | Library    | Output                |
| ----------------------------------- | ---------- | --------------------- |
| WAF bar charts                      | matplotlib | `.py` + `.png` + `.svg` |
| Cost donut / projection charts      | matplotlib | `.py` + `.png` + `.svg` |
| Compliance gap charts               | matplotlib | `.py` + `.png` + `.svg` |
| Architecture diagrams (non-Draw.io) | diagrams   | `.py` + `.png` + `.svg` |
| Swimlane / business process         | graphviz   | `.py` + `.png` + `.svg` |
| Entity-relationship diagrams        | graphviz   | `.py` + `.png` + `.svg` |
| Timeline / Gantt charts             | matplotlib | `.py` + `.png` + `.svg` |
| UI wireframes                       | graphviz   | `.py` + `.png` + `.svg` |

## Required Outputs (Workflow Integration)

| Step | Python chart files                                                                  |
| ---- | ----------------------------------------------------------------------------------- |
| 2    | `02-waf-scores.py/.png/.svg`                                                        |
| 3    | `03-des-cost-distribution.py/.png/.svg`, `03-des-cost-projection.py/.png/.svg`      |
| 4    | `04-dependency-diagram.py/.png/.svg`, `04-runtime-diagram.py/.png/.svg`             |
| 7    | `07-ab-cost-*.py/.png/.svg`, `07-ab-compliance-gaps.py/.png/.svg`                   |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Execution & Output Standards

Save `.py` source in `agent-output/{project}/`, then run with `python3` to
produce the `.png` + `.svg` sibling pair. Every generator must import the
shared helpers from [`scripts/diagram_io.py`](scripts/diagram_io.py)
(`save_figure`, `diagram_kwargs`, `render_graphviz`) — never call
`plt.savefig`, `Diagram(outformat=...)`, or `dot.render()` directly.

For the full conventions — design tokens (Azure blue, WAF pillar colours,
DPI 150), `graph_attr` / `node_attr` / `cluster_style` settings,
`labelloc='t'`, Arial Bold fonts, CIDR labels — read
[`references/python-charts.md`](references/python-charts.md).

For ready-to-use architecture diagram patterns (3-tier web app, hub-spoke, etc.)
including the canonical `with Diagram(... show=False, direction="TB") as d:`
template, read [`references/common-patterns.md`](references/common-patterns.md).

## Rules

**DO:** Import `save_figure` / `diagram_kwargs` / `render_graphviz` from
[`scripts/diagram_io.py`](scripts/diagram_io.py) so every chart emits both
`.png` and `.svg` siblings · Set `show=False` · Use `direction="TB"` ·
Group in `Cluster` blocks · Set explicit `filename` · Use DPI ≥150 ·
Apply design tokens consistently · Generate WAF scores PNG+SVG when WAF
scores are assigned.

**DON'T:** Call `plt.savefig(...)`, `Diagram(..., outformat=...)`, or
`dot.render(...)` directly — always go through `diagram_io` · Use Mermaid
for charts (use matplotlib) · Use Python `diagrams` for primary architecture
diagrams (use Draw.io skill) · Let `show=True` open a viewer · Omit
`filename` (produces non-deterministic output names) · Use grouped
list-to-list edge operators (`[a, b] >> [c, d]`) — use explicit node-to-node
edges instead (the `diagrams` library may reject grouped expressions with a
`TypeError`) · Use emoji or Unicode glyphs in chart labels — keep labels
ASCII-safe for portability across container fonts.

## Scope Exclusions

Does NOT: generate Draw.io architecture diagrams · produce Mermaid diagrams ·
generate Bicep/Terraform · create ADRs · deploy resources.

## Scripts

`scripts/diagram_io.py` (shared PNG+SVG output helper — import this from every generator) ·
`scripts/generate_diagram.py` (interactive diagram generation) ·
`scripts/multi_diagram_generator.py` (multi-type: process, ERD, timeline, wireframe) ·
`scripts/ascii_to_diagram.py` (ASCII art → diagram conversion) ·
`scripts/verify_installation.py` (prerequisites check)

## Reference Index

| File                                         | Content                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `references/python-charts.md`                | Chart execution, design tokens, output standards                    |
| `references/waf-cost-charts.md`              | WAF pillar bar, cost donut & projection chart implementations       |
| `references/azure-components.md`             | Complete list of 700+ Azure diagram components                      |
| `references/common-patterns.md`              | Ready-to-use Python architecture patterns (3-tier, hub-spoke, etc.) |
| `references/business-process-flows.md`       | Workflow and swimlane diagram patterns                              |
| `references/entity-relationship-diagrams.md` | Database ERD patterns                                               |
| `references/integration-services.md`         | Integration service diagram patterns                                |
| `references/migration-patterns.md`           | Migration architecture patterns                                     |
| `references/sequence-auth-flows.md`          | Authentication flow sequence patterns                               |
| `references/timeline-gantt-diagrams.md`      | Project timeline and Gantt diagrams                                 |
| `references/ui-wireframe-diagrams.md`        | UI mockup and wireframe patterns                                    |
| `references/iac-to-diagram.md`               | Generate diagrams from Bicep/Terraform/ARM templates                |
