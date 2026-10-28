<!-- ref:python-charts-v1 -->

# Python Charts & Architecture Design Tokens

Use [`scripts/dlib.py`](../scripts/dlib.py) for architecture, network, DNS,
identity, and swimlane diagrams (`1920×1080` SVG + `3840×2160` 4K PNG), and
Python `matplotlib` via [`scripts/diagram_io.py`](../scripts/diagram_io.py)
for quantitative WAF bar charts, cost donuts, and compliance visualizations.

## Architecture Canvas Tokens (`dlib.py`)

* **Canvas**: `width="3840" height="2160" viewBox="0 0 1920 1080"`, background `#FFFFFF`, font `Segoe UI, Arial, sans-serif`, default footer `"APEX"` at `(960, 1058)`.
* **Palette**:
  * Shared platform (`BL` / `BLF`): `#0078D4` stroke, `#E6F1FB` / `#F5FAFF` fill
  * Workload (`TL` / `TLF`): `#008272` stroke, `#E3F4F1` / `#F2FAF8` fill
  * Legacy / management (`SL` / `GRF`): `#5B6B7B` stroke, `#EEF2F6` fill
  * Migration / notes / policy (`AM` / `AMB` / `AMF`): `#D18B00` / `#F2A900` stroke, `#FFF6DD` fill
  * Identity (`PU` / `PUF`): `#7B3FA0` stroke, `#F3ECF8` fill
  * Text: Navy `#0B1F3A` (`NAVY`) for primary/bold labels, `#3A4A5A` (`GR`) for secondary subtitles.

## Quantitative Chart Execution (`matplotlib`)

Save `.py` source in `agent-output/{project}/`, then run with `python3` to
produce **both `.png` and `.svg` siblings** via the shared
[`scripts/diagram_io.py`](../scripts/diagram_io.py) helper:

```bash
python3 agent-output/{project}/03-des-cost-distribution.py
# → 03-des-cost-distribution.png  +  03-des-cost-distribution.svg
```

Every library-backed `.py` generator must import `save_figure` (matplotlib charts),
`diagram_kwargs` (the `diagrams` library), or `render_graphviz` (graphviz
`Digraph`) from `diagram_io` instead of calling `plt.savefig`,
`Diagram(outformat=...)`, or `dot.render()` directly. See
[`waf-cost-charts.md`](waf-cost-charts.md) for the canonical import preamble.

Standalone SVG wireframes have an optional CairoSVG-to-PNG conversion, not a
`diagram_io` render. See the [output contract](../SKILL.md#execution--output-standards).
This exception does not waive required PNG+SVG workflow chart outputs.

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
