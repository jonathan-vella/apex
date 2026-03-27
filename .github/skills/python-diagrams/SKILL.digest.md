<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Python Diagrams & Charts (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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

> _See SKILL.md for full content._

## Required Outputs (Workflow Integration)

| Step | Python chart files                                                   |
| ---- | -------------------------------------------------------------------- |
| 2    | `02-waf-scores.py/.png`                                              |
| 3    | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` |
| 7    | `07-ab-cost-*.py/.png`, `07-ab-compliance-gaps.py/.png`              |

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Architecture Diagram Conventions (diagrams library)

Follow this pattern for architecture diagram generation:

```python
"""Brief description of what the diagram shows."""

from diagrams import Cluster, Diagram

> _See SKILL.md for full content._

## Professional Output Standards

Critical settings for clean output — use `labelloc="t"` to keep labels inside clusters:

```python
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}
graph_attr = {"bgcolor": "white", "pad": "0.8", "nodesep": "0.9", "ranksep": "0.9",
              "splines": "spline", "fontname": "Arial Bold", "fontsize": "16", "dpi": "150"}

> _See SKILL.md for full content._
