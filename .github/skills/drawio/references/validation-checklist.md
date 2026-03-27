<!-- ref:validation-checklist-v1 -->

# Draw.io Validation Checklist

Detailed validation rules for AI-generated `.drawio` files.
Based on the [official checklist](https://www.drawio.com/doc/faq/drawio-style-reference#15-validation-checklist-for-ai-generated-files)
and the [mxfile.xsd schema](https://www.drawio.com/assets/mxfile.xsd).

## 1. Valid XML

File must be well-formed XML with proper escaping.
Common AI mistakes: unescaped `<` in labels, unclosed tags, invalid UTF-8.

## 2. Root Element

`<mxfile>` as root element, containing at least one `<diagram>` child.
The `<mxfile>` may optionally have `host`, `modified`, `agent`, `version` attributes.

## 3. Diagram IDs

Each `<diagram>` must have a unique `id` attribute.
The `name` attribute is the page tab label (defaults to "Page-N").

## 4. Structural Cells

Root must contain exactly these two cells first:

```xml
<mxCell id="0"/>              <!-- Root container, NO parent -->
<mxCell id="1" parent="0"/>   <!-- Default layer -->
```

`id="0"` must NOT have a `parent` attribute.
`id="1"` must have `parent="0"`.

## 5. Unique IDs

All cell IDs (including UserObject/object IDs) must be unique
within the same `<diagram>`. Any string is valid (e.g., "2", "node-1", "abc123").

## 6. Parent References

Every cell (except `id="0"`) must have a `parent` attribute
referencing an existing cell ID. Common hierarchy:

- Layers: `parent="0"`
- Shapes/edges on default layer: `parent="1"`
- Children in groups: `parent="<group-id>"`

## 7. Type Flags

Each content cell must have exactly one of:

- `vertex="1"` — the cell is a shape/node
- `edge="1"` — the cell is a connector/edge

These are mutually exclusive. The structural cells (id=0, id=1 and layers)
have neither.

## 8. Edge References

Edge cells should have `source` and `target` attributes referencing
existing vertex IDs. Unconnected edges need explicit `mxPoint` elements:

```xml
<mxGeometry relative="1" as="geometry">
  <mxPoint x="100" y="200" as="sourcePoint"/>
  <mxPoint x="300" y="100" as="targetPoint"/>
</mxGeometry>
```

## 9. Geometry

- **Vertices**: Must have `<mxGeometry>` with `x`, `y`, `width`, `height`
  and `as="geometry"`
- **Edges**: Must have `<mxGeometry relative="1" as="geometry"/>`
- Edge labels: Use `x` (along edge, -1 to 1) and `y` (perpendicular offset)

## 10. Style Format

Style strings must follow `key=value;` format:

- Keys and values are case-sensitive
- No spaces around `=` or `;`
- Boolean values: `0` and `1` (not true/false)
- Colors: `#RRGGBB` (with `#`), `none`, or `default`
- Bare tokens (without `=`) set shape or class: `ellipse;whiteSpace=wrap;`

## 11. Perimeter Match

Non-rectangular shapes MUST set matching perimeter:

| Shape           | Required Perimeter       |
| --------------- | ------------------------ |
| `ellipse`       | `ellipsePerimeter`       |
| `rhombus`       | `rhombusPerimeter`       |
| `triangle`      | `trianglePerimeter`      |
| `hexagon`       | `hexagonPerimeter2`      |
| `parallelogram` | `parallelogramPerimeter` |
| `trapezoid`     | `trapezoidPerimeter`     |

Without correct perimeter, edges connect to the bounding box instead
of the visible shape border.

## 12. HTML Escaping

HTML content in `value` attributes must be XML-escaped:

| Character | Escape   |
| --------- | -------- |
| `<`       | `&lt;`   |
| `>`       | `&gt;`   |
| `&`       | `&amp;`  |
| `"`       | `&quot;` |

## 13. Coordinate System

- Origin (0,0) is top-left
- x increases rightward
- y increases downward
- Width and height must be positive (no negative dimensions)

## 14. Group Hierarchy

Children of groups/containers have coordinates **relative to the parent**,
not the canvas. A child at `x="10" y="10"` inside a group at `x="100" y="100"`
appears at canvas position (110, 110).

## Azure Architecture-Specific Checks

For files matching `03-des-|04-dependency-|04-runtime-|07-ab-`:

- **Must contain image cells**: At least one `shape=image` cell with Azure icon
- **No remote image URLs**: Icons should use `data:image/svg+xml;base64,...`
  data URIs or `img/lib/azure2/` draw.io built-in paths (not external URLs)
- **Labels present**: Every Azure service icon should have a meaningful `value`
