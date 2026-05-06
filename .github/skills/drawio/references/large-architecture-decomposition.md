<!-- ref:large-architecture-decomposition-v1 -->

# Large-Architecture Decomposition Rules

How to render diagrams with >20 resources. Today the agent has only an effort
note for high-resource counts and a fixed 25-call circuit breaker. This file
codifies tiered rules: when to keep single-page, when to decompose,
how to partition, and how to merge.

This is the canonical reference for **T-007 (density validator)**, **T-024
(dynamic circuit-breaker)**, and **T-037 (multi-page finish-diagram)**.

## Tier breakpoints

Resource count is the primary tier signal. Page-density target is the secondary.

| Tier | Resource count | Strategy | Circuit-breaker cap |
| --- | :-: | --- | :-: |
| **S** small | ≤ 8 | Single page, no zones beyond RG | 25 tool calls |
| **M** medium | 9 – 20 | Single page, zones per [`semantic-zones.md`](semantic-zones.md) | 25 tool calls |
| **L** large | 21 – 50 | Single page **or** decomposition (agent picks) | 40 tool calls |
| **XL** extra-large | > 50 | **Mandatory** decomposition into multi-page | 60 tool calls |

Tier breakpoints feed [T-024 dynamic circuit-breaker](../../../agents/04-design.agent.md).

## Density target

Per page, regardless of tier:

- **Target**: ≤ 1 cell per **2500** sq-px
- **Warning** (T-007 advisory): 1 cell per 4000–2500 sq-px (acceptable but tight)
- **Strict failure** (T-007 strict): > 1 cell per 2500 sq-px

Density key in [`quality-rubric.md`](quality-rubric.md):
`density.max_cells_per_sqpx = 1/2500`,
`density.warn_cells_per_sqpx = 1/4000`.

## Decomposition strategy (Tier L and XL)

### Pattern: overview + region details (most common)

Used in G6 baseline (3 pages: Overview / Sweden Central / Germany West Central).

```text
Page 1: Overview
  - Global resources (Front Door, DNS, Cosmos multi-region, Event Hubs cluster)
  - Region zones as cells (visual placeholders, not full content)
  - Cross-region edges (replication, routing)
  - Legend on this page only
  - Density: ≤ 30 cells

Page 2: <Region 1> Detail
  - Per-subscription / per-resource detail for region 1
  - No global resources (avoid duplication)
  - Density: ≤ 30 cells

Page N: <Region N> Detail
  - Same as page 2 for each region
```

### Pattern: overview + workload details (alternative)

For non-region partitioning (e.g., landing zones with multiple workloads):

```text
Page 1: Overview
  - Management group hierarchy
  - Subscription scopes as cells
  - Cross-subscription edges
  - Legend

Page 2: <Workload 1> Detail
  - Per-workload subscription content
  ...
```

### Pattern: overview + concern (least common)

For diagrams where partitioning by concern beats partitioning by region/workload
(e.g., security + networking + observability concerns of the same workload):

```text
Page 1: Workload overview
Page 2: Security & identity detail
Page 3: Network detail
Page 4: Observability detail
```

## Per-page budget

| Element | Budget per page |
| --- | :-: |
| Resources (image cells) | ≤ 30 |
| Edges | ≤ 40 |
| Zone cells (groups, containers) | ≤ 8 |
| Total cells (ceiling) | ≤ 80 |

Budgets feed the T-007 density-warning extension to `get-diagram-stats`.

## Cross-page edges

Edges spanning pages are problematic. Convention:

- **Overview-only**: cross-region/-subscription edges live on the overview page
  only.
- **Detail pages**: keep edges within the page; reference cross-page items by
  text label only (e.g., "→ Front Door (see Overview)").

## Generation workflow

### Single-page (Tier S, M, L when not decomposing)

Standard MCP workflow:

```text
search-shapes → create-groups → add-cells → add-cells-to-group → finish-diagram → save
```

### Multi-page (Tier L when decomposing, Tier XL always)

**Today** (until T-037 lands): per-page chain + Python merger (the G6 pattern).

```text
for page in pages:
    create-groups(page.groups)
    add-cells(page.cells)
    add-cells-to-group(page.assignments)
    finish-diagram → save page-N.drawio

merge.py: combine page-1.drawio ... page-N.drawio into single mxfile
          with three <diagram> elements
```

The Python merger:

```python
import xml.etree.ElementTree as ET
pages = [
    ('/tmp/page-1.drawio', 'Overview', 'page-overview'),
    ('/tmp/page-2.drawio', 'Region 1 Detail', 'page-region-1'),
    ('/tmp/page-3.drawio', 'Region 2 Detail', 'page-region-2'),
]
out = ET.Element('mxfile')
for src, name, page_id in pages:
    inner = ET.parse(src).getroot()
    diagram = inner.find('diagram')
    diagram.set('name', name)
    diagram.set('id', page_id)
    out.append(diagram)
ET.ElementTree(out).write('agent-output/<project>/03-des-diagram.drawio')
```

**Future** (T-037 native multi-page):

```text
finish-diagram(pages: [
  {name: "Overview",            diagram_xml: "..."},
  {name: "Region 1 Detail",     diagram_xml: "..."},
  {name: "Region 2 Detail",     diagram_xml: "..."}
])
```

Eliminates the Python merger entirely (one of 6 friction events on G6).

## Dynamic circuit-breaker (T-024)

Replace the fixed 25-call cap with a tier-aware cap:

```text
function circuit_breaker_cap(resource_count):
    if resource_count <= 20:  return 25
    if resource_count <= 50:  return 40
    if resource_count > 50:   return 60   # decomposition increases call count
    raise "decomposition required"
```

Rationale: Tier-XL scenarios legitimately need more MCP calls (multi-page
chains). The fixed 25-call cap would have aborted G6 (52 calls observed) had
it been enforced strictly.

## Anti-patterns from T-012 baseline

| Anti-pattern | Captured in | Correction |
| --- | --- | --- |
| Tier-L scenario (>20) attempted single page; layout collapsed | G5 (~25 resources, scalability 1/4) | Apply Tier-L decomposition strategy |
| Tier-XL scenario succeeded but with custom Python merger | G6 (~55 resources, scalability 4/4 — best so far) | Maintain pattern until T-037 lands |
| Bottom 50% of canvas empty on Tier-S/M | G1, G3, G4, G5 (cross-cutting drift) | Use observability-zone container per [`semantic-zones.md`](semantic-zones.md) |
| Wide horizontal flow with no row-fold | n/a in baseline | If horizontal extent > 1500 px, decompose by zone instead of widening canvas |

## Cross-references

- [`quality-rubric.md`](quality-rubric.md) — Dimension 7 (Scalability) anchored 0–4 scale
- [`semantic-zones.md`](semantic-zones.md) — zone templates per tier
- [`diagram-types.md`](diagram-types.md) — type-specific decomposition signatures
- T-012 baseline G5: failed Tier-L decomposition; G6: successful Tier-XL decomposition

## Change control

Adjusting tier breakpoints:

1. Update the "Tier breakpoints" table here.
2. Update `density.*` keys in [`quality-rubric.md`](quality-rubric.md) if density target changes.
3. Update T-024 cap function in [`04-design.agent.md`](../../../agents/04-design.agent.md).
4. Re-run T-012 baseline capture to verify the new breakpoints don't change the rubric scoring.
