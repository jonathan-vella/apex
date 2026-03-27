<!-- ref:python-charts-v1 -->

# Python Charts (WAF / Cost / Compliance)

For WAF bar charts, cost donuts, and compliance visualizations, use Python `matplotlib`.

## Execution

Save `.py` source in `agent-output/{project}/`, then run to produce `.png`:

```bash
python3 agent-output/{project}/03-des-cost-distribution.py
```

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

See `quick-reference.md` for full template, connection syntax, cluster hierarchy, and diagram attributes.

## Azure Service Categories (Python)

13 categories: Compute, Networking, Database, Storage, Integration, Security,
Identity, AI/ML, Analytics, IoT, DevOps, Web, Monitor — all under `diagrams.azure.*`.

See `azure-components.md` for the complete list of 700+ components.

## Design Tokens

**Design tokens:** Background `#F8F9FA` · Azure blue `#0078D4` ·
Min line `#DC3545` · Target line `#28A745` · Trend `#FF8C00` · Grid `#E0E0E0` · DPI 150.

**WAF pillar colours:** Security `#C00000` · Reliability `#107C10` ·
Performance `#FF8C00` · Cost `#FFB900` · Operational Excellence `#8764B8`.

## Swimlane / ERD / Timeline

For specialized Python diagrams (not architecture):

- **Swimlane / business process** → See `business-process-flows.md`
- **Entity-relationship diagrams** → See `entity-relationship-diagrams.md`
- **Timeline / Gantt** → See `timeline-gantt-diagrams.md`
- **UI wireframes** → See `ui-wireframe-diagrams.md`
