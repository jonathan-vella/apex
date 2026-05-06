<!-- ref:legend-template-v1 -->

# Legend Template

Copy-pasteable legend block for `04-Design` agent output. Eliminates the
"craft from scratch" pattern observed in 4 of 7 G1–G7 baseline captures
(varying legend formats, missing entries, HTML-entity bugs).

This is the canonical legend reference for **T-010 (legend-presence
validator)**, **T-022 (legend handoff in agent body)**, and **T-028
(generate-legend MCP tool)**.

## When required

- Legend is required when: image-cell count > 8 AND `diagram_type != "sequence"`.
- Sequence diagrams (per OQ-2 carve-out) omit the legend; protocols on edges
  suffice.
- Decomposed diagrams (multi-page): legend on the **overview page only**, not on each detail page.

Threshold key in [`quality-rubric.md`](quality-rubric.md): `labels.min_image_cells_for_legend = 8`.

## Two layout variants

### Variant A — Inline single-line (preferred for ≤4 entries)

Used in G7 baseline:

```text
→ HTTPS weighted routing  | ↔ Multi-region writes (Cosmos DB)  | ↔ Geo-replication (Storage GZRS)  | → Telemetry
```

mxCell:

```xml
<mxCell id="legend-inline" value="→ HTTPS weighted routing  |  ↔ Multi-region writes  |  ↔ Geo-replication  |  → Telemetry"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666;dashed=1;dashPattern=4 4;fontSize=10;align=left;verticalAlign=middle;spacingLeft=8;spacingRight=8"
        vertex="1" parent="1">
  <mxGeometry x="40" y="980" width="700" height="32" as="geometry"/>
</mxCell>
```

### Variant B — Two-column (preferred for ≥5 entries)

Used in G4, G6 baseline. Two sections: **Icons** (left), **Edges** (right).

```text
Icons                          Edges
▶ GPU = NC24ads A100 v4        → AML SDK: job dispatch
▶ ADLS = Gen2 HNS (abfss://)   → ABFS: filesystem access
▶ ACR = Premium tier           → Pull: Docker image pull
```

mxCell (single cell with HTML rendering):

```xml
<mxCell id="legend-two-column"
        value="&lt;b&gt;Icons&lt;/b&gt;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&lt;b&gt;Edges&lt;/b&gt;&lt;br&gt;▶ GPU = NC24ads A100 v4&amp;nbsp;&amp;nbsp;&amp;nbsp;→ AML SDK: job dispatch&lt;br&gt;▶ ADLS = Gen2 HNS&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;→ ABFS: filesystem access&lt;br&gt;▶ ACR = Premium tier&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;→ Pull: Docker image pull"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#666666;dashed=1;dashPattern=4 4;fontSize=10;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8"
        vertex="1" parent="1">
  <mxGeometry x="40" y="980" width="640" height="80" as="geometry"/>
</mxCell>
```

> **CRITICAL — HTML entity encoding.** When the cell's `style` contains
> `html=1`, the `value` attribute must use HTML entities (`&lt;br&gt;`,
> `&amp;nbsp;`) for line breaks and spacing. **Do NOT use literal `&#xa;`** —
> Draw.io renders it verbatim (the G6 baseline bug). Use `<br>` (encoded as
> `&lt;br&gt;`) for line breaks.

## Required entries by category

A legend MUST cover every distinct visual encoding present in the diagram.
For each category, include only the encodings actually used.

### Icon section (variant rationale, when prompt has SKU/tier ambiguity)

- Variant suffix in cell labels (e.g., `(A100)`, `(Gen2)`, `Premium`)
- One legend row per variant family present:

```text
▶ GPU = NC24ads A100 v4
▶ ADLS = Gen2 HNS (abfss://)
▶ ACR = Premium tier
```

### Color / fill section (when ≥2 zone types present)

- One row per APEX-palette zone fill in use, mapping fill to semantic role:

```text
█ Compute zone (#E7F5FF)        █ Data zone (#FFF2CC)
█ Networking / VNet (#E6F5E6)   █ Security perimeter (#FFE6E6)
█ Governance / Ops (#F5F5F5)
```

### Edge section (always — every distinct edge style)

- One row per (line-style, label-meaning) pair:

```text
→ Solid: synchronous request (HTTPS, gRPC)
⤳ Dashed: asynchronous (AMQP, queue, change-feed)
⋯→ Dotted: monitoring / observability
↔ Bidirectional: replication (multi-master, geo-replication)
```

### Boundary section (when trust boundary or external zone present)

- One row per boundary type:

```text
[red dashed border] Trust boundary (public ingress)
[amber dashed border] External / on-prem zone
```

## Position and styling

- **Position**: bottom of the canvas, 80–120 px below the lowest content
  row, full canvas width minus 40 px margin each side.
- **Z-order**: `parent="1"` (root layer) — legend never lives inside a zone
  container.
- **Style**: dashed gray border (`strokeColor=#666666;dashed=1;dashPattern=4 4`),
  white fill, 10pt font, left-aligned.
- **Width budget**: ≤700 px for variant A, ≤640 px for variant B.

## Anti-patterns from T-012 baseline

| Anti-pattern | Captured in | Correction |
| --- | --- | --- |
| Legend mentioned in cell value but no actual perimeter rendered | G1, G3, G5, G6, G7 (5/7 — trust boundary in legend only) | Render the boundary as a real cell per [`semantic-zones.md`](semantic-zones.md), then reference it in the legend |
| Legend uses literal `&#xa;` instead of `<br>` | G6 (legend reads as one long line) | Use `&lt;br&gt;` in `value` when `style` has `html=1` |
| Legend ad-hoc per scenario | G4, G6, G7 each used different formats | Pick variant A (inline) or variant B (two-column) per entry count; do not freestyle |
| Legend on detail pages of a decomposed set | n/a in baseline (G6 had legend on overview only — correct) | Maintain: overview only |
| Legend rendered for sequence type | n/a in baseline (G3 correctly omitted) | Per OQ-2 carve-out, sequence omits legend |

## Generation strategies

### Manual (today)

The agent constructs the legend cell as the last vertex in `add-cells`. Use the
templates above; pick variant by entry count.

### Server-side (T-028 generate-legend, future)

The MCP server scans the current diagram for unique `image=` references,
unique edge styles, and unique fill colors, then emits a self-contained
legend group. The agent invokes:

```text
generate-legend(diagram_xml, position: "below-content")
```

After T-028 lands, the agent prefers `generate-legend` over manual
construction. Until then, this template is the source of truth.

## Validator hooks

Consumed by:

- [`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs) **T-010** legend-presence check — when image-cell count > `labels.min_image_cells_for_legend` (8) AND filename does not match a sequence-type pattern, look for a cell with `value` containing legend markers (`Legend`, `→`, `↔`, or `▶`).

## Cross-references

- [`quality-rubric.md`](quality-rubric.md) — Dimension 5 (Labelling) anchored 0–4 scale
- [`semantic-zones.md`](semantic-zones.md) — palette mapping for color section
- [`style-reference.md`](style-reference.md) — typography conventions
- [`abstraction-rules.md`](abstraction-rules.md) — flow/edge label rules
