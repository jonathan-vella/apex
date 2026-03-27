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
