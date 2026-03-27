---
name: drawio
description: "Draw.io architecture diagrams for Azure with local icon libraries, XSD validation, and MCP integration. USE FOR: architecture diagrams, dependency diagrams, runtime flow diagrams, as-built diagrams, Draw.io XML generation. DO NOT USE FOR: WAF/cost charts (use python-diagrams), inline Mermaid (use mermaid), Excalidraw diagrams (use excalidraw)."
compatibility: Works with VS Code Copilot, Claude Code, and any MCP-compatible tool. Uses Draw.io MCP Tool Server configured in .vscode/mcp.json.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "1.0"
---

# Draw.io Architecture Diagrams

Generate Azure architecture diagrams in `.drawio` (mxfile XML) format with
embedded Azure icons, XSD-validated structure, and MCP preview integration.

## Prerequisites

- **Draw.io MCP Tool Server**: `@drawio/mcp` configured in `.vscode/mcp.json`
- **Azure icon libraries**: `assets/drawio-libraries/azure-icons/` (local, offline)
- **VS Code extension** (optional): `hediet.vscode-drawio` for in-editor preview
- **Icon reference**: `assets/drawio-libraries/azure-icons/reference.md`

## File Structure — Critical Rules

A valid `.drawio` file is XML with this hierarchy:

```xml
<mxfile>
  <diagram id="page-1" name="Page-1">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1"
                  tooltips="1" connect="1" arrows="1" fold="1"
                  page="1" pageScale="1" pageWidth="850" pageHeight="1100"
                  math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- All diagram elements go here with parent="1" -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### Mandatory Rules

1. **Structural cells**: `<mxCell id="0"/>` (root) and `<mxCell id="1" parent="0"/>` (default layer) are always required
2. **Uncompressed XML**: Never use `compressed="true"` — AI must generate plain XML
3. **Unique IDs**: All cell IDs must be unique within the diagram
4. **vertex/edge exclusive**: Shapes use `vertex="1"`, connectors use `edge="1"` — never both
5. **Parent references**: Every cell (except id="0") must have a valid `parent`
6. **Coordinates**: Origin (0,0) is top-left; x increases right, y increases down
7. **Style strings**: Semicolon-separated `key=value;` pairs, case-sensitive, booleans are `0`/`1`
8. **HTML escaping**: HTML in `value` attributes must use `&lt;`, `&gt;`, `&amp;`, `&quot;`

## Style String Format

```text
key1=value1;key2=value2;key3=value3;
```

- Shape names can appear as bare tokens: `ellipse;whiteSpace=wrap;html=1;`
- Colors use `#RRGGBB` hex, `none`, or `default`
- No spaces around `=` or `;`
- Trailing `;` is conventional

### Essential Style Properties

| Property        | Values                             | Purpose                                   |
| --------------- | ---------------------------------- | ----------------------------------------- |
| `fillColor`     | `#RRGGBB`, `none`                  | Shape fill                                |
| `strokeColor`   | `#RRGGBB`, `none`                  | Border color                              |
| `strokeWidth`   | number                             | Border width (px)                         |
| `dashed`        | `0`, `1`                           | Dashed stroke                             |
| `rounded`       | `0`, `1`                           | Round corners                             |
| `html`          | `0`, `1`                           | Enable HTML labels                        |
| `whiteSpace`    | `wrap`                             | Text wrapping                             |
| `fontSize`      | number                             | Font size (px)                            |
| `fontStyle`     | bitmask                            | 0=normal, 1=bold, 2=italic, 3=bold+italic |
| `align`         | `left`, `center`, `right`          | Horizontal text align                     |
| `verticalAlign` | `top`, `middle`, `bottom`          | Vertical text align                       |
| `shape`         | see Shape Types                    | Shape type                                |
| `edgeStyle`     | `orthogonalEdgeStyle`, etc.        | Edge routing                              |
| `endArrow`      | `classic`, `block`, `open`, `none` | Arrow marker                              |
| `container`     | `0`, `1`                           | Cell is a container                       |
| `startSize`     | number                             | Swimlane header height                    |
| `image`         | URL or data URI                    | Image source                              |

## Azure Icon Embedding — MANDATORY

**Every Step 3, 4, and 7 architecture diagram MUST embed official Azure icons.**

### Icon Discovery Protocol

1. Read `assets/drawio-libraries/azure-icons/reference.md` for icon name → filename
2. Load the icon snippet from `assets/drawio-libraries/azure-icons/icons/{filename}.xml`
3. Extract the `mxCell` element and embed in target diagram
4. Adjust `x`, `y` coordinates and update the cell `id` to be unique

### Icon Cell Pattern

```xml
<mxCell id="vm-1" value="Virtual Machine"
  style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;
  imageAspect=0;aspect=fixed;image=data:image/svg+xml;base64,PHN2Zy..."
  vertex="1" parent="1">
  <mxGeometry x="200" y="100" width="48" height="48" as="geometry"/>
</mxCell>
```

- Default icon size: 48×48 (use 64×64 for primary/hero resources)
- Label position: below the icon (`verticalLabelPosition=bottom`)
- No fill/stroke on icon cells — the SVG provides the visual

### Icon Catalog

Full catalog: `assets/drawio-libraries/azure-icons/reference.md`

If icon library files have not been generated yet (the `icons/` directory
is empty), run `python scripts/convert-azure-icons-to-drawio.py <path-to-zip>`
first. As a fallback, use draw.io built-in Azure stencils:
`shape=mxgraph.azure.<category>.<icon_name>` (e.g., `shape=mxgraph.azure.storage_blob`).

## Azure Layout Conventions

### Resource Groups as Swimlanes

```xml
<mxCell id="rg-1" value="rg-project-prod"
  style="swimlane;startSize=25;fillColor=#F5F5F5;strokeColor=#666666;
  fontStyle=1;html=1;rounded=1;dashed=1;"
  vertex="1" parent="1">
  <mxGeometry x="50" y="50" width="600" height="400" as="geometry"/>
</mxCell>
<!-- Children use parent="rg-1" with coordinates relative to the group -->
```

### Virtual Networks as Nested Containers

```xml
<mxCell id="vnet-1" value="vnet-project-prod (10.0.0.0/16)"
  style="swimlane;startSize=25;fillColor=#E7F5FF;strokeColor=#0078D4;
  fontStyle=1;html=1;rounded=1;"
  vertex="1" parent="rg-1">
  <mxGeometry x="20" y="40" width="560" height="340" as="geometry"/>
</mxCell>
```

### Subnets as Inner Groups

```xml
<mxCell id="snet-app" value="snet-app (10.0.1.0/24)"
  style="swimlane;startSize=20;fillColor=#E6F5E6;strokeColor=#82B366;
  html=1;rounded=1;fontSize=11;"
  vertex="1" parent="vnet-1">
  <mxGeometry x="10" y="35" width="260" height="150" as="geometry"/>
</mxCell>
```

### Edge Conventions

| Flow type                | Style                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Data flow (primary)      | `edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#0078D4;endArrow=classic;html=1;`                    |
| Monitoring / diagnostics | `edgeStyle=orthogonalEdgeStyle;rounded=1;dashed=1;strokeColor=#666666;endArrow=classic;html=1;`           |
| Authentication           | `edgeStyle=orthogonalEdgeStyle;rounded=1;dashed=1;strokeColor=#0078D4;endArrow=classic;html=1;`           |
| Bidirectional            | `edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#0078D4;startArrow=classic;endArrow=classic;html=1;` |

### Color Palette (Azure-Aligned)

| Color              | Hex       | Use                               |
| ------------------ | --------- | --------------------------------- |
| Azure Blue         | `#0078D4` | Primary strokes, data flow edges  |
| VNet fill          | `#E7F5FF` | Virtual network backgrounds       |
| Subnet fill (app)  | `#E6F5E6` | Application tier subnets          |
| Subnet fill (data) | `#FFF2CC` | Data tier subnets                 |
| Security zone      | `#F8CECC` | Security boundaries, WAF zones    |
| Light gray         | `#F5F5F5` | Resource group backgrounds        |
| Monitoring         | `#E1D5E7` | Monitoring/governance containers  |
| Dark gray          | `#666666` | Secondary strokes, dashed borders |

## Output File Conventions

| Step | Filename                       | Content                        |
| ---- | ------------------------------ | ------------------------------ |
| 3    | `03-des-diagram.drawio`        | Conceptual architecture        |
| 4    | `04-dependency-diagram.drawio` | Resource dependency graph      |
| 4    | `04-runtime-diagram.drawio`    | Runtime data flow              |
| 7    | `07-ab-diagram.drawio`         | As-built deployed architecture |

All outputs go to `agent-output/{project}/`.

## Validation Checklist

Before delivering any `.drawio` file, verify:

1. **Valid XML**: Well-formed with proper escaping
2. **Root element**: `<mxfile>` contains ≥1 `<diagram>`
3. **Diagram IDs**: Each `<diagram>` has a unique `id`
4. **Structural cells**: `<mxCell id="0"/>` and `<mxCell id="1" parent="0"/>` present
5. **Unique IDs**: All cell IDs unique within the diagram
6. **Parent refs**: Every cell has a valid `parent` referencing an existing cell
7. **Type flags**: Each content cell has `vertex="1"` OR `edge="1"` (not both)
8. **Edge refs**: Edge `source`/`target` reference existing vertex IDs
9. **Geometry**: Vertices have `mxGeometry` with x, y, width, height; edges have `relative="1"`
10. **Style format**: Style strings use valid `key=value;` format
11. **Perimeter match**: Non-rectangular shapes have matching `perimeter=` value
12. **HTML escaping**: HTML in `value` attributes properly XML-escaped
13. **Coordinates**: No negative dimensions; x right, y down
14. **Group hierarchy**: Children coordinates relative to parent container

## MCP Integration

Use the Draw.io MCP Tool Server to preview generated diagrams:

```text
Use open_drawio_xml to preview the diagram in the browser.
```

The MCP server compresses the XML and opens it in draw.io's web editor
for interactive viewing and editing.

## Quality Gate

A diagram passes quality review when it scores ≥9/10 on:

1. Readable at 100% zoom — all labels visible without zooming
2. No label overlap — text does not obscure other elements
3. Minimal edge crossing — edges routed to minimize intersections
4. Clear tier grouping — resources grouped by function/subnet/RG
5. Correct Azure icons — every Azure service has its official icon embedded
6. Security boundaries visible — WAF, NSG, Private Endpoint zones shown
7. No stray elements — no floating unconnected shapes
8. Service labels centered — text centered below/inside icons
9. Footer unobtrusive — metadata/legend does not dominate
10. Dense canvas usage — no excessive whitespace, compact layout

## Reference Materials

For detailed style properties: Read `.github/skills/drawio/references/style-reference.md`
For Azure-specific patterns: Read `.github/skills/drawio/references/azure-patterns.md`
For full validation details: Read `.github/skills/drawio/references/validation-checklist.md`
