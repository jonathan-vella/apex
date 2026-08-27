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

## Visual-Quality Rubric (10 points)

Status: **advisory in 0.11.x**, **blocking in 0.12.0** (see `CHANGELOG.md`).
Award 1 point per item; ship with ≥ 8/10 or record an exemption in the ADR
that owns the diagram. Automated checks live in
[`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs);
remaining items are reviewer-judged during challenger passes.

| #   | Rubric item                                                                                       | Automated? | Rationale                                           |
| --- | ------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| 1   | **Title present** — top-of-page text 14–16pt bold, page tab matches                               | partial    | Orients readers in <5s; challenger checks match     |
| 2   | **Footer present** — bottom-of-page 9pt with owner + revision date                                | partial    | Establishes provenance and freshness                |
| 3   | **Legend present** — maps colors/shapes to concepts used on the page                              | manual     | Disambiguates custom palettes and container types   |
| 4   | **Grouped by concern** — compute/data/security/networking containers                              | yes        | Reduces cognitive load; aids incremental reading    |
| 5   | **Consistent spacing** — 40px intra-group, 80px cross-group, 120px cross-tier                     | yes        | Eliminates crowded layouts; forces cleaner routing  |
| 6   | **Palette aligned** — compute `#E7F5FF`, data `#FFF2CC`, security `#FFE6E6`, networking `#E6F5E6` | yes        | Visual grammar consistency across project artefacts |
| 7   | **Labels on every edge** — protocol/port or relationship verb                                     | yes        | Prevents ambiguous connections                      |
| 8   | **Icons from canonical set** — names in `assets/drawio-libraries/azure-icons/reference.md`        | yes        | Stops drift from vendor library                     |
| 9   | **No anchor drift** — connectors use `exitX/entryX` where shown in style reference                | yes        | Prevents lines slipping to centroid on re-open      |
| 10  | **Cross-cutting container** — governance/identity/observability shown if in scope                 | manual     | Forces explicit security & ops coverage             |

Validator behaviour: items flagged `automated: yes` are enforced; `partial` raises
warnings only; `manual` items are surfaced in `drawio` skill checklists for
reviewers (04-Design, 02-Architect challenger pass).

## Check 15: Sibling Icon Overlap (T-006)

For architecture deliverables, the validator checks for sibling icon (image)
cells whose **rendered label boxes** overlap. Rationale: Draw.io renders cell
labels below the icon at a width determined by the label string and font size;
when two icons are placed too close horizontally (or vertically), their label
boxes fuse into illegible strings (e.g., `Web App 1Web App 2`,
`Key Vault (PE)Storage (PE)`).

The check approximates the rendered label box at:

- **Width** = `min(240, valueLen × fontSize × 0.7)` (default fontSize 11)
- **Height** = `fontSize × 1.4` below the icon
- **X** = centered horizontally on the icon

Reports collisions where:

- Both cells are icon (image) cells
- Both have positive geometry
- AABB intersection ≥ 50 px²
- AND ≥ 10% of the smaller box's area

Per Decision **D-OQ3** in [`agent-output/_plans/drawio-quality-uplift/plan.md`](../../../../agent-output/_plans/drawio-quality-uplift/plan.md),
the false-positive ceiling is **≤5%**. Tuned against the 7 captured baseline
diagrams in [`tools/tests/drawio-baseline/`](../../../../tools/tests/drawio-baseline/);
current FP rate is 0%, with FN rate ≈ 57% (some Draw.io render-side label
fusions are not AABB-detectable and remain out of scope for this check).

Caps reports at 8 per file. Advisory by default; `APEX_DRAWIO_RUBRIC=strict`
promotes to error.
