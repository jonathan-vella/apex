<!-- digest:auto-generated from SKILL.md — do not edit manually -->

---

name: drawio
description: "Compact reference for Draw.io Azure architecture diagrams. Load at >60% context."
metadata:
tier: digest
version: "1.0"

---

# Draw.io Diagrams — Digest

## Mandatory Icon Embedding

**Every Step 3, 4, 7 diagram MUST embed official Azure icons.**

### Icon Workflow

1. Read `assets/drawio-libraries/azure-icons/reference.md` for icon name → filename
2. Load snippet from `assets/drawio-libraries/azure-icons/icons/{filename}.xml`
3. Copy `mxCell` into diagram, update `id` to be unique, adjust `x`/`y`

### Icon Cell Pattern

```xml
<mxCell id="UNIQUE-ID" value="Service Name"
  style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;
  imageAspect=0;aspect=fixed;image=data:image/svg+xml;base64,..."
  vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="48" height="48" as="geometry"/>
</mxCell>
```

## File Structure Skeleton

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
        <!-- Diagram elements here -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## Critical Rules

1. `<mxCell id="0"/>` and `<mxCell id="1" parent="0"/>` always required
2. Uncompressed XML only — no `compressed="true"`
3. All IDs unique; `vertex="1"` for shapes, `edge="1"` for connectors (exclusive)
4. Style strings: `key=value;` format, booleans `0`/`1`, colors `#RRGGBB`
5. HTML in `value` must be XML-escaped: `&lt;` `&gt;` `&amp;` `&quot;`
6. Coordinates: origin top-left, x→right, y→down, no negative dimensions
7. Children coordinates relative to parent container

## Style Quick Reference

| Property               | Purpose       | Example               |
| ---------------------- | ------------- | --------------------- |
| `fillColor`            | Shape fill    | `#E7F5FF`             |
| `strokeColor`          | Border        | `#0078D4`             |
| `dashed`               | Dashed line   | `1`                   |
| `rounded`              | Round corners | `1`                   |
| `edgeStyle`            | Edge routing  | `orthogonalEdgeStyle` |
| `endArrow`             | Arrow marker  | `classic`             |
| `container`/`swimlane` | Grouping      | `1` / bare token      |
| `startSize`            | Header height | `25`                  |

## Azure Layout

- **Resource groups**: `swimlane;startSize=25;fillColor=#F5F5F5;strokeColor=#666666;dashed=1;`
- **VNets**: `swimlane;startSize=25;fillColor=#E7F5FF;strokeColor=#0078D4;`
- **Subnets**: `swimlane;startSize=20;fillColor=#E6F5E6;strokeColor=#82B366;`
- **Data flow**: `edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#0078D4;endArrow=classic;`
- **Monitoring**: `edgeStyle=orthogonalEdgeStyle;dashed=1;strokeColor=#666666;endArrow=classic;`

## Output Files

| Step | Filename                                                    |
| ---- | ----------------------------------------------------------- |
| 3    | `03-des-diagram.drawio`                                     |
| 4    | `04-dependency-diagram.drawio`, `04-runtime-diagram.drawio` |
| 7    | `07-ab-diagram.drawio`                                      |

All in `agent-output/{project}/`.

## Validation (14-Point)

1. Valid XML 2. `<mxfile>` root 3. Unique diagram IDs 4. Structural cells (id=0, id=1)
2. Unique cell IDs 6. Valid parent refs 7. vertex/edge exclusive 8. Edge source/target valid
3. Geometry present 10. Style format correct 11. Perimeter matches shape 12. HTML escaped
4. No negative dimensions 14. Group coords relative to parent

## MCP Preview

Use `open_drawio_xml` tool to preview diagrams in the draw.io web editor.

## Quality Gate (≥9/10)

Readable at 100% zoom, no label overlap, minimal edge crossing, clear grouping,
correct Azure icons, security boundaries visible, no stray elements, centered labels.
