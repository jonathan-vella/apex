<!-- ref:drawio-golden-fixtures-v1 -->

# Draw.io Golden Scenarios

Stable evaluation set for the Draw.io Diagram Quality Uplift programme. Each
scenario is a fixed input prompt plus an `expected.json` envelope that the
validator extensions, the regen-rate metric, and the side-by-side renderer
all consume.

Canonical plan: [`agent-output/_plans/drawio-quality-uplift/plan.md`](../../../agent-output/_plans/drawio-quality-uplift/plan.md).
Canonical rubric: [`.github/skills/drawio/references/quality-rubric.md`](../../../.github/skills/drawio/references/quality-rubric.md).

## Layout

```text
tools/tests/drawio-golden/
  g1-three-tier-web/               # G1 — small, logical, single-sub/single-region
    prompt.md                      # Input prompt fed to the 04-Design agent
    expected.json                  # Expectation envelope (drawio-golden-scenario-v1)
  g2-hub-spoke-landing-zone/       # G2 — medium, network, 3-sub
  g3-event-driven-microservices/   # G3 — medium, sequence/runtime
  g4-ml-training-pipeline/         # G4 — medium, deployment, variant icons
  g5-enterprise-landing-zone/      # G5 — large (~25 resources), logical+network
  g6-hyperscale-platform/          # G6 — extra-large (~55), decomposed (3 pages)
  g7-multi-region-active-active/   # G7 — medium, multi-region logical
```

JSON schema: [`tools/schemas/drawio-golden-scenario.schema.json`](../../schemas/drawio-golden-scenario.schema.json) (`drawio-golden-scenario-v1`).

## Pain-point coverage matrix

| Pain point   | G1  | G2  | G3  | G4  | G5  | G6  | G7  |
| ------------ | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| #1 Icons     |  x  |     |     |  x  |     |     |     |
| #2 Layout    |     |  x  |     |     |  x  |  x  |     |
| #3 Styling   |  x  |  x  |  x  |     |     |     |     |
| #4 Semantics |     |  x  |     |  x  |  x  |     |  x  |
| #5 Labels    |  x  |     |  x  |     |     |     |  x  |
| #6 Type-fit  |  x  |     |  x  |     |     |     |  x  |
| #7 Scaling   |     |     |     |     |  x  |  x  |     |

Every pain-point category is exercised by ≥ 1 scenario.

## Running a scenario through the agent

These fixtures are not meant to be executed by an automated test runner today.
They are run through the real `04-Design` agent in VS Code Copilot Chat, and
the outputs are collected for validator + benchmark scoring.

### One scenario, one run

1. Open VS Code Copilot Chat and select the **04-Design** agent.
2. Paste the scenario prompt:

   ```bash
   cat tools/tests/drawio-golden/g1-three-tier-web/prompt.md
   ```

3. Let the agent run end-to-end. The agent will write `.drawio` and `.png`
   under `agent-output/<project>/` per the standard Step 3 workflow.
4. Move the artifacts into the run-scoped output folder:

   ```bash
   mkdir -p agent-output/_bench/drawio-quality-uplift/<run-id>/g1-three-tier-web/
   mv agent-output/<project>/03-des-diagram.drawio \
      agent-output/_bench/drawio-quality-uplift/<run-id>/g1-three-tier-web/
   mv agent-output/<project>/03-des-diagram.png \
      agent-output/_bench/drawio-quality-uplift/<run-id>/g1-three-tier-web/
   cp agent-output/<project>/08-iteration-log.json \
      agent-output/_bench/drawio-quality-uplift/<run-id>/g1-three-tier-web/
   ```

5. Run the validator over the artifact:

   ```bash
   node tools/scripts/validate-drawio-files.mjs \
     agent-output/_bench/drawio-quality-uplift/<run-id>/g1-three-tier-web/03-des-diagram.drawio
   ```

### Full sweep (all 7 scenarios)

The orchestrator script `tools/scripts/run-drawio-quality-bench.mjs`
(delivered by T-033) automates the loop. Until that lands, the manual
procedure above is the path.

## Expectation envelope semantics

`expected.json` is consumed by these tasks:

| Field                             | Consumer task   | Used for                                                                         |
| --------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| `diagram_type`                    | T-008           | Type-fit signature check (filename pattern + expected zones)                     |
| `min_resources` / `max_resources` | T-007, T-033    | Resource-count range and density gate                                            |
| `expected_zones`                  | T-009           | Semantic zone-presence check                                                     |
| `expected_edge_labels`            | T-008           | Type-fit signature: at least one edge must contain each substring                |
| `expected_legend_required`        | T-010           | Legend-presence check (sequence type may set `false` per OQ-2 / T-022 carve-out) |
| `expected_pages`                  | T-007, T-023    | Decomposition expectation (>1 implies multi-page)                                |
| `pain_points_exercised`           | T-033 reporting | Maps scenario back to pain-point coverage matrix                                 |
| `rubric_targets` (optional)       | T-033, T-011    | Per-dimension overrides; falls back to acceptance bar in `quality-rubric.md`     |

## Baseline capture (T-012)

Before the first uplift code change lands, run all 7 scenarios on `main` HEAD
and store mean retry count per `.drawio` at:

```text
tests/fixtures/drawio-baseline/regen-baseline.json
```

The post-change reduction target is **≥ 40% reduction** vs. that baseline.

## Change control

Adding a new scenario:

1. Create a new sibling directory `g<n>-<slug>/`.
2. Add `prompt.md` and `expected.json` validating against
   `tools/schemas/drawio-golden-scenario.schema.json`.
3. Update the pain-point coverage matrix above.
4. Update the plan's `## Golden Scenarios` section.
5. Re-capture baseline if the new scenario changes the aggregate mean.

Modifying an existing scenario (prompt or expectations) is a **breaking
change** to the baseline. Bump the scenario `id` (e.g., `g1-three-tier-web-v2`)
or re-capture the baseline.
