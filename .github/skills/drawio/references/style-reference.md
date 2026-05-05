<!-- ref:style-reference-v1 -->

# Draw.io Style Properties Reference

Condensed reference for AI-generated draw.io files.
Full documentation: <https://www.drawio.com/doc/faq/drawio-style-reference>

## Fill and Stroke

| Property        | Values                       | Default   | Purpose            |
| --------------- | ---------------------------- | --------- | ------------------ |
| `fillColor`     | `#RRGGBB`, `none`, `default` | `default` | Shape fill color   |
| `gradientColor` | `#RRGGBB`, `none`            | `none`    | Gradient end color |
| `strokeColor`   | `#RRGGBB`, `none`, `default` | `default` | Border color       |
| `strokeWidth`   | number                       | `1`       | Border width (px)  |
| `dashed`        | `0`, `1`                     | `0`       | Dashed stroke      |
| `dashPattern`   | string                       | —         | e.g., `"8 8"`      |
| `opacity`       | 0–100                        | `100`     | Overall opacity    |

## Shape Geometry

| Property    | Values                                                                    | Purpose                |
| ----------- | ------------------------------------------------------------------------- | ---------------------- |
| `shape`     | `rectangle`, `ellipse`, `rhombus`, `cylinder3`, `swimlane`, `image`, etc. | Shape type             |
| `perimeter` | `rectanglePerimeter`, `ellipsePerimeter`, `rhombusPerimeter`, etc.        | Connection calculation |
| `rounded`   | `0`, `1`                                                                  | Round corners          |
| `arcSize`   | 0–50                                                                      | Corner radius %        |
| `aspect`    | `variable`, `fixed`                                                       | Preserve ratio         |
| `rotation`  | degrees                                                                   | Free rotation          |

**Perimeter matching**: Non-rectangular shapes MUST set matching perimeter.

## Text and Labels

| Property                | Values                    | Purpose                                 |
| ----------------------- | ------------------------- | --------------------------------------- |
| `html`                  | `0`, `1`                  | HTML label rendering                    |
| `whiteSpace`            | `wrap`, `nowrap`          | Text wrapping                           |
| `fontSize`              | number                    | Font size (px)                          |
| `fontFamily`            | string                    | Font name                               |
| `fontColor`             | `#RRGGBB`                 | Text color                              |
| `fontStyle`             | bitmask                   | 0=normal, 1=bold, 2=italic, 4=underline |
| `align`                 | `left`, `center`, `right` | Horizontal align                        |
| `verticalAlign`         | `top`, `middle`, `bottom` | Vertical align                          |
| `labelPosition`         | `left`, `center`, `right` | Label position relative to shape        |
| `verticalLabelPosition` | `top`, `middle`, `bottom` | Vertical label position                 |

## Edge Properties

| Property    | Values                                                                       | Purpose         |
| ----------- | ---------------------------------------------------------------------------- | --------------- |
| `edgeStyle` | `orthogonalEdgeStyle`, `elbowEdgeStyle`, `entityRelationEdgeStyle`, `(none)` | Routing         |
| `curved`    | `0`, `1`                                                                     | Curved path     |
| `rounded`   | `0`, `1`                                                                     | Rounded corners |
| `jettySize` | `auto`, number                                                               | Port spacing    |

## Arrow Markers

| Property     | Values                                                | Purpose           |
| ------------ | ----------------------------------------------------- | ----------------- |
| `startArrow` | `none`, `classic`, `block`, `open`, `diamond`, `oval` | Start marker      |
| `endArrow`   | same values                                           | End marker        |
| `startFill`  | `0`, `1`                                              | Fill start marker |
| `endFill`    | `0`, `1`                                              | Fill end marker   |

## Container Properties

| Property      | Values                      | Purpose                |
| ------------- | --------------------------- | ---------------------- |
| `container`   | `0`, `1`                    | Cell is a container    |
| `collapsible` | `0`, `1`                    | Can collapse           |
| `startSize`   | number                      | Swimlane header height |
| `childLayout` | `stackLayout`, `treeLayout` | Auto-layout            |

## Image Properties

| Property      | Values          | Purpose                   |
| ------------- | --------------- | ------------------------- |
| `image`       | URL or data URI | Image source              |
| `imageWidth`  | number          | Image width (default 42)  |
| `imageHeight` | number          | Image height (default 42) |
| `imageAspect` | `0`, `1`        | Preserve aspect ratio     |

## Core Shapes

| Token       | Shape                 | Perimeter            |
| ----------- | --------------------- | -------------------- |
| `rectangle` | Rectangle (default)   | `rectanglePerimeter` |
| `ellipse`   | Oval/ellipse          | `ellipsePerimeter`   |
| `rhombus`   | Diamond               | `rhombusPerimeter`   |
| `cylinder3` | Cylinder              | `rectanglePerimeter` |
| `swimlane`  | Container with header | `rectanglePerimeter` |
| `image`     | Image container       | `rectanglePerimeter` |
| `cloud`     | Cloud shape           | `rectanglePerimeter` |

## Edge Routing Algorithms

| Style                     | Behavior                        |
| ------------------------- | ------------------------------- |
| `orthogonalEdgeStyle`     | Right-angle turns (most common) |
| `elbowEdgeStyle`          | Single elbow bend               |
| `entityRelationEdgeStyle` | ER-style perpendicular exits    |
| `(empty)`                 | Straight line                   |

## Color Palette (Standard draw.io)

| Name   | Fill      | Stroke    |
| ------ | --------- | --------- |
| Blue   | `#DAE8FC` | `#6C8EBF` |
| Green  | `#D5E8D4` | `#82B366` |
| Yellow | `#FFF2CC` | `#D6B656` |
| Red    | `#F8CECC` | `#B85450` |
| Purple | `#E1D5E7` | `#9673A6` |
| Gray   | `#F5F5F5` | `#666666` |
| Orange | `#FFE6CC` | `#D79B00` |

## Azure Architecture Palette (APEX convention)

Used for grouping-container fills in `03-des-*.drawio`, `04-dependency-*.drawio`,
`04-runtime-*.drawio`, `07-ab-*.drawio`. Enforced as advisory-now / blocking-in-0.12
by [`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs).

| Concern        | Fill      | Rationale                          |
| -------------- | --------- | ---------------------------------- |
| Compute        | `#E7F5FF` | Pale blue — low-saturation primary |
| Data           | `#FFF2CC` | Warm amber — persistence context   |
| Security       | `#FFE6E6` | Pink — risk / control surfaces     |
| Networking     | `#E6F5E6` | Pale green — transport planes      |
| Governance/Ops | `#F5F5F5` | Neutral gray — cross-cutting       |

Strokes use the matching draw.io stroke from the standard palette (e.g. compute
fill `#E7F5FF` pairs with stroke `#6C8EBF`) to preserve visual continuity with
stock shapes.

## Typography (APEX convention)

| Element       | Size  | Weight | Notes                                 |
| ------------- | ----- | ------ | ------------------------------------- |
| Page title    | 14–16 | Bold   | Top-of-page, matches diagram `name`   |
| Group label   | 12    | Bold   | Container header                      |
| Service label | 11    | Normal | Azure icon captions                   |
| Edge label    | 10    | Normal | Protocol/port or verb                 |
| Footer        | 9     | Normal | Owner + revision date, bottom-of-page |

## Layout Spacing (APEX convention)

- **Intra-group**: 40 px between peers inside the same container
- **Cross-group**: 80 px between containers in the same tier
- **Cross-tier**: 120 px between tiers (e.g., compute → data)

These values feed the spacing rubric check in
[`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs).

## Layout Conventions (extended)

### General Rules

- **Primary flow**: left-to-right. Each stage occupies a column.
- **Parallel services**: stacked vertically within their column, never side-by-side.
- **Spacing**: 120px horizontal between columns, 80px vertical between rows,
  40px around each cell. These minimums prevent icon labels (often 100–140px wide)
  from colliding with adjacent icons.
- **Subnet row height**: For stacked subnet/namespace layouts, use **120–130px row height**
  per row — icon (48px) + label (~20px below) + 40px gap to next subnet border.
- **Page**: US Letter 850×1100px (extend to 1300px for diagrams with legend).
  Content within 40px margins on all sides (usable area = page size minus 80px
  in each dimension; e.g., 770×1020 at 1100px height, 770×1220 at 1300px).
- **No overlapping**: Components must not overlap each other.

### Layout Patterns

- **Left-to-right flow** (default — use unless the architecture is clearly
  hub-spoke or multi-subscription): Each stage occupies a column. Use for
  ingress → compute → data store architectures (VM baseline, AKS, App Service).
- **Center-column hub-spoke**: Hub VNet in the center column with spokes
  radiating right. External/on-prem services on the left. Use for networking
  architectures (DNS, firewall, hub-spoke topologies).
- **Multi-subscription landing zone**: Stacked color-coded containers for each
  subscription boundary (e.g., green for connectivity/hub, blue for app landing
  zone, purple for external PaaS like Foundry). External actors (Users) placed
  outside all containers. Use for enterprise landing zone architectures.

### Numbered Callout Annotations

For multi-step flow explanations (common in Microsoft reference architectures),
use circled Unicode numbers as small text vertices placed near the relevant
icon or edge: `①②③④⑤⑥⑦⑧⑨⑩`. Style them with `fontSize=11;fontColor=#CC0000;fontStyle=1`
so they stand out as red bold callouts without cluttering the diagram.

### Non-Azure Component Styling

For on-premises, external, or third-party services that don't have Azure icons,
use a **yellow-tinted rectangle** to visually distinguish them from Azure resources:

```text
shape=mxgraph.basic.rect;fillColor=#FFF9E6;strokeColor=#D4A017;rounded=1;
fontSize=10;fontColor=#8B6914;whiteSpace=wrap;
```

Examples: on-premises DNS servers, hosted public DNS, external partner systems,
client apps, CI/CD pipelines.

### Groups

- Create groups for VNets, subnets, Container Apps Environments, resource groups.
- Set `text: ""` for groups — create a separate bold text vertex above the group instead.
- Use `suggest-group-sizing` to calculate dimensions based on child count.
- **Minimum width per icon count**: Allow at least **150px per icon** horizontally,
  because icon labels like "Application Insights" or "DNS Private Resolver"
  are ~130px wide and collide at tighter spacing.
  A hub VNet with 5 icons needs ≥ 750px width.
- **Actor placement**: External actors (Users, Operators, Clients) must be
  positioned **outside** all container boundaries, because actors placed inside
  a group's coordinate range get visually swallowed by the container fill.
  After placing actors, verify their coordinates don't fall within any
  group's x/y/width/height range.

### Edges

- **Orthogonal only**: Use `edgeStyle=orthogonalEdgeStyle` (the default).
- **NO anchor points**: Never set `entryX`, `entryY`, `exitX`, `exitY` in your edge style.
- **NO waypoints**: Do not add `<Array as="points">` or `<mxPoint>` elements.
- **Side exits preferred**: edges exit/enter through left or right sides.
- **Target icons, not groups**: Always connect edges to the specific icon vertex
  (via `temp_id`), not the parent group/subnet cell ID, because the orthogonal
  router calculates the path through every intervening group boundary between
  source and target — creating messy vertical corridors and label collisions.
- **One edge per source into a group**: When a source connects to a service
  inside a group, target the specific child icon. Only target the group cell
  itself when the container is the conceptual endpoint (rare).
- **No edges to cross-cutting services**: their presence is implied.
- **Fan-out staggering**: When multiple edges leave the same source, keep them
  minimal. Consider merging semantically similar paths (e.g., "Partner Data Export"
  instead of Storage → Data Share → Partners as 3 separate edges).

> **CRITICAL — Post-Processing Required**: The MCP server's auto-router injects
> `exitX/exitY/entryX/entryY` anchor points and `<Array>` waypoints into every
> edge it creates. These computed routes are poor for fan-out patterns and cause
> edges to pile up in horizontal corridors. After `finish-diagram`, the agent
> **MUST** run `tools/scripts/save-drawio.py` which strips these injected anchors and
> waypoints, letting Draw.io's client-side renderer calculate clean orthogonal
> paths when the file is opened.

### Cross-Cutting & Supporting Services

Place Azure Monitor, Entra ID, Key Vault, Azure Policy, Defender for Cloud,
Container Registry, DNS Zones, Application Insights, Log Analytics at the
**bottom** of the diagram, 120px below the main flow. No edges to them.
Space **120px apart** (center-to-center) — labels like "Application Insights"
and "Private DNS Zones" need this width. Wrap into multiple rows at page width.

Enclose all cross-cutting icons in a **single light-grey rounded container**
(`fillColor=#F5F5F5;strokeColor=#BDBDBD`) with a bold Azure-blue heading
("Cross-cutting platform services") inside at the top.

### Legend

Every diagram MUST include a legend. Place it in a horizontal bar **below** the
cross-cutting services box (not beside it — side-by-side causes overlap).

- Use inline HTML for colored arrow indicators:
  `<font color="#0078D4"><b>━━▶</b></font>  Data flow (HTTPS / TLS)`
- Add small colored rectangle swatches for container styles (e.g., blue dashed
  for data-path subnets, orange dashed for operational subnets).
- **When creating legend shape samples** via `add-cells`, always set `text: ""`
  explicitly — the MCP server defaults to `"New Cell"` which renders as visible text.
