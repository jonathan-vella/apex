<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Architecture Diagrams Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Prerequisites

```bash
pip install diagrams matplotlib pillow && apt-get install -y graphviz
```

## Execution Method

Save `.py` source in `agent-output/{project}/`, then run to produce `.png`. Never use heredoc execution.

```bash
python3 agent-output/{project}/03-des-diagram.py
```

## Architecture Diagram Contract

### Required outputs

| Step | Files                                                         |
| ---- | ------------------------------------------------------------- |
| 3    | `03-des-diagram.py/.png`                                      |
| 4    | `04-dependency-diagram.py/.png`, `04-runtime-diagram.py/.png` |

> _See SKILL.md for full content._

## Professional Output Standards

Critical settings for clean output — use `labelloc="t"` to keep labels inside clusters:

```python
node_attr = {"fontname": "Arial Bold", "fontsize": "11", "labelloc": "t"}
graph_attr = {"bgcolor": "white", "pad": "0.8", "nodesep": "0.9", "ranksep": "0.9",
              "splines": "spline", "fontname": "Arial Bold", "fontsize": "16", "dpi": "150"}

> _See SKILL.md for full content._

## Azure Service Categories

13 categories: Compute, Networking, Database, Storage, Integration, Security,
Identity, AI/ML, Analytics, IoT, DevOps, Web, Monitor — all under `diagrams.azure.*`.

See `references/azure-components.md` for the complete list of **700+ components**.

## Common Architecture Patterns

Ready-to-use patterns: 3-Tier Web App, Microservices (AKS),
Serverless/Event-Driven, Data Platform, Hub-Spoke Networking, and more.

See `references/common-patterns.md` for all patterns with code.
See `references/iac-to-diagram.md` to generate diagrams from Bicep/Terraform/ARM.

## Workflow Integration

| Step | Files                                                                | Description                               |
| ---- | -------------------------------------------------------------------- | ----------------------------------------- |
| 2    | `02-waf-scores.py/.png`                                              | WAF pillar score bar chart                |
| 3    | `03-des-diagram.py/.png`                                             | Proposed architecture                     |
| 3    | `03-des-cost-distribution.py/.png`, `03-des-cost-projection.py/.png` | Cost donut + projection                   |
| 7    | `07-ab-diagram.py/.png`                                              | Deployed architecture                     |

> _See SKILL.md for full content._

## Data Visualization Charts

WAF and cost charts use `matplotlib` (never Mermaid). See `references/waf-cost-charts.md` for full implementations.

**Design tokens:** Background `#F8F9FA` · Azure blue `#0078D4` ·
Min line `#DC3545` · Target line `#28A745` · Trend `#FF8C00` · Grid `#E0E0E0` · DPI 150.

**WAF pillar colours:** Security `#C00000` · Reliability `#107C10` ·

> _See SKILL.md for full content._

## Generation Workflow

1. **Gather Context** — Read Bicep/Terraform templates or architecture assessment
2. **Identify Resources & Hierarchy** — List Azure resources, map Subscription → RG → VNet → Subnet
3. **Generate Python Code** — Create diagram with proper clusters and edges
4. **Execute & Verify** — Run Python to generate PNG, confirm file exists

## Guardrails

**DO:** Create files in `agent-output/{project}/` with step-prefixed names ·
Use valid `diagrams.azure.*` imports · Include docstring with prerequisites ·
Use `Cluster()` for Azure hierarchy · Include CIDR blocks ·
Always execute script and verify PNG · Apply design tokens to every chart ·
Generate `02-waf-scores.png` when WAF scores are assigned.

> _See SKILL.md for full content._
