<!-- ref:semantic-zones-v1 -->

# Semantic Zone Templates

Copy-pasteable patterns for the boundary cells that an Azure architecture
diagram MUST contain when the prompt or workload calls for them. Today
[`abstraction-rules.md`](abstraction-rules.md) covers VNet/RG-level grouping;
this file extends the convention to **subscription scopes**, **region zones**,
**trust boundaries**, and **external/internet zones**.

This file is the **single source of truth** for zone naming, palette, and
nesting. T-009 (semantic zone-presence validator) reads thresholds from
[`quality-rubric.md`](quality-rubric.md) and zone names from this file.

## When to use each zone type

| Workload signal | Required zone | Rationale |
| --- | --- | --- |
| Single subscription, single region | RG only | Scopes match prompt; subscription/region implicit |
| 2+ subscriptions OR 2+ regions | Subscription scope OR region zone | Multi-scope must be visually distinct |
| Public ingress (Front Door, App Gateway, APIM, public IP) | Trust boundary | Internet-facing perimeter must be visible |
| External SaaS / on-prem dependencies | External zone | "What we do not own" is a first-class concept |
| Hub-spoke or landing zone | All four (sub + region + trust + external) | Enterprise patterns require the full set |

The selection is **additive**: a hub-spoke landing zone in two regions has
subscription scopes AND region zones AND trust boundary AND on-prem zone.

## Zone palette (consistent with APEX convention)

These extend the APEX palette in
[`style-reference.md`](style-reference.md#azure-architecture-palette-apex-convention):

| Zone type | Fill | Stroke | Style modifier | Usage |
| --- | --- | --- | --- | --- |
| Management group | `#F5F5F5` | `#666666` | `dashed=1` | Hierarchy markers (Tenant Root, Platform, Landing Zones) |
| Subscription scope | `#E7F5FF` | `#6C8EBF` | `dashed=1;dashPattern=8 4` | Subscription-level container |
| Region zone | `#E6F5E6` | `#82B366` | `dashed=1;dashPattern=12 4` | Per-region container |
| VNet | (transparent) | `#0078D4` | `strokeWidth=2` | Network boundary, no fill |
| Trust boundary | (transparent) | `#B85450` | `dashed=1;strokeWidth=3;dashPattern=4 4` | Perimeter — public ingress, control-plane |
| External / on-prem zone | `#FFF2CC` | `#D6B656` | `dashed=1` | Outside-tenant resources |
| Observability zone | `#F5F5F5` | `#9673A6` | `dashed=1` | Cross-cutting Monitor/LA/AI/Sentinel |

**Rationale for palette choices:** subscription scope = compute family because
subs hold compute; region zone = networking family because regions are transport
planes; trust boundary = security red; external = data amber (warm = "out of our
control"); observability = governance gray.

## Nesting hierarchy (canonical)

```text
Tenant Root MG (optional, for landing zones)
└── Platform MG (and siblings: Landing Zones MG, Sandbox MG)
    └── Connectivity MG (and siblings: Identity MG)
        └── Subscription scope (Connectivity Subscription)
            └── Region zone (Sweden Central)
                └── VNet (Hub VNet 10.0.0.0/16)
                    └── Subnet (GatewaySubnet, AzureFirewallSubnet, ...)
                        └── Service icon (ExpressRoute Gateway, Firewall, ...)
```

**Trust boundary** wraps any subset of the above, typically at the public-ingress
edge (Front Door, App Gateway). It does **not** participate in the parent/child
chain; it is rendered as an overlay perimeter.

**External zone** sits outside the Tenant Root MG.

## Snippet — subscription scope (top-level container)

```xml
<mxCell id="sub-connectivity" value="Connectivity Subscription"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E7F5FF;strokeColor=#6C8EBF;dashed=1;dashPattern=8 4;fontSize=12;fontStyle=1;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;container=1;collapsible=0"
        vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="320" height="600" as="geometry"/>
</mxCell>
```

When using the MCP server's `create-groups` tool, pass:

```json
{
  "text": "Connectivity Subscription",
  "x": 40, "y": 40, "width": 320, "height": 600,
  "style": "rounded=1;whiteSpace=wrap;html=1;fillColor=#E7F5FF;strokeColor=#6C8EBF;dashed=1;dashPattern=8 4;fontSize=12;fontStyle=1;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8"
}
```

## Snippet — region zone

```xml
<mxCell id="region-swedencentral" value="Sweden Central"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E6F5E6;strokeColor=#82B366;dashed=1;dashPattern=12 4;fontSize=12;fontStyle=1;verticalAlign=top;align=center;spacingTop=8;container=1;collapsible=0"
        vertex="1" parent="sub-connectivity">
  <mxGeometry x="20" y="40" width="280" height="540" as="geometry"/>
</mxCell>
```

**Rule:** Region zone is a **child of** the subscription scope when both apply,
not a peer. This prevents the G5 MG-hierarchy collapse pattern.

## Snippet — trust boundary (perimeter overlay)

```xml
<mxCell id="trust-boundary-public-ingress" value="Trust Boundary — Public Ingress"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#B85450;dashed=1;dashPattern=4 4;strokeWidth=3;fontSize=11;fontStyle=2;fontColor=#B85450;verticalAlign=top;align=left;spacingLeft=8;spacingTop=4;container=1;collapsible=0"
        vertex="1" parent="1">
  <mxGeometry x="80" y="80" width="240" height="180" as="geometry"/>
</mxCell>
```

**Rule:** Trust boundary cells are **not** parents of the resources they
encompass; they sit on top as a visual overlay (`fillColor=none`). The
underlying compute/networking still parents to its VNet/sub.

## Snippet — external / on-prem zone

```xml
<mxCell id="zone-onprem" value="On-Premises Network"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF2CC;strokeColor=#D6B656;dashed=1;fontSize=12;fontStyle=1;fontColor=#7F6000;verticalAlign=top;align=center;spacingTop=8;container=1;collapsible=0"
        vertex="1" parent="1">
  <mxGeometry x="800" y="200" width="180" height="200" as="geometry"/>
</mxCell>
```

External zones live **outside** the Tenant Root MG. Common labels:
"On-Premises Network", "Internet", "External Partner APIs", "End User".

## Snippet — observability zone (cross-cutting)

Use this when ≥2 cross-cutting services (Monitor, Log Analytics, App Insights,
Sentinel, Defender) appear in the diagram. Eliminates the "floating
cross-cutting" pattern observed in 4 of 7 G1–G7 baseline captures.

```xml
<mxCell id="zone-observability" value="Observability &amp; Governance"
        style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F5F5F5;strokeColor=#9673A6;dashed=1;fontSize=12;fontStyle=1;fontColor=#444;verticalAlign=top;align=left;spacingLeft=12;spacingTop=8;container=1;collapsible=0"
        vertex="1" parent="1">
  <mxGeometry x="40" y="900" width="900" height="160" as="geometry"/>
</mxCell>
```

**Rule:** Observability zone sits at the **bottom** of the canvas, spanning
the full width of the architecture above it. No edges from main-flow
resources cross into it (per [`abstraction-rules.md`](abstraction-rules.md)
"Cross-cutting services" section).

## Selection rule (for the agent)

The agent decides which zones to render based on prompt parsing. Encode the
following rule (T-020 will move it into `04-design.agent.md` as a
≤15-line pointer):

```text
zones = []
if subscriptions >= 2:
    zones += ["subscription_scope per subscription"]
if regions >= 2:
    zones += ["region_zone per region"]
if has_public_ingress:  # Front Door, App Gateway, APIM, public IP
    zones += ["trust_boundary at public-ingress edge"]
if has_external_dependencies:  # SaaS, on-prem, partner APIs
    zones += ["external_zone"]
if cross_cutting_services >= 2:  # Monitor + LA + AI + Sentinel + Defender
    zones += ["observability_zone at canvas bottom"]
```

Default — **always include**:

- VNet container if any networked resource exists
- RG container if a single resource group is named in the prompt

## Anti-patterns observed in baseline

These regressions in G1–G7 motivated this reference. Each is now documented
to prevent recurrence:

| Pattern | Captured in | Correction |
| --- | --- | --- |
| Trust boundary mentioned in legend only, not rendered | G1, G3, G5, G6, G7 (5/7) | Use the trust-boundary snippet above; rendered as actual perimeter cell, not a legend item |
| Cross-cutting services floating without zone | G1, G3, G4, G5 (4/7) | Use the observability-zone snippet; place at canvas bottom, span full width |
| MG hierarchy collapsed one nesting level | G5 (Connectivity/Identity drawn as peers of Platform) | Use the canonical nesting hierarchy above; MGs nest under MGs, then subscriptions, then regions |
| Region zone not used for multi-region | G7 used it correctly; G6 used per-page decomposition instead | When 2 regions, prefer region zones first; decompose into pages only at >50 resources (per T-023) |
| Subscription scope omitted on multi-sub workloads | G2 used subscription scopes; later captures dropped them | Always include `subscription_scope` per subscription when ≥2 subscriptions |

## Validator hooks

Consumed by:

- [`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs)
  T-009 zone-presence check — reads `semantics.min_resources_for_zone` from
  [`quality-rubric.md`](quality-rubric.md) (default 10) and verifies at least
  one container/group cell exists when image-cell count exceeds the threshold.
- [`tools/scripts/validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs)
  T-008 type-fit signature check — for filename pattern `03-des-*.drawio`,
  verifies subscription/region/trust-boundary signatures appear when the
  associated `expected_zones[]` in
  [`tools/tests/drawio-golden/<scenario>/expected.json`](../../../../tools/tests/drawio-golden/)
  declares them.

## Cross-references

- Style palette: [`style-reference.md`](style-reference.md#azure-architecture-palette-apex-convention)
- Abstraction rules (what to omit): [`abstraction-rules.md`](abstraction-rules.md)
- Quality rubric (Dimension 4 — Semantics): [`quality-rubric.md`](quality-rubric.md)
- Validation checklist: [`validation-checklist.md`](validation-checklist.md)
- Golden scenarios that exercise zones: [`tools/tests/drawio-golden/g2-hub-spoke-landing-zone/`](../../../../tools/tests/drawio-golden/g2-hub-spoke-landing-zone/), [`g5-enterprise-landing-zone/`](../../../../tools/tests/drawio-golden/g5-enterprise-landing-zone/), [`g7-multi-region-active-active/`](../../../../tools/tests/drawio-golden/g7-multi-region-active-active/)

## Change control

Adding a new zone type:

1. Append to "When to use each zone type" table.
2. Add a row to the palette table with fill/stroke/modifier.
3. Add a copy-pasteable snippet section.
4. Update the Selection rule pseudocode.
5. If the zone has deterministic presence requirements, add a threshold
   key to [`quality-rubric.md`](quality-rubric.md#deterministic-thresholds-consumed-by-validator)
   and wire it into [`validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs).
