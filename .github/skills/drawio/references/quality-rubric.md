<!-- ref:quality-rubric-v1 -->

# Draw.io Diagram Quality Rubric

Canonical 0–4 quality scale for AI-generated `.drawio` files. Each diagram is
scored along seven dimensions; the aggregate is the mean across dimensions
on the [golden-scenario fixture set](../../../../tests/fixtures/drawio-golden/).

This file is the **single source of truth** for the rubric. Consumers MUST
read thresholds and anchor descriptors from here rather than duplicating
them in code.

## Acceptance bar

- Mean score ≥ 3 / 4 across all seven dimensions averaged across the
  golden-scenario set.
- No single dimension scores 0 on any scenario.

## Dimensions

### Dimension 1 — Icon correctness

```text
0 — No Azure icons used (generic shapes only).
1 — Mix of Azure + generic shapes; >25% generic.
2 — All Azure shapes, but wrong service variants for >25% of nodes.
3 — All Azure shapes, correct families, but stale icon-set version.
4 — Current Microsoft icon-set release, correct service variant for
    100% of nodes, with consistent sizing.
```

Authoritative icon set: see [`assets/drawio-libraries/azure-icons/manifest.json`](../../../../assets/drawio-libraries/azure-icons/manifest.json) (`sourceVersion`).

### Dimension 2 — Layout

```text
0 — Cells overlap; edges cross arbitrarily; no whitespace.
1 — Some overlap or >5 edge crossings; spacing inconsistent.
2 — No overlap among siblings, but spacing varies; orthogonal edges
    not enforced; canvas density >1 cell per 4000 sq-px.
3 — No overlap; orthogonal edges; spacing within ±20% of skill
    minima (120 / 80 / 40 px); density within target band.
4 — No overlap; orthogonal edges; spacing within ±10% of skill
    minima; main flow left-to-right; cross-cutting services placed
    per skill rules; canvas density at or below target.
```

Spacing minima are defined in [`SKILL.md`](../SKILL.md) (Layout Conventions).

### Dimension 3 — Styling

```text
0 — Default Draw.io shapes; no APEX palette; mixed font sizes.
1 — APEX palette partially used (<50% cells); typography drift
    (>2 font sizes outside 14-16/12/11/10/9 pt convention).
2 — APEX palette on ≥75% cells; typography mostly aligned;
    line-weights inconsistent.
3 — APEX palette on 100% cells; typography aligned; line weights
    consistent within each role; theme uniform.
4 — All of #3 plus: explicit theme variant tagged (light / dark /
    print); edge styles match role (solid for sync, dashed for
    async, dotted for monitoring) per style-reference.md.
```

Authoritative palette + typography: [`style-reference.md`](style-reference.md).

### Dimension 4 — Semantics (zones / regions / subscriptions / trust boundaries)

```text
0 — No grouping; cells live on root layer.
1 — Some VNet or RG groups; no subscription / region / trust-boundary
    semantics.
2 — VNet, RG, and subnet groups present; no cross-cutting semantic
    layers (no subscription scope, no region label, no trust
    boundary).
3 — VNet/RG/subnet plus at least one of: subscription scope, region
    label, trust boundary; nesting hierarchy correct.
4 — Full nesting per semantic-zones.md (subscription → RG → VNet →
    subnet); trust-boundary perimeter explicit; multi-region
    diagrams label each region; external/internet box distinct
    from on-prem box where applicable.
```

Zone templates: `semantic-zones.md` (delivered by T-019).

### Dimension 5 — Labelling (incl. legend & annotations)

```text
0 — Cells unlabelled or labelled only by shape ID; no edge labels;
    no legend.
1 — Cell labels present but generic ("VM 1"); edge labels missing
    or duplicated; no legend.
2 — Cell labels descriptive; edge labels for primary flow only
    (protocol or verb); legend missing.
3 — Cell labels include service tier where relevant; edge labels
    cover all primary flows with protocol / port; legend present
    but partial (icons only, missing color or edge swatches).
4 — Cell labels per resource (name + region + tier); edge labels
    include protocol + port + auth method; full legend per
    legend-template.md (icon, color, edge-style swatches).
```

Legend template: `legend-template.md` (delivered by T-021).

### Dimension 6 — Type-fit (logical / network / sequence / deployment)

```text
0 — Single template forced; no differentiation by diagram purpose.
1 — Diagram type loosely chosen; signatures inconsistent (e.g.,
    sequence diagram drawn as logical).
2 — Diagram type matches workload (logical, network, sequence,
    deployment); signatures partial.
3 — Type-fit by filename pattern (03-des-* logical, 04-dependency-*
    dependency, 04-runtime-* runtime / sequence, 07-ab-* as-built);
    expected signatures present per diagram-types.md.
4 — All of #3 plus: per-type validator signature checks pass
    (T-008); per-type label and zone conventions applied.
```

Diagram-type catalogue: `diagram-types.md` (delivered by T-016).

### Dimension 7 — Scalability (architectures with >20 / >50 resources)

```text
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

Decomposition rules: `large-architecture-decomposition.md` (delivered by T-023).

## Deterministic thresholds (consumed by validator)

The validator extensions (T-006 through T-010 and T-031) read these
thresholds from this file. **Do not change a threshold without updating
the validator and the test fixtures.**

| Threshold key                       | Value                  | Consumed by  | Pain point   |
| ----------------------------------- | ---------------------- | ------------ | ------------ |
| `overlap.fp_ceiling_pct`            | `5`                    | T-006        | #2 layout    |
| `density.max_cells_per_sqpx`        | `1 / 2500`             | T-007, T-031 | #7 scaling   |
| `density.warn_cells_per_sqpx`       | `1 / 4000`             | T-007, T-031 | #7 scaling   |
| `semantics.min_resources_for_zone`  | `10`                   | T-009        | #4 semantics |
| `labels.min_image_cells_for_legend` | `8`                    | T-010        | #5 labels    |
| `type_fit.filename_patterns`        | see `diagram-types.md` | T-008        | #6 type-fit  |

`overlap.fp_ceiling_pct` is fixed at 5 per the resolved decision **D-OQ3**
in [`agent-output/_plans/drawio-quality-uplift/plan.md`](../../../../agent-output/_plans/drawio-quality-uplift/plan.md).

## Aggregate scoring formula

```text
score(diagram) = mean(score(dim_i)) for i in 1..7
```

The benchmark (T-011) emits per-dimension and aggregate scores into
`08-benchmark-scores.json` under `dimensions.diagramQuality`.

## Consumers

| Consumer                                                   | Reads                          | Status                                         |
| ---------------------------------------------------------- | ------------------------------ | ---------------------------------------------- |
| `tools/scripts/validate-drawio-files.mjs`                  | Deterministic thresholds       | wired by T-006..T-010, T-031                   |
| `tools/scripts/benchmark-e2e.mjs`                          | Aggregate formula + dimensions | wired by T-011                                 |
| `tools/scripts/run-drawio-quality-bench.mjs`               | Acceptance bar                 | wired by T-033                                 |
| `04-Design` agent self-check                               | Anchor descriptors             | wired by T-022 (legend), T-024 (decomposition) |
| Golden-scenario fixtures (`tests/fixtures/drawio-golden/`) | Acceptance bar                 | wired by T-002                                 |

## Baseline-capture procedure (T-012)

Before any uplift code change lands, capture a regen-rate baseline on `main` HEAD.
The baseline is the divisor in the post-change reduction formula
`100 * max(0, 1 - current/baseline)`; the target is **≥40% reduction**.

### Steps

1. **Switch to a clean main HEAD checkout.**

   ```bash
   git fetch origin
   git switch main
   git pull --ff-only
   ```

2. **For each fixture under [`tools/tests/drawio-golden/g*/`](../../../../tools/tests/drawio-golden/):**

   a. Open VS Code Copilot Chat and select the **04-Design** agent.

   b. Paste the contents of `prompt.md` (e.g.,
   `cat tools/tests/drawio-golden/g1-three-tier-web/prompt.md`).

   c. Run the agent end-to-end. Watch the tool-call log.

   d. Count **regeneration cycles** = the number of times after the first complete
   `add-cells` batch that the agent issued a `clear-diagram`, full re-`add-cells`,
   or ≥3 corrective `edit-cells`/`delete-cell-by-id` calls. A first-pass success
   with only minor edits = `0` retries.

   e. Edit [`tools/tests/drawio-baseline/_baseline-runs.json`](../../../../tools/tests/drawio-baseline/_baseline-runs.json):
   set the scenario's `retries` to the integer count and add a one-line
   `observations` note (what regenerated and why).

   f. Run the capture helper:

   ```bash
   node tools/scripts/capture-drawio-baseline.mjs
   ```

   It rewrites [`regen-baseline.json`](../../../../tools/tests/drawio-baseline/regen-baseline.json)
   with the running mean.

3. **After all 7 are captured**, run with `--check`:

   ```bash
   node tools/scripts/capture-drawio-baseline.mjs --check
   ```

   Exit code 0 means complete. Commit the captured `_baseline-runs.json` and
   `regen-baseline.json` together. The plan's **40% reduction** target is
   measured against the resulting `mean_retries_per_drawio` value.

### Why a manual count

Today the `04-Design` agent does not auto-emit `entries[].artifact_retries`
into `08-iteration-log.json`. Auto-emission is a follow-up agent-side change
(out of T-011/T-012 scope). Until then, the tool-call observation procedure
above is the source of truth.

### Files

| File                                                                                                             | Purpose                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`tools/tests/drawio-baseline/_baseline-runs.json`](../../../../tools/tests/drawio-baseline/_baseline-runs.json) | User-edited working file (per-scenario retry counts + observations)       |
| [`tools/tests/drawio-baseline/regen-baseline.json`](../../../../tools/tests/drawio-baseline/regen-baseline.json) | Generated baseline (mean + per-scenario), consumed by `benchmark-e2e.mjs` |
| [`tools/scripts/capture-drawio-baseline.mjs`](../../../../tools/scripts/capture-drawio-baseline.mjs)             | Capture helper: `--status`, `--check`, default = compose + write          |
| [`tools/schemas/drawio-baseline-runs.schema.json`](../../../../tools/schemas/drawio-baseline-runs.schema.json)   | Schema for the working file                                               |
| [`tools/schemas/drawio-regen-baseline.schema.json`](../../../../tools/schemas/drawio-regen-baseline.schema.json) | Schema for the generated baseline                                         |

## Change control

This rubric defines a stable contract. Threshold or anchor changes require:

1. Update this file.
2. Update the validator and benchmark consumer paths listed above.
3. Re-run the golden-scenario regression and update the baseline at
   `tests/fixtures/drawio-baseline/regen-baseline.json` (T-012).
4. Note the change in [`agent-output/_plans/drawio-quality-uplift/plan.md`](../../../../agent-output/_plans/drawio-quality-uplift/plan.md).
