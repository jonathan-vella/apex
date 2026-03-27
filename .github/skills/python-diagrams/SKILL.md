---
name: python-diagrams
description: "Python diagram generation: WAF/cost/compliance charts (matplotlib), architecture diagrams (diagrams library), ERDs, swimlanes, timelines, wireframes (graphviz). USE FOR: WAF bar charts, cost donut/projection charts, compliance gap charts, Python architecture diagrams, ERD diagrams, business process flows, timeline/Gantt charts, UI wireframes. DO NOT USE FOR: Draw.io architecture diagrams (use drawio), inline Mermaid (use mermaid), Excalidraw whiteboarding (use excalidraw)."
compatibility: Works with VS Code Copilot, Claude Code, and any tool capable of running Python scripts.
license: MIT
metadata:
  author: azure-agentic-infraops
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

| Diagram type                           | Library    | Output         |
| -------------------------------------- | ---------- | -------------- |
| WAF bar charts                         | matplotlib | `.py` + `.png` |
| Cost donut / projection charts         | matplotlib | `.py` + `.png` |
| Compliance gap charts                  | matplotlib | `.py` + `.png` |
| Architecture diagrams (non-Draw.io)    | diagrams   | `.py` + `.png` |
| Swimlane / business process            | graphviz   | `.py` + `.png` |
| Entity-relationship diagrams           | graphviz   | `.py` + `.png` |
| Timeline / Gantt charts                | matplotlib | `.py` + `.png` |
| UI wireframes                          | graphviz   | `.py` + `.png` |

## Required Outputs (Workflow Integration)

| Step | Python chart files                                                   |
| ---- | -------------------------------------------------------------------- |
| 2    | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 7    | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

Suffix rules: `-des` for design (Step 3), `-ab` for as-built (Step 7).

## Execution

Save `.py` source in `agent-output/{project}/`, then run to produce `.png`:

```bash
python3 agent-output/{project}/03-des-cost-distribution.py
```

## Chart Design Tokens

**Background & grid:** Background `#F8F9FA` · Grid `#E0E0E0` · DPI 150.

**Azure colors:** Azure blue `#0078D4` · Min line `#DC3545` ·
Target line `#28A745` · Trend `#FF8C00`.

**WAF pillar colors:** Security `#C00000` · Reliability `#107C10` ·
Performance `#FF8C00` · Cost `#FFB900` · Operational Excellence `#8764B8`.

## Architecture Diagram Conventions (diagrams library)

Follow this pattern for architecture diagram generation:

```python
"""Brief description of what the diagram shows."""

from diagrams import Cluster, Diagram
from diagrams.azure.compute import AppServices
from diagrams.azure.network import FrontDoors

with Diagram("Diagram Title", show=False, filename="output-name", direction="TB"):
    with Cluster("Resource Group"):
        # Resources...
        pass
```

- Always set `show=False` to prevent auto-opening
- Use `direction="TB"` (top-to-bottom) for consistency
- Group resources in `Cluster` blocks matching Azure resource groups
- Set explicit `filename` parameter to control output location

## Professional Output Standards

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

## Guardrails

**DO:** Set `show=False` · Use `direction="TB"` · Group in `Cluster` blocks ·
Set explicit `filename` · Use DPI ≥150 · Apply design tokens consistently ·
Generate WAF scores PNG when WAF scores are assigned.

**DON'T:** Use Mermaid for charts (use matplotlib) · Use Python `diagrams` for
primary architecture diagrams (use Draw.io skill) · Let `show=True` open
a viewer · Omit `filename` (produces non-deterministic output names).

## Scope Exclusions

Does NOT: generate Draw.io architecture diagrams · produce Mermaid diagrams ·
generate Bicep/Terraform · create ADRs · deploy resources.

## Scripts

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
