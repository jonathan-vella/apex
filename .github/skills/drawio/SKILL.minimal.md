<!-- digest:auto-generated from SKILL.md — do not edit manually -->

---

name: drawio
description: "Minimal Draw.io reference. Load at >80% context."
metadata:
tier: minimal
version: "1.0"

---

# Draw.io — Minimal

## Icon Reference

`assets/drawio-libraries/azure-icons/reference.md` → icon name → `icons/{name}.xml`

## Output Files

- `03-des-diagram.drawio`, `04-dependency-diagram.drawio`
- `04-runtime-diagram.drawio`, `07-ab-diagram.drawio`
- All in `agent-output/{project}/`

## 5 Critical Rules

1. Always include `<mxCell id="0"/>` and `<mxCell id="1" parent="0"/>`
2. Use `vertex="1"` for shapes, `edge="1"` for edges (exclusive)
3. All cell IDs unique; style = `key=value;` semicolon-separated
4. Azure architecture diagrams (Steps 3/4/7) MUST embed official icons
5. Use `open_drawio_xml` MCP tool to preview

## Azure Icon Cell

```xml
<mxCell id="ID" value="Label"
  style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;
  imageAspect=0;aspect=fixed;image=data:image/svg+xml;base64,..."
  vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="48" height="48" as="geometry"/>
</mxCell>
```
