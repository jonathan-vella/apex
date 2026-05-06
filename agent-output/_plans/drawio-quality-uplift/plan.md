# Draw.io Diagram Quality Uplift Plan

> **Plan ID:** `drawio-quality-uplift`
> **Generated:** 2026-05-05T14:42:09Z
> **Argument-hint received:** none (balanced coverage across all 7 pain-point categories)
> **Run scope:** Phase 0 (Current-State Audit) + Phase 1 (Target-State Design) deliverables. Phase 2 workstreams/tasks and Phase 3 validation strategy are **described**, not executed.
> **User gate decisions (post-Phase-1 review):** (a) backward compatibility is **NOT** required — WS-SHARED-COMPAT removed; (b) OQ-1 dispatch in agent; (c) OQ-2 legend relative to bounds with fixed-position override; (d) OQ-3 overlap false-positive ceiling fixed at <=5%.
> **Canonical task data:** [`backlog.json`](backlog.json) — this document is a navigation aid.

---

## Executive Summary

1. **Library is current; semantics and layout are the real gaps.** Azure icon library is at Microsoft V23-November-2025 (current); the bigger weaknesses are layout (no engine), semantics (no nested-zone templates), labels (manual legend), and type dispatch (single template).
2. **MCP server has no layout engine.** All 27 registered tools rely on caller-supplied coordinates; `suggest-group-sizing` is formula-based vertical stacking only. This is the single largest contributor to pain-point #2 (poor layout) and pain-point #7 (scaling).
3. **Validator covers structure and palette; not aesthetics or semantics.** `validate-drawio-files.mjs` enforces XML integrity, parent refs, APEX palette, and icon presence — but has no checks for overlap, density, semantic zones, type-fit, or legends. Five extensions close the deterministic gap.
4. **Agent emits a single diagram type.** `04-design.agent.md` generates `03-des-diagram.drawio` regardless of architecture pattern; logical/network/sequence/deployment differentiation is missing despite the workflow naming pattern (`04-dependency-*`, `04-runtime-*`) implying it.
5. **Legend is mandated but unenforced.** `validation-checklist.md` requires a legend; agent has no template; validator does not check for one.
6. **Regen/retry rate is invisible.** `benchmark-e2e.mjs` scores 8 dimensions but timing tracks duration only; `08-iteration-log.json` has no per-artifact retry field. We have no way to measure whether quality changes reduce regenerations.
7. **Three new MCP tools are proposed (all pure-Deno):** `auto-arrange`, `generate-legend`, `apply-zone-template`. Source confirms none of these capabilities exist today.
8. **Agent context budget protected by reference-first strategy.** Every design-agent task pushes detail into new skill references (`diagram-types.md`, `icon-variants.md`, `semantic-zones.md`, `legend-template.md`, `large-architecture-decomposition.md`); agent body net delta budgeted at <=80 lines across all P0/P1 tasks (411 -> <=491; well under 500-line skill ceiling, agent ceiling 350 retained for body).
9. **Backward compatibility is explicitly waived** by user gate decision; all uplift changes may freely re-render existing `.drawio` files. This removes one workstream (WS-SHARED-COMPAT) and one risk (R-4) from the plan and simplifies sequencing.
10. **Target outcome:** rubric average >=3/4 across all 7 dimensions on the golden-scenario set, and >=40% reduction in mean regeneration rate per `.drawio` vs. captured baseline.

---

## Current-State Assessment

Findings are organised first by **MCP tool surface** (the inventory required by the prompt), then by **pain-point category** with file/line evidence and the layer that owns each fix.

### MCP Tool Surface Inventory

Source: `tools/mcp-servers/drawio/src/`. Confirmed pure-Deno (deno.json `"version": "3.0.1"`, deps: MCP SDK v1.25, Hono v4.11, fast-xml-parser v5.3.4, fuzzy-search v3.2.1, Zod v4.2.1).

| Tool | File:line | Current capability | Gap relative to pain points |
| --- | --- | --- | --- |
| `add-cells` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L84) | Batch vertex/edge create; resolves `shape_name` to icon style+dims; temp IDs for intra-batch refs | #2: no layout auto-compute. #4: no semantic zone awareness. #7: caller manages all coords at >20. |
| `edit-cells` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L156) | Batch update of position/text/size/style | #2: no geometric normalisation. #7: no scaling strategy. |
| `delete-cell-by-id` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L44) | Single delete with cascade | #4 #5: no orphan-label cleanup. |
| `edit-edges` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L68) | Batch edge update; **strips** caller anchor overrides to force orthogonal routing; warns on duplicate labels | #2: orthogonal-only. #3: no edge-style presets. #5: warning only on dup labels. |
| `search-shapes` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1063) | Fuzzy across 700+ Azure icons + basic shapes; basic-shape priority then exact title then fuzzy | #1: no variant boost (premium / managed instance / hyperscale). |
| `get-shape-categories` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1000) | ~20 Azure categories + 2 basic | #1: no variant category. #4: no semantic role category. |
| `get-shapes-in-category` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1020) | Lists shapes per category | #1: depends on category granularity. |
| `set-cell-shape` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1090) | Batch shape reassignment | #1: no validation against current shape. |
| `get-style-presets` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L939) | Hardcoded Azure colors + edge styles | #3: **no fonts, no line weights, no theme variants — proposed expansion in WS-MCP-PRESETS.** |
| `create-groups` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1160) | Batch group create with manual sizing | #2 #4: caller pre-computes bounds; no nesting templates. |
| `add-cells-to-group` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1200) | Batch parent reassign | #4: no nesting-depth constraints. |
| `remove-cell-from-group` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1240) | Single ungroup | #4: no semantic cleanup. |
| `list-group-children` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1260) | Returns child IDs | #4: no hierarchy hints. |
| `validate-group-containment` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1285) | Visual-bounds check; advisory output | #2: no auto-fix. #4: structural only. |
| `suggest-group-sizing` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1320) | Formula-based vertical stacking | #2: not topology-aware. #7: simple stacking only. |
| `list-paged-model` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L197) | Paginated cell list with vertex/edge filter | #7: pagination only; no layout hints. |
| `get-diagram-stats` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L248) | Counts, bounds, layer distribution | #7: no density warning — proposed extension in T-031. |
| `list-layers` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L219) | Lists all layers | #4: structural only; no semantic role. |
| `set-active-layer` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L236) | Sets active layer | #4: no semantic tagging. |
| `create-layer` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L264) | Creates new layer | #4: no pre-seeded templates. |
| `move-cell-to-layer` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L276) | Moves cell across layers | #4: no semantic validation. |
| `export-diagram` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L290) | XML export with optional deflate compress | #7: no size guidance. |
| `finish-diagram` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L314) | Resolves placeholder cells to real SVGs **serially** | #7: serial bottleneck at >100 placeholders — proposed parallel resolution in T-030. |
| `import-diagram` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1380) | Imports XML; multi-page merge | #7: no incremental import. |
| `clear-diagram` | [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1370) | Clears all cells | (baseline) |

#### Capabilities NOT found in source (proposed new tools)

| Proposed tool | Rationale | Pain points addressed | Workstream |
| --- | --- | --- | --- |
| `auto-arrange` | No layout engine in source; all coords caller-supplied. Pure-Deno layered-graph layout proposed. | #2, #7 | WS-MCP-LAYOUT (T-025) |
| `detect-overlap` | `validate-group-containment` is bounds-only; no sibling AABB collision report. | #2 | WS-MCP-LAYOUT (T-026) |
| `generate-legend` | No tool emits legend cells; agent crafts ad-hoc each run. | #5 | WS-MCP-LEGEND-GEN (T-028) |
| `apply-zone-template` | No nesting templates for Subscription -> RG -> VNet -> Subnet. | #4, #7 | WS-MCP-ZONES-TEMPLATE (T-029) |

### Pain-point findings

Each row cites file/line evidence and identifies the owning layer for the fix. Layer codes: **AGT** = design agent, **MCP** = MCP server, **SHR** = shared (icon library / validator / fixtures / metrics / compat), **VAL** = validator subset of shared.

| # | Pain point | Current state | Evidence (file:line) | Owner |
| --- | --- | --- | --- | --- |
| 1 | Wrong/generic icons | Library current (V23-Nov-2025); 700+ icons; fuzzy match works; no variant boost; no manifest variant taxonomy. | [assets/drawio-libraries/azure-icons/manifest.json](assets/drawio-libraries/azure-icons/manifest.json), [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1063), [.github/skills/drawio/SKILL.md](.github/skills/drawio/SKILL.md#L46-L56) | SHR (manifest) + MCP (search ranking) + AGT (variant prompts) |
| 2 | Poor layout | Spacing rules in skill but no engine; orthogonal forced; cleanup script reports only. | [.github/skills/drawio/SKILL.md](.github/skills/drawio/SKILL.md#L129-L137), [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L197-L202), [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L1320) | MCP (engine) + VAL (overlap check) + AGT (existing rules) |
| 3 | Inconsistent styling | Palette defined; APEX-palette validator works; fonts/line-weights/themes missing in presets. | [.github/skills/drawio/references/style-reference.md](.github/skills/drawio/references/style-reference.md#L51-L78), [tools/scripts/validate-drawio-files.mjs](tools/scripts/validate-drawio-files.mjs#L529-L548), [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L939) | MCP (preset expansion) + AGT (use presets) + VAL (already partial) |
| 4 | Missing semantics | Groups exist for VNets/RGs; no subscription/region/trust-boundary templates; no nested-zone tool. | [.github/skills/drawio/references/abstraction-rules.md](.github/skills/drawio/references/abstraction-rules.md#L12-L20), [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L163-L165) | AGT (templates) + MCP (proposed apply-zone-template) + VAL (semantic check) |
| 5 | Weak labels / missing legend | Edge labels are simple strings; legend mandatory but manual; no auto-gen. | [.github/skills/drawio/references/validation-checklist.md](.github/skills/drawio/references/validation-checklist.md#L103-L119), [.github/skills/drawio/references/abstraction-rules.md](.github/skills/drawio/references/abstraction-rules.md#L55-L57) | AGT (legend template) + MCP (proposed generate-legend) + VAL (legend check) |
| 6 | Diagram type mismatch | Single template per project; no dispatch in agent; naming convention implies multiple types but workflow only emits one. | [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L23), [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L83-L86), [.github/skills/drawio/SKILL.md](.github/skills/drawio/SKILL.md#L268-L271) | AGT (dispatch + reference) + VAL (type-fit check) |
| 7 | Scaling >20 resources | Effort note + 25-call circuit breaker; no decomposition rules; finish-diagram is serial. | [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L135-L136), [.github/agents/04-design.agent.md](.github/agents/04-design.agent.md#L348-L355), [tools/mcp-servers/drawio/src/tools.ts](tools/mcp-servers/drawio/src/tools.ts#L314) | AGT (decomposition rules) + MCP (parallel resolve, layout) + VAL (density) |

### Validator coverage gaps (deterministic checks only)

`tools/scripts/validate-drawio-files.mjs` performs 14 structural checks plus icon-presence and APEX-palette compliance for architecture deliverables. Mapping to pain points:

| Pain point | Existing check | Proposed extension |
| --- | --- | --- |
| #1 icons | Icon embedding presence ([line 524](tools/scripts/validate-drawio-files.mjs#L524-L527)); base64 corruption ([line 323](tools/scripts/validate-drawio-files.mjs#L323-L390)) | (none — variant correctness is non-deterministic) |
| #2 layout | Group hierarchy ([line 467](tools/scripts/validate-drawio-files.mjs#L467-L495)); perimeter match ([line 392](tools/scripts/validate-drawio-files.mjs#L392-L408)) | T-006 sibling AABB overlap |
| #3 styling | APEX palette ([line 529](tools/scripts/validate-drawio-files.mjs#L529-L548)) | (covered) |
| #4 semantics | (none) | T-009 zone-presence at >10 resources |
| #5 labels | HTML escaping ([line 434](tools/scripts/validate-drawio-files.mjs#L434-L465)) | T-010 legend-presence at >8 image cells |
| #6 type-fit | (none) | T-008 filename-pattern signature |
| #7 scaling | (none) | T-007 density (cells per canvas page) |

### Sample real outputs inspected

- [site/public/demo/03-des-diagram.drawio](site/public/demo/03-des-diagram.drawio) (~23.5 KB): correctly embedded Azure icons, hierarchical VNet/Subnet nesting, orthogonal edges. Labels are simple strings; cross-cutting layer present but not marked as policy/audit; no legend cell.
- [site/public/demo/07-ab-diagram.drawio](site/public/demo/07-ab-diagram.drawio) (~35.2 KB): complex nested structure (App Service + staging slots + PE inside subnet). Container bounds large with minimal padding (overcrowding risk at 50+ resources); no protocol/SLA metadata on edges; no legend cell.

### Layer summary

| Layer | Files in scope | Lines (current) | Headroom |
| --- | --- | --- | --- |
| Design agent | `.github/agents/04-design.agent.md` | 411 | <=350 body ceiling per [context-optimization.instructions.md](.github/instructions/context-optimization.instructions.md) — currently above guideline; uplift MUST keep net delta tight and push detail to references. (Note: 411 > 350 reflects historical drift to be addressed separately; this plan adds at most ~80 net lines and pushes new content to references.) |
| Skill | `.github/skills/drawio/{SKILL.md, SKILL.digest.md, SKILL.minimal.md, references/, templates/}` | ~880 across all tiers | SKILL.md <=500 lines |
| MCP server | `tools/mcp-servers/drawio/` | ~1500 LOC src + 20 test files | Pure-Deno only |
| Validator | `tools/scripts/validate-drawio-files.mjs` | ~600 | Deterministic checks only |
| Icon library | `assets/drawio-libraries/azure-icons/` | 626 icons / 27 categories | Source: V23-November-2025 |
| Benchmark | `tools/scripts/benchmark-e2e.mjs` | ~750 | New dimension via `08-iteration-log.json.entries[].artifact_retries` |

### Out-of-scope items encountered

- **Python-diagrams** and **Mermaid** skills — explicitly out of scope per prompt; not modified.
- **Astro docs site** rendering of diagrams — out of scope; `site/public/demo/` files are *consumed* by docs but the rendering path is not changed.
- **Bicep/Terraform IaC** content — out of scope.

---
## Target-State Quality Rubric

A diagram is scored on **seven dimensions**, each on a 0-4 scale with anchored descriptors. Canonical version of this rubric ships in [`.github/skills/drawio/references/quality-rubric.md`](.github/skills/drawio/references/quality-rubric.md) (T-001) and is consumed by both the validator and benchmark scoring.

```text
Dimension: Icon correctness
0 — No Azure icons used (generic shapes only).
1 — Mix of Azure + generic shapes; >25% generic.
2 — All Azure shapes, but wrong service variants for >25% of nodes.
3 — All Azure shapes, correct families, but stale icon-set version.
4 — Current Microsoft icon-set release, correct service variant for
    100% of nodes, with consistent sizing.
```

```text
Dimension: Layout
0 — Cells overlap; edges cross arbitrarily; no whitespace.
1 — Some overlap or >5 edge crossings; spacing inconsistent.
2 — No overlap among siblings, but spacing varies; orthogonal edges
    not enforced; canvas density >1 cell per 4000 sq-px.
3 — No overlap; orthogonal edges; spacing within +/- 20% of skill
    minima (120/80/40 px); density within target band.
4 — No overlap; orthogonal edges; spacing within +/- 10% of skill
    minima; main flow left-to-right; cross-cutting services placed
    per skill rules; canvas density at or below target.
```

```text
Dimension: Styling
0 — Default Draw.io shapes; no APEX palette; mixed font sizes.
1 — APEX palette partially used (<50% cells); typography drift
    (>2 font sizes outside 14-16/12/11/10/9 pt convention).
2 — APEX palette on >=75% cells; typography mostly aligned;
    line-weights inconsistent.
3 — APEX palette on 100% cells; typography aligned; line weights
    consistent within each role; theme uniform.
4 — All of #3 plus: explicit theme variant tagged (light / dark /
    print); edge styles match role (solid for sync, dashed for
    async, dotted for monitoring) per style-reference.md.
```

```text
Dimension: Semantics (zones / regions / subscriptions / trust boundaries)
0 — No grouping; cells live on root layer.
1 — Some VNet or RG groups; no subscription/region/trust-boundary
    semantics.
2 — VNet, RG, and subnet groups present; no cross-cutting semantic
    layers (no subscription scope, no region label, no trust
    boundary).
3 — VNet/RG/subnet plus at least one of: subscription scope, region
    label, trust boundary; nesting hierarchy correct.
4 — Full nesting per semantic-zones.md (subscription -> RG -> VNet
    -> subnet); trust-boundary perimeter explicit; multi-region
    diagrams label each region; external/internet box distinct
    from on-prem box where applicable.
```

```text
Dimension: Labelling (incl. legend & annotations)
0 — Cells unlabelled or labelled only by shape ID; no edge labels;
    no legend.
1 — Cell labels present but generic ("VM 1"); edge labels missing
    or duplicated; no legend.
2 — Cell labels descriptive; edge labels for primary flow only
    (protocol or verb); legend missing.
3 — Cell labels include service tier where relevant; edge labels
    cover all primary flows with protocol/port; legend present
    but partial (icons only, missing color or edge swatches).
4 — Cell labels per resource (name + region + tier); edge labels
    include protocol + port + auth method; full legend per
    legend-template.md (icon, color, edge-style swatches).
```

```text
Dimension: Type-fit (logical / network / sequence / deployment)
0 — Single template forced; no differentiation by diagram purpose.
1 — Diagram type loosely chosen; signatures inconsistent (e.g.,
    sequence diagram drawn as logical).
2 — Diagram type matches workload (logical, network, sequence,
    deployment); signatures partial.
3 — Type-fit by filename pattern (03-des-* logical, 04-dependency-*
    dependency, 04-runtime-* runtime/sequence, 07-ab-* as-built);
    expected signatures present per diagram-types.md.
4 — All of #3 plus: per-type validator signature checks pass
    (T-008); per-type label and zone conventions applied.
```

```text
Dimension: Scalability (architectures with >20 / >50 resources)
0 — Tool-call ceiling hit before completion; diagram unfinished;
    or canvas overflows page bounds at >20 resources.
1 — Diagram completes but density >1 cell per 2500 sq-px; visual
    crowding; cross-cutting services indistinguishable.
2 — Diagram completes within agent ceiling; density at threshold;
    no decomposition (single page).
3 — At >20 resources, agent applies decomposition (overview +
    detail) per large-architecture-decomposition.md; density
    within target.
4 — All of #3 plus: at >50 resources uses paginated <diagram>
    pages or hierarchical clustering; finish-diagram serial
    bottleneck mitigated by parallel resolution (T-030); legend
    and zone labels remain legible.
```

**Aggregate scoring:** mean across the 7 dimensions, computed per golden scenario. Acceptance bar for the uplift: mean >=3/4 across all 7 dimensions averaged across the golden-scenario set, with no single dimension scoring 0 on any scenario.

---

## Golden Scenarios

Seven fixed scenarios stored at `tools/tests/drawio-golden/<id>/{prompt.md, expected.json}` (T-002, delivered). Every pain-point category is exercised by at least one scenario; the matrix is shown after the scenario list.

### G1 — Three-Tier Web App (small, ~8 resources)

- **Input prompt summary:** "Generate a logical architecture for a small three-tier web app: App Service Plan + Web App, Azure SQL Database (Standard), Storage Account, Key Vault, Application Insights. Single subscription, single region (Sweden Central)."
- **Expected diagram type:** logical
- **Expected element count range:** 6-10 resources, 1 RG group, 0-1 VNet group
- **Expected boundaries:** RG only; no subscription/region zone labels (single-sub/single-region defaults).
- **Pain points exercised:** #1 (icons), #3 (styling), #5 (labels), #6 (type-fit).

### G2 — Hub-Spoke Landing Zone (medium, ~15 resources)

- **Input prompt summary:** "Hub-spoke topology with one connectivity sub (Hub VNet, Azure Firewall, ExpressRoute Gateway) and two workload subs (App + Data). Trust boundary between hub and spokes; PEs in dedicated subnet."
- **Expected diagram type:** network
- **Expected element count range:** 12-18 resources, 3 subscription groups, 3-4 VNet groups, 5+ subnet groups
- **Expected boundaries:** subscription scope (3), trust-boundary perimeter (1), region label (1).
- **Pain points exercised:** #2 (layout), #3 (styling), #4 (semantics).

### G3 — Event-Driven Microservices (medium, ~12 resources)

- **Input prompt summary:** "Event-driven order-processing system: API Management, 3 Container Apps, Service Bus (topics + subscriptions), Event Grid, Cosmos DB (Serverless), Azure Cache for Redis."
- **Expected diagram type:** sequence (runtime/data-flow)
- **Expected element count range:** 10-14 resources; 6+ edge labels with protocol+port+auth.
- **Expected boundaries:** logical zones (ingress, processing, persistence) rather than network zones.
- **Pain points exercised:** #3 (styling), #5 (labels — data flows), #6 (type-fit — sequence).

### G4 — ML Training Pipeline (medium, ~10 resources)

- **Input prompt summary:** "Azure Machine Learning training pipeline: Workspace, Compute Cluster (GPU - NC-series), Data Lake Gen2, Container Registry (Premium), Key Vault, Application Insights, Storage Account (with hierarchical namespace)."
- **Expected diagram type:** deployment
- **Expected element count range:** 9-12 resources; variant-specific icons (GPU compute, ACR Premium, ADLS Gen2).
- **Expected boundaries:** RG; ML workspace zone; data zone.
- **Pain points exercised:** #1 (icons — variants), #4 (semantics).

### G5 — Enterprise Landing Zone (large, ~25 resources)

- **Input prompt summary:** "Single-region enterprise landing zone: management group hierarchy (4 MGs), 5 subscriptions (platform, connectivity, identity, app-shared, app-workload), Hub VNet with Azure Firewall + Bastion + VPN GW, two spoke VNets, AKS cluster, Container Registry, Key Vault, Log Analytics + Sentinel, Defender for Cloud."
- **Expected diagram type:** network + logical (overview)
- **Expected element count range:** 22-28 resources; 5 subscription groups; 3-4 VNet groups.
- **Expected boundaries:** management group hierarchy, subscription scopes, trust boundary, region label.
- **Pain points exercised:** #2 (layout), #4 (semantics), #7 (scaling).

### G6 — Hyperscale Platform (extra-large, ~55 resources)

- **Input prompt summary:** "Multi-region hyperscale platform: 2 regions (Sweden Central + Germany West Central), 3 subscriptions per region (platform, app, data), 2 AKS clusters per region, Front Door + Traffic Manager, Cosmos DB (multi-master), Event Hubs (dedicated cluster), Synapse workspace, Purview, full observability stack."
- **Expected diagram type:** decomposed — 1 overview + 2 region-detail diagrams
- **Expected element count range:** 50-60 resources across diagrams; per-diagram <=30.
- **Expected boundaries:** 2 region labels, 6 subscription scopes, multi-master replication links visible.
- **Pain points exercised:** #2 (layout), #7 (scaling >50).

### G7 — Multi-Region Active-Active (medium, ~18 resources)

- **Input prompt summary:** "Active-active web platform across two regions with Front Door, paired App Services, Cosmos DB (multi-region writes), Storage GZRS, Key Vault per region, shared Log Analytics."
- **Expected diagram type:** logical with explicit region zones
- **Expected element count range:** 16-20 resources; 2 region labels; 2 paired groups.
- **Expected boundaries:** 2 region zones, trust boundary at Front Door (public ingress).
- **Pain points exercised:** #4 (semantics — regions, trust boundary), #5 (labels — replication flows), #6 (type-fit).

### Pain-point coverage matrix

| Pain point | G1 | G2 | G3 | G4 | G5 | G6 | G7 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| #1 Icons | x |   |   | x |   |   |   |
| #2 Layout |   | x |   |   | x | x |   |
| #3 Styling | x | x | x |   |   |   |   |
| #4 Semantics |   | x |   | x | x |   | x |
| #5 Labels | x |   | x |   |   |   | x |
| #6 Type-fit | x |   | x |   |   |   | x |
| #7 Scaling |   |   |   |   | x | x |   |

Every pain-point category is exercised by **at least one** scenario; per the prompt's acceptance criterion this is sufficient.

---

## Workstreams

Workstreams are the unit of PR delivery in Phase 2. The three subsections below are mutually exclusive (no implicit blending). Per-task detail (acceptance criteria, dependencies, effort, constraint flags) lives canonically in [`backlog.json`](backlog.json); this section provides rationale and pain-point linkage.

### Design Agent Workstreams

#### WS-AGENT-TYPE-DISPATCH — Diagram type dispatch in 04-Design

- **Rationale.** Agent emits a single architecture diagram per project ([04-design.agent.md L23](.github/agents/04-design.agent.md#L23)); the workflow's filename convention (`03-des-*`, `04-dependency-*`, `04-runtime-*`, `07-ab-*`) implies four diagram types but no dispatch logic exists. Adding dispatch in the agent body costs context budget; pushing detail to a new `references/diagram-types.md` keeps the agent lean.
- **Tasks.** T-015 (P0/M, agent body delta <=30 lines), T-016 (P0/M, new reference file).
- **Acceptance criteria.** See backlog.json. Net agent body delta <=30 lines verified by `agent-frontmatter` and `context-optimization` linters.
- **Risks.** Dispatch logic could become brittle if `decisions.architecture_type` is not consistently populated upstream — see R-3.
- **Pain points resolved.** #6 (type-fit), with side benefits to #4 (semantics — type-specific zones) and #5 (labels — type-specific conventions).

#### WS-AGENT-ICONS-VARIANTS — Variant-aware icon prompting

- **Rationale.** Library is current; gap is at the prompt layer where ambiguous queries resolve to family defaults (e.g., "App Service Plan" -> Standard tier icon when prompt implied Premium).
- **Tasks.** T-017 (P1/S, agent body delta <=10 lines), T-018 (P1/M, new reference file).
- **Acceptance criteria.** Conditional `get-shape-categories` step inserted in agent's 8-step sequence; cross-references manifest variant taxonomy from T-004.
- **Risks.** Adds tool calls to every run; mitigated by gating on `decisions.includes_paas_variants` (R-3).
- **Pain points resolved.** #1 (icons).

#### WS-AGENT-SEMANTICS-TEMPLATES — Semantic zone templates

- **Rationale.** Skill covers VNet/RG groups but not subscription scope, region label, trust-boundary perimeter, or external/internet zones. Templates belong in skill references, not agent body.
- **Tasks.** T-019 (P0/M, new reference file), T-020 (P1/S, agent body delta <=15 lines).
- **Acceptance criteria.** Copy-pasteable mxCell snippets per zone type; nesting rules documented.
- **Risks.** Conflicts with `apply-zone-template` MCP tool (T-029) if both implemented — mitigation: agent calls T-029 when available, falls back to manual template; documented in T-019.
- **Pain points resolved.** #4 (semantics).

#### WS-AGENT-LABELS-LEGEND — Legend & annotation conventions

- **Rationale.** Validation-checklist mandates legend ([validation-checklist.md L103-L119](.github/skills/drawio/references/validation-checklist.md#L103-L119)) but no copy-paste template exists; agent crafts legend ad-hoc each run, which the regen-rate metric (T-011) is expected to confirm as a top contributor to retries.
- **Tasks.** T-021 (P0/M, new reference file), T-022 (P1/S, agent body delta <=10 lines).
- **Acceptance criteria.** Legend block matches APEX palette; sequence diagrams exempt; validator T-010 enforces presence at >8 image cells.
- **Risks.** None significant; backwards-compat preserved (legend is additive).
- **Pain points resolved.** #5 (labels).

#### WS-AGENT-SCALING-DECOMP — Large-graph decomposition strategy

- **Rationale.** Agent has only an effort note for >20 resources ([04-design.agent.md L135-L136](.github/agents/04-design.agent.md#L135-L136)) and a fixed 25-call circuit breaker ([04-design.agent.md L348-L355](.github/agents/04-design.agent.md#L348-L355)). No rules for splitting into overview + detail or paginating across `<diagram>` pages.
- **Tasks.** T-023 (P0/M, new reference file), T-024 (P1/S, agent body delta <=10 lines).
- **Acceptance criteria.** Tier breakpoints (<=8, 9-20, 21-50, >50); circuit-breaker dynamic by resource count; rationale logged in agent body.
- **Risks.** Decomposition increases artifact count per run (overview + N details); validator and benchmark must accommodate (R-6).
- **Pain points resolved.** #7 (scaling).

### MCP Server Workstreams

> **Hard constraint reminder.** All MCP-server tasks MUST be pure-Deno: standard library + existing deno.json deps only. New deps require explicit Deno-compatibility justification per task.

#### WS-MCP-LAYOUT — Auto-arrange / hierarchical layout (proposed new capability)

- **Rationale.** Source has no layout engine; `suggest-group-sizing` is formula-based vertical stacking only. This is the single largest contributor to pain-point #2 (poor layout) and pain-point #7 (scaling). A pure-Deno port of a layered-graph algorithm (dagre-style) is the proposed approach.
- **Tasks.** T-025 (P1/L, new `auto-arrange` tool), T-026 (P1/M, new `detect-overlap` tool).
- **Acceptance criteria.** 50-vertex layout in <200ms on Deno bench; backward-compat preserved (existing diagrams unaffected unless tool explicitly invoked).
- **Risks.** Complexity of porting dagre to pure Deno (R-1); mitigation is to scope to a layered-flow subset, not full dagre feature set.
- **Pain points resolved.** #2 (layout), #7 (scaling).

#### WS-MCP-PRESETS — Expanded style presets

- **Rationale.** `get-style-presets` returns colors and edge styles only ([tools.ts L939](tools/mcp-servers/drawio/src/tools.ts#L939)); fonts, line weights, and theme variants are missing. Skill prescribes 14-16/12/11/10/9pt typography but agent has no preset to enforce.
- **Tasks.** T-027 (P1/S, extension only).
- **Acceptance criteria.** Backward-compat preserved (existing presets unchanged); new preset keys additive.
- **Pain points resolved.** #3 (styling).

#### WS-MCP-LEGEND-GEN — Legend generation tool (proposed new capability)

- **Rationale.** No tool emits legend cells; agent crafts legend ad-hoc. Server-side generation uses authoritative diagram state (icons in use, edge-label tokens) rather than agent recall.
- **Tasks.** T-028 (P1/M, new `generate-legend` tool).
- **Acceptance criteria.** Idempotent (re-invocation updates rather than duplicates); template consistent with T-021.
- **Pain points resolved.** #5 (labels).

#### WS-MCP-ZONES-TEMPLATE — Nested-zone template tool (proposed new capability)

- **Rationale.** `create-groups` + `add-cells-to-group` exist but require manual nesting; no template for Subscription -> RG -> VNet -> Subnet hierarchy.
- **Tasks.** T-029 (P1/M, new `apply-zone-template` tool).
- **Acceptance criteria.** Pure-Deno; tests cover single-sub / multi-sub / multi-region.
- **Pain points resolved.** #4 (semantics), #7 (scaling — nested decomposition).

#### WS-MCP-SCALE-PERF — Parallel placeholder resolution

- **Rationale.** `finish-diagram` resolves placeholders serially ([tools.ts L314](tools/mcp-servers/drawio/src/tools.ts#L314)); icon cache is in-memory and Deno is single-threaded, making `Promise.all` batching safe.
- **Tasks.** T-030 (P1/M, parallel resolution), T-031 (P2/S, density warning extension to `get-diagram-stats`).
- **Acceptance criteria.** >=3x throughput at 100 placeholders; XML output bytes unchanged vs. serial path (backcompat).
- **Pain points resolved.** #7 (scaling).

#### WS-MCP-SEARCH-VARIANTS — Variant-aware shape search

- **Rationale.** `search-shapes` priorities (basic > exact title > fuzzy) do not boost variant matches when query mentions tier/SKU keywords.
- **Tasks.** T-032 (P1/M, ranker extension).
- **Acceptance criteria.** Consumes manifest.variants{} from T-004; no regression on existing tests.
- **Pain points resolved.** #1 (icons).

### Shared Workstreams

#### WS-SHARED-RUBRIC — Diagram quality rubric (canonical)

- **Rationale.** Validation-checklist references a 10-point rubric, but no canonical 0-4 scale per dimension exists. Validator extensions, benchmark scoring, and agent self-checks all need a single source of truth.
- **Tasks.** T-001 (P0/M, new reference file).
- **Pain points resolved.** All 7.

#### WS-SHARED-GOLDEN — Golden scenario fixtures

- **Rationale.** Today each PR is judged on ad-hoc projects; no stable evaluation set; no before/after comparison.
- **Tasks.** T-002 (P0/L, fixture pack), T-003 (P1/M, render-golden-diff orchestrator).
- **Acceptance criteria.** Per backlog.json; coverage matrix above.
- **Pain points resolved.** All 7.

#### WS-SHARED-VALIDATOR — Validator extensions

- **Rationale.** Validator's deterministic checks miss overlap, density, semantic-zone, type-fit, and legend dimensions. Each gap maps to a specific extension below.
- **Tasks.** T-006 (P0/M, overlap), T-007 (P0/S, density), T-008 (P1/S, type-fit), T-009 (P1/M, semantic zones), T-010 (P0/S, legend).
- **Acceptance criteria.** All extensions advisory by default; `APEX_DRAWIO_RUBRIC=strict` promotes to error; false-positive rate <=5% on existing repo `.drawio` inventory.
- **Risks.** False positives blocking builds (R-2); mitigation is the strict-mode opt-in plus tuning over the golden-scenario baseline.
- **Pain points resolved.** #2, #4, #5, #6, #7.

#### WS-SHARED-ICONS-MANIFEST — Icon manifest enrichment + freshness check

- **Rationale.** `manifest.json` records `sourceVersion: V23-November-2025` but has no per-service variant taxonomy and no automated drift detection.
- **Tasks.** T-004 (P0/M, variant taxonomy), T-005 (P1/S, freshness check).
- **Pain points resolved.** #1 (icons).

#### WS-SHARED-METRICS — Benchmark regen/retry-rate metric

- **Rationale.** `benchmark-e2e.mjs` has no per-artifact retry tracking ([benchmark-e2e.mjs L336-L357](tools/scripts/benchmark-e2e.mjs#L336-L357)); `08-iteration-log.json` schema lacks the field. Without this, we cannot measure whether quality changes reduce regenerations.
- **Tasks.** T-011 (P0/M, schema + scoring) — DELIVERED; schema enforced via `.vscode/settings.json` json.schemas association (same pattern as `lesson-log.schema.json`). T-012 (P0/S, baseline capture), T-033 (P0/M, orchestrator script).
- **Acceptance criteria.** New `regenerationRate` dimension in `08-benchmark-scores.json`; baseline stored at `tests/fixtures/drawio-baseline/regen-baseline.json`.
- **Pain points resolved.** All 7 (cross-cutting metric).

---
## Validation Strategy

Each Phase 2 change is verified along three axes plus the validator extension axis. All four are required for a workstream to merge.

### 1. Golden-scenario regeneration

- For each Phase 2 PR, regenerate the affected golden scenarios end-to-end through the real `04-Design` agent (no mocks).
- Diff/inspection checklist (per scenario):
  1. Diagram opens in Draw.io desktop without errors (manual smoke).
  2. Element count within `expected.json` range.
  3. Expected zones present (per `expected.json.expected_zones[]`).
  4. Expected edge labels present (per `expected.json.expected_edge_labels[]`).
  5. Legend present unless type=sequence.
  6. Validator extensions all PASS (advisory + strict mode).
- Storage: regenerated artifacts saved under `agent-output/_bench/drawio-quality-uplift/<run-id>/<scenario-id>/` (preserving raw `.drawio` + `.png` plus the agent's iteration log).

### 2. Side-by-side before/after rendering

- `tools/scripts/render-golden-diff.mjs` (T-003) renders each fixture pre-change (from baseline snapshot) and post-change side-by-side.
- Produces an HTML index with paired panels per scenario; reviewer confirms visual delta is intentional.
- Storage: `agent-output/_bench/drawio-quality-uplift/<run-id>/diff-index.html`.

### 3. Regen/retry-rate measurement (cross-cutting metric)

- **Metric:** mean retries per `.drawio` artifact generated (counted from `08-iteration-log.json.entries[].artifact_retries`). Aggregated across the 7 golden scenarios.
- **Integration point:** [`tools/scripts/benchmark-e2e.mjs`](tools/scripts/benchmark-e2e.mjs) extended via T-011 to read the new `artifact_retries` field and aggregate by `*.drawio` filename pattern. Reported as a new dimension `regenerationRate` (0-100 score) in `08-benchmark-scores.json`. Score formula: `100 * max(0, 1 - (current_mean / baseline_mean))`, capped at 100; rationale documented in T-011 acceptance criteria.
- **Baseline-capture procedure (T-012):**
  1. Snapshot current `main` HEAD (commit SHA recorded).
  2. Run `npm run e2e:benchmark` over the 7 golden scenarios with a clean `08-iteration-log.json` per scenario.
  3. Compute mean retries per `.drawio` and per-scenario retries.
  4. Store as `tests/fixtures/drawio-baseline/regen-baseline.json` with fields: `commit_sha`, `captured_at`, `mean_retries_per_drawio`, `per_scenario`.
- **Storage location for post-change samples:** `agent-output/_bench/drawio-quality-uplift/<run-id>/regen-rate.json` per run; the orchestrator (T-033) emits a comparison summary against the baseline.
- **Target reduction:** **>=40% reduction** in mean retries per `.drawio`. Rationale: today's mean is approximately 1.4 retries per `.drawio` (estimate based on observed agent loops in recent runs; T-012 will pin the exact baseline). A 40% reduction lands the metric below 1.0 (i.e., most diagrams succeed first try), which is the practical bar for "uplift achieved."

### 4. Validator extensions (deterministic checks)

- All five extensions (T-006 through T-010) ship advisory by default with `APEX_DRAWIO_RUBRIC=strict` escalating to error, matching the existing palette-check pattern at [`validate-drawio-files.mjs` L529-L548](tools/scripts/validate-drawio-files.mjs#L529-L548).
- Each PR adds at least the relevant validator check before the corresponding agent/MCP behaviour change.
- **Aesthetic judgements are explicitly out of scope** for the validator (consistent with existing scope); aesthetic dimensions are scored by the rubric on golden scenarios only.

### Orchestration

`tools/scripts/run-drawio-quality-bench.mjs` (T-033) runs the full validation cycle in one command:

1. Run validator suite over fixtures + repo `.drawio` inventory.
2. Regenerate golden scenarios via the agent.
3. Render side-by-side diffs.
4. Compute regen-rate vs. baseline.
5. Emit consolidated PASS/FAIL summary.

Wired as `npm run bench:drawio-quality`. Acceptance gate for Phase 3: this command exits 0 with all four axes PASS.

---

## Roll-out & Sequencing

### Phase ordering

1. **Phase 0 (this run): Current-State Audit.** Already complete — see `## Current-State Assessment`. Gate: user approval to proceed.
2. **Phase 1 (this run): Target-State Design.** Already complete — see `## Target-State Quality Rubric` and `## Golden Scenarios`. Gate: user approval to proceed.
3. **Phase 2: Implementation.** Per-workstream PRs. Order:
   1. Foundation: T-001 (rubric), T-002 (goldens), T-011 (metrics schema).
   2. Capture baseline: T-012 (depends on T-002, T-011).
   3. Validator extensions (parallel where possible): T-006, T-007, T-009, T-010, T-008.
   4. Skill references (parallel): T-016, T-018, T-019, T-021, T-023.
   5. Agent body deltas (sequential, gated on linters): T-015, T-017, T-020, T-022, T-024.
   6. MCP server tasks (parallel): T-027, T-030, T-026, T-032, T-028, T-029, T-025, T-031.
4. **Phase 3: Validation & roll-out.** T-033 (orchestrator), T-003 (diff render), T-034 (review checklist). Gate: acceptance review against rubric and regen-rate target.

### Dependencies

Inter-task dependencies are encoded in `backlog.json` per task. Notable cross-workstream dependencies:

- T-006 (overlap validator) -> T-002 (goldens) — overlap check tuned against the golden-scenario fixtures and existing repo `.drawio` inventory to keep false-positive rate <=5%.
- T-008 (type-fit validator) -> T-016 (diagram-types reference) — signatures defined in the reference are the validator's source of truth.
- T-010 (legend validator) -> T-021 (legend template) — the template defines what the validator looks for.
- T-017/T-018 (variant prompts) -> T-004 (manifest variant taxonomy) — agent reads taxonomy data.
- T-032 (variant ranker) -> T-004 — ranker reads taxonomy data.
- T-022 (legend handoff) -> T-015 (type dispatch) + T-021 (legend template) — handoff exempts type=sequence and points at the template.
- T-024 (dynamic circuit-breaker) -> T-023 (decomposition rules) — escalation path defers to decomposition at >50.
- T-031 (density warning) -> T-001 (rubric) + T-007 (validator threshold) — same threshold across all three.
- T-033 (orchestrator) -> T-002 + T-003 + T-011.

### Feature-flag / escape-hatch strategy

- **Validator extensions:** all default to advisory; `APEX_DRAWIO_RUBRIC=strict` opts into blocking. CI runs strict on `main` and PRs targeting `main`. Per OQ-3 decision, overlap detection (T-006) tunes its <=5% false-positive ceiling against the golden-scenario fixtures before any strict-mode promotion.
- **MCP new tools (T-025, T-026, T-028, T-029):** additive. Existing agent invocations do not call them; opt-in by agent body update. No global flag needed.
- **Parallel resolve (T-030):** behind env var `DRAWIO_MCP_PARALLEL_RESOLVE=1` initially; flipped to default-on after one release with no regressions.
- **Style preset expansion (T-027):** additive; existing keys unchanged.
- **Manifest variant taxonomy (T-004):** additive data; consumers (T-018, T-032) read with safe defaults when missing.

### Backward compatibility

Explicitly **waived** by user gate decision. Existing `.drawio` files in `site/public/demo/`, `.github/skills/drawio/templates/`, and `agent-output/**/` may re-render under the post-change MCP without migration; no parity check is required.

### Hard-constraint compliance (re-stated)

- **Agent context size budget** ([context-optimization.instructions.md](.github/instructions/context-optimization.instructions.md), agent body <=350 lines, skill SKILL.md <=500 lines). Every `design-agent`-scope task in the backlog sets `constraint_check.agent_context_safe = true` with rationale that pushes detail to skill references. Aggregate net delta to `04-design.agent.md`: <=80 lines (411 -> <=491). The current 411-line baseline already exceeds the 350-line guideline; bringing the body back under 350 is a separate refactor task NOT included in this plan and called out as risk R-3.
- **Pure-Deno MCP server** (`tools/mcp-servers/drawio/`). Every `mcp-server`-scope task sets `constraint_check.mcp_pure_deno = true`. T-025 (auto-arrange) is the highest-risk item; the acceptance criteria explicitly forbid new external deps unless Deno-compatible and justified per-task.

---

## Risks & Open Questions

### Resolved decisions (post-Phase-1 user gate)

| id | decision | rationale |
| --- | --- | --- |
| D-BC | Backward compatibility waived | User gate decision; uplift changes may re-render existing `.drawio` files freely. WS-SHARED-COMPAT (T-013, T-014) and risk R-4 removed from plan. |
| D-OQ1 | Diagram-type dispatch lives in `04-Design` agent (T-015 + reference T-016); no new MCP tool | Workflow-state-driven; keeps MCP server portable and free of APEX session-state coupling. Recorded in T-015 acceptance. |
| D-OQ2 | `generate-legend` (T-028) positions legend relative to current diagram bounds, with optional caller-supplied fixed x/y override | Sensible default + escape hatch; balances simplicity and flexibility. Recorded in T-028 acceptance. |
| D-OQ3 | Overlap-detection validator (T-006) targets <=5% false-positive ceiling against golden fixtures + existing repo `.drawio` inventory | Matches existing palette-check tolerance pattern. Recorded in T-006 acceptance. |

### Open risks

| id | risk | likelihood | impact | mitigation | owner |
| --- | --- | :-: | :-: | --- | --- |
| R-1 | Pure-Deno layered-graph layout (T-025) is non-trivial; dagre is JS but not packaged for Deno; pure rewrite risks scope creep. | M | H | Scope to layered-flow subset (rank assignment + ordering + coordinate assignment); ship behind opt-in tool call; benchmark target of 200ms for 50 vertices is the cap, not full dagre parity. | MCP team |
| R-2 | Validator extensions (T-006 overlap, T-009 zones) generate false positives on legitimate but unusual diagrams, blocking builds. | M | M | Default to advisory; tune thresholds against existing `.drawio` inventory before strict-mode promotion; require <=5% false-positive rate as merge gate (T-006 acceptance). | Shared/Validator |
| R-3 | `04-design.agent.md` is already 411 lines (above 350-line guideline); adding type-dispatch + variant + legend + decomposition pointers risks further drift. | M | M | Aggregate net delta budgeted at <=80 lines; all detail pushed to new skill references; separate refactor to bring body under 350 lines is tracked outside this plan. Add `agent-frontmatter` and `context-optimization` linters to PR gate. | Agent team |
| R-4 | Microsoft icon-set version drifts mid-cycle (V23 -> V24); local manifest goes stale; freshness check (T-005) fails on legitimate drift. | L | M | Freshness check warns rather than fails; quarterly icon-library refresh task (out of plan scope) bumps `sourceVersion`; T-005 documents the refresh procedure. | Icon library |
| R-5 | Decomposition (T-023) at >20 resources increases artifact count per run (overview + details); benchmark and validator must accommodate multi-file outputs per Step 3. | M | M | T-008 (type-fit) extends to detail-diagram filename patterns; benchmark `artifactCompleteness` dimension treats decomposed sets as a single unit (documented in T-011 / T-023). | Shared/Metrics |
| R-6 | Parallel placeholder resolution (T-030) introduces non-determinism in error ordering when multiple icons fail to resolve. | L | L | Wrap `Promise.allSettled` and sort errors by placeholder index before reporting; tests assert deterministic ordering. | MCP team |

---

## Backlog Index

Canonical task data: [`backlog.json`](backlog.json). The table below is a navigation aid only; field semantics defined in the prompt's backlog JSON shape.

| ID | Workstream | Subsection | Scope | Priority | Phase | Pain points |
| --- | --- | --- | --- | :-: | --- | --- |
| T-001 | WS-SHARED-RUBRIC | Shared | shared | P0 | P2 | all |
| T-002 | WS-SHARED-GOLDEN | Shared | shared | P0 | P2 | all |
| T-003 | WS-SHARED-GOLDEN | Shared | shared | P1 | P3 | all |
| T-004 | WS-SHARED-ICONS-MANIFEST | Shared | icon-library | P0 | P2 | icons |
| T-005 | WS-SHARED-ICONS-MANIFEST | Shared | icon-library | P1 | P2 | icons |
| T-006 | WS-SHARED-VALIDATOR | Shared | validator | P0 | P2 | layout |
| T-007 | WS-SHARED-VALIDATOR | Shared | validator | P0 | P2 | scaling |
| T-008 | WS-SHARED-VALIDATOR | Shared | validator | P1 | P2 | type-mismatch |
| T-009 | WS-SHARED-VALIDATOR | Shared | validator | P1 | P2 | semantics |
| T-010 | WS-SHARED-VALIDATOR | Shared | validator | P0 | P2 | labels |
| T-011 | WS-SHARED-METRICS | Shared | shared | P0 | P2 | all |
| T-012 | WS-SHARED-METRICS | Shared | shared | P0 | P3 | all |
| T-015 | WS-AGENT-TYPE-DISPATCH | Design Agent | design-agent | P0 | P2 | type-mismatch, semantics, labels |
| T-016 | WS-AGENT-TYPE-DISPATCH | Design Agent | design-agent | P0 | P2 | type-mismatch, semantics, labels |
| T-017 | WS-AGENT-ICONS-VARIANTS | Design Agent | design-agent | P1 | P2 | icons |
| T-018 | WS-AGENT-ICONS-VARIANTS | Design Agent | design-agent | P1 | P2 | icons |
| T-019 | WS-AGENT-SEMANTICS-TEMPLATES | Design Agent | design-agent | P0 | P2 | semantics |
| T-020 | WS-AGENT-SEMANTICS-TEMPLATES | Design Agent | design-agent | P1 | P2 | semantics |
| T-021 | WS-AGENT-LABELS-LEGEND | Design Agent | design-agent | P0 | P2 | labels |
| T-022 | WS-AGENT-LABELS-LEGEND | Design Agent | design-agent | P1 | P2 | labels |
| T-023 | WS-AGENT-SCALING-DECOMP | Design Agent | design-agent | P0 | P2 | scaling |
| T-024 | WS-AGENT-SCALING-DECOMP | Design Agent | design-agent | P1 | P2 | scaling |
| T-025 | WS-MCP-LAYOUT | MCP Server | mcp-server | P1 | P2 | layout, scaling |
| T-026 | WS-MCP-LAYOUT | MCP Server | mcp-server | P1 | P2 | layout |
| T-027 | WS-MCP-PRESETS | MCP Server | mcp-server | P1 | P2 | styling |
| T-028 | WS-MCP-LEGEND-GEN | MCP Server | mcp-server | P1 | P2 | labels |
| T-029 | WS-MCP-ZONES-TEMPLATE | MCP Server | mcp-server | P1 | P2 | semantics, scaling |
| T-030 | WS-MCP-SCALE-PERF | MCP Server | mcp-server | P1 | P2 | scaling |
| T-031 | WS-MCP-SCALE-PERF | MCP Server | mcp-server | P2 | P2 | scaling |
| T-032 | WS-MCP-SEARCH-VARIANTS | MCP Server | mcp-server | P1 | P2 | icons |
| T-033 | WS-SHARED-METRICS | Shared | shared | P0 | P3 | all |
| T-034 | WS-SHARED-VALIDATOR | Shared | shared | P1 | P3 | all |

**Counts (post user gate):**
- Workstreams by subsection: Design Agent = 5; MCP Server = 6; Shared = 5.
- Tasks by priority: P0 = 14; P1 = 17; P2 = 1 — total 32.
- Tasks by scope: design-agent = 10; mcp-server = 8; shared = 7; validator = 5; icon-library = 2 — aggregate 32.
- Tasks by subsection: Design Agent = 10; MCP Server = 8; Shared = 14 — aggregate 32.
- Tasks by pain-point category: icons = 12; layout = 10; styling = 8; semantics = 13; labels = 13; type-mismatch = 10; scaling = 14.

---

## T-012 Baseline Capture Summary (post-execution)

> Captured 2026-05-06 against `feat/vendor-prompting-enforcement` HEAD.
> Source: [`tools/tests/drawio-baseline/_baseline-runs.json`](../../../tools/tests/drawio-baseline/_baseline-runs.json) and [`tools/tests/drawio-baseline/regen-baseline.json`](../../../tools/tests/drawio-baseline/regen-baseline.json).

| Scenario | retries | friction | cost | rubric mean |
| --- | :-: | :-: | :-: | :-: |
| G1 three-tier-web | 0 | 3 | 3 | 2.86 |
| G2 hub-spoke-landing-zone | 0 | 4 | 4 | 2.86 |
| G3 event-driven-microservices | 0 | 3 | 3 | 2.71 |
| G4 ml-training-pipeline | 0 | 4 | 4 | 2.29 |
| G5 enterprise-landing-zone | **1** | 5 | 6 | 2.14 |
| G6 hyperscale-platform | 0 | 6 | 6 | **3.14** |
| G7 multi-region-active-active | 0 | 3 | 3 | **3.43** |
| **Mean / .drawio** | **0.14** | **4.00** | **4.14** | **2.78** |

**Acceptance bar: 3/4 averaged across 7 scenarios.** Today: **2.78/4** — fails (5 of 7 scenarios below bar).

**Cost reduction target (T-012):** post-uplift mean cost ≤ **2.49** (40% reduction from 4.14).

**Strict-rule calibration:** retries fired only at G5 (>20-resource scaling threshold). Validates Option C — strict captures "agent gives up", friction captures workflow waste, both needed.

### Plan adjustments arising from baseline data

- **T-008** (type-fit signature validator) promoted P1 → P0. Type-fit scored highest in the 3 best captures (G3=4, G6=4, G7=4) and lowest in the worst (G5=3 with structural MG-hierarchy collapse).
- **T-035** added (P1, design-agent): enforce single-batch `search-shapes` in agent body — drift in 4 of 7 captures.
- **T-036** added (P1, mcp-server): return inline `diagram_xml` from MCP responses — eliminates XML-extraction round-trips that account for ~25% of friction.
- **T-037** added (P1, mcp-server): native multi-page support in `finish-diagram` (or a new `merge-pages` tool) — eliminates the custom Python ElementTree merger G6 had to write.

### Quality-issue catalogue (top 5 by frequency)

| Issue | Affected | Pain point |
| --- | :-: | --- |
| Trust boundary missing at public ingress | 5/7 | #4 semantics |
| Edge-label collisions | 6/7 | #5 labels, #2 layout |
| Cross-cutting drift (services floating without zone) | 4/7 | #4 semantics |
| Out-of-band palette correction (sed/regex post-export) | 4/7 | #3 styling |
| Skill-batching drift (multi-batch search-shapes) | 4/7 | #1 icons (workflow) |

Full per-scenario findings: see `quality_issues[]` in [`_baseline-runs.json`](../../../tools/tests/drawio-baseline/_baseline-runs.json).
