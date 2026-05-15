<!-- ref:diagram-types-v1 -->

# Draw.io Diagram Types

Catalogue of the four diagram types `04-Design` emits, with selection rules,
expected resources, label conventions, and tool-call patterns. Today
[`abstraction-rules.md`](abstraction-rules.md) covers what to omit; this file
covers **which type to choose** and **how each type differs**.

This is the canonical reference for **T-008 (type-fit signature validator)** and
**T-015 (diagram-type dispatch in agent body)**.

## The four types

| Type           | Filename pattern                                        | When to use                                                         | Expected resources                                                                                     |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **logical**    | `03-des-diagram.drawio`, `04-dependency-diagram.drawio` | Architecture overviews, service relationships, single-flow web apps | Compute + data + cross-cutting; left-to-right flow; no network detail                                  |
| **network**    | `03-des-diagram.drawio` (when prompt is network-led)    | Hub-spoke, landing zones, VNet topology, security perimeters        | VNets, subnets, peering, gateways; trust boundary always present                                       |
| **sequence**   | `04-runtime-diagram.drawio`                             | Runtime flows, event-driven systems, request paths                  | Compute + messaging + persistence; logical zones (Ingress / Processing / Persistence); legend optional |
| **deployment** | `07-ab-diagram.drawio`                                  | As-built physical layout, ML/data pipelines, environment-specific   | Workspace + compute + data + variant-specific tiers (GPU, Premium, Gen2)                               |

## Selection rule (canonical)

The agent decides type from these prompt cues. Encode the precedence in
[T-015 dispatch](../../../agents/04-design.agent.md):

```text
priority 1 — explicit type cue:
  prompt mentions "sequence", "runtime flow", "data flow"  → sequence
  prompt mentions "network", "topology", "hub-spoke"       → network
  prompt mentions "deployment", "as-built", "physical"     → deployment
  default                                                  → logical

priority 2 — workload pattern:
  event-driven (Service Bus / Event Grid / Event Hubs as primary) → sequence
  multi-VNet OR explicit subnets OR peering                       → network
  ML pipeline OR data engineering OR Synapse/Fabric/Purview       → deployment
  three-tier web / single-flow PaaS                               → logical

priority 3 — filename convention (when pre-allocated by orchestrator):
  03-des-diagram     → caller picks (logical default)
  04-dependency-*    → logical (DAG of compute/data dependencies)
  04-runtime-*       → sequence
  07-ab-*            → deployment
```

## Type-specific expectations

### logical

- **Zones**: VNet container if any networked resource; cross-cutting at bottom (per [`abstraction-rules.md`](abstraction-rules.md)).
- **Edges**: minimal — primary request path only. Labels: protocol or verb.
- **Boundaries**: trust boundary required when public ingress (Front Door, App Gateway, APIM, public IP).
- **Legend**: required when image-cell count > 8.
- **Type-fit signature** (T-008): expected zones from [`expected.json.expected_zones[]`](../../../../tools/tests/drawio-golden/) AND legend cell present (when count > 8).

### network

- **Zones**: VNets, subnets, subscription scopes (when ≥2 subs), trust boundary always.
- **Edges**: peering edges, ExpressRoute/VPN edges. Labels: `VNet Peering`, `ExpressRoute`, `Private Link`.
- **Boundaries**: trust boundary at any internet-facing edge; on-prem zone when hybrid.
- **Legend**: required.
- **Type-fit signature** (T-008): VNet container cells + peering edges with one of the expected edge labels.

### sequence

- **Zones**: logical (Ingress / Processing / Persistence), NOT network.
- **Edges**: every primary edge labelled with protocol + (port or auth method) — `HTTPS`, `AMQP`, `443`, `OAuth2`.
- **Boundaries**: trust boundary at public ingress.
- **Legend**: NOT required (flow is self-explanatory; protocols on edges suffice). This is the **OQ-2 carve-out** recorded in `expected_legend_required: false`.
- **Type-fit signature** (T-008): ≥3 edges with protocol-style labels; logical (non-VNet) zones.

### deployment

- **Zones**: workspace zone + data zone (or environment zones for staging/prod splits).
- **Edges**: build/deploy/data-flow edges. Labels: `AML SDK`, `ABFS`, `Pull` (image), `Deploy`.
- **Boundaries**: optional (workload-level deployment usually private).
- **Legend**: required — variant rationale (GPU SKU, ACR tier, Storage HNS) is the diagram's reason for being.
- **Type-fit signature** (T-008): variant-bearing icon labels (e.g., `(A100)`, `Gen2`, `Premium`); workspace + data zone containers.

## MCP tool-call sketch per type

All four types share the same MCP workflow (`search-shapes` → `create-groups` →
`add-cells` → `add-cells-to-group` → `finish-diagram`). The differences are in
**what** each batch contains, not **how** the calls are sequenced.

### logical / network — single-page

```text
search-shapes(queries: [all icons])
create-groups(groups: [VNet, RG, optional sub-scopes])  -- network adds more
add-cells(cells: [vertices + edges, transactional: true])
add-cells-to-group(assignments: [...])
finish-diagram(compress: true)
```

### sequence — single-page, no legend

Same as logical, but:

- Zone groups are logical (Ingress / Processing / Persistence), not VNet.
- Edge labels embed protocol + port or auth method.
- Skip the legend cell.

### deployment — single-page, variant-emphasis

Same as logical, but:

- Zone groups are workspace + data (or env-split).
- Cell labels include variant suffix in parens (`(A100)`, `(HNS)`, `Premium`).
- Legend lists each variant rationale (icons section + edge meanings section).

### Decomposed sets (any type at >50 resources)

Per [`large-architecture-decomposition.md`](large-architecture-decomposition.md),
emit one diagram per "page" with its own complete chain (`create-groups` →
`add-cells` → `add-cells-to-group` → `finish-diagram` → `save`), then merge.

## Anti-patterns observed in T-012 baseline

| Anti-pattern                                   | Captured in                                                                                                               | Correction                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Type forced to logical when prompt is sequence | G3 mostly avoided this (4/4 type-fit); G5 collapsed `logical+network` into a single page that scored layout 1/4           | Use the priority-1 explicit cue first; multi-type prompts go decomposed            |
| VNet zones used for logical/sequence diagrams  | n/a in baseline — agents got this right                                                                                   | n/a; preserve current behaviour                                                    |
| Legend rendered for sequence type              | G3 correctly omitted (matches `expected_legend_required: false`)                                                          | Maintain the carve-out explicitly per T-022 handoff                                |
| Wrong edge target                              | G3 drew `change feed` from Cosmos to Redis (should be Cosmos → Event Grid). Type-fit was correct; semantic-target was not | Out of scope for T-016 / T-008; needs `expected_edge_endpoints[]` schema extension |

## Cross-references

- [`quality-rubric.md`](quality-rubric.md) — Dimension 6 (Type-fit) anchored 0–4 scale
- [`abstraction-rules.md`](abstraction-rules.md) — what to show / omit per primary flow
- [`semantic-zones.md`](semantic-zones.md) — zone palette and templates per type
- [`legend-template.md`](legend-template.md) — copy-paste legend block
- [`large-architecture-decomposition.md`](large-architecture-decomposition.md) — decomposition tier rules
- Golden scenarios: `tools/tests/drawio-golden/g{1..7}/expected.json` `diagram_type` field

## Change control

Adding a new type:

1. Append a row to "The four types" table.
2. Add a "Type-specific expectations" subsection.
3. Add the MCP tool-call sketch.
4. Update [`tools/tests/drawio-golden/`](../../../../tools/tests/drawio-golden/) `expected.json` schema (`diagram_type` enum) at `tools/schemas/drawio-golden-scenario.schema.json`.
5. Update T-008 type-fit signature rules in [`validate-drawio-files.mjs`](../../../../tools/scripts/validate-drawio-files.mjs).
