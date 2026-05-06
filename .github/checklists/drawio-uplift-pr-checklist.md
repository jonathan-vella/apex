<!-- ref:drawio-uplift-pr-checklist-v1 -->

# Draw.io Quality Uplift — PR Review Checklist

Per-PR checklist for changes to the Draw.io agent, skill, MCP server,
validator, or icon library. Maps each workstream to the goldens that
exercise it and the validator checks that gate it.

> **Scope.** Use this checklist for any PR that touches:
>
> - `.github/agents/04-design.agent.md`
> - `.github/skills/drawio/**`
> - `tools/mcp-servers/drawio/**`
> - `tools/scripts/validate-drawio-files.mjs`
> - `tools/scripts/run-drawio-quality-bench.mjs`
> - `tools/scripts/render-golden-diff.mjs`
> - `tools/scripts/capture-drawio-baseline.mjs`
> - `assets/drawio-libraries/azure-icons/**`
> - `tools/tests/drawio-golden/**`
> - `tools/tests/drawio-baseline/**`

## Phase-3 acceptance gate (canonical)

A PR that claims to close out Phase-3 of the uplift programme must satisfy:

- [ ] `npm run lint:json`, `npm run lint:md`, `npm run lint:skills-format`,
      `npm run lint:agent-frontmatter` all pass
- [ ] `node tools/scripts/validate-drawio-files.mjs` exits 0 (warnings allowed
      in advisory mode; errors disallowed)
- [ ] `cd tools/mcp-servers/drawio && deno task test` exits 0 and reports
      no regressions vs. baseline (29 tests / 918 steps as of branch HEAD)
- [ ] `node tools/scripts/run-drawio-quality-bench.mjs --post=<run-id> --check`
      reports **PASS** for Phase-3 gate (≥40% cost reduction AND mean rubric
      ≥3/4 across all 7 scenarios)
- [ ] Side-by-side diff via `node tools/scripts/render-golden-diff.mjs --post=<run-id>`
      reviewed by at least one human reviewer; quality regressions flagged

## Per-workstream gate

For PRs that target a specific workstream, the reviewer asserts the
following. Goldens listed are the ones that exercise the workstream's pain
points; validator checks listed are the ones that fire on the relevant
failure modes.

### WS-AGENT-TYPE-DISPATCH (T-015, T-016)

- [ ] `references/diagram-types.md` referenced from `04-design.agent.md`
      Diagram contract section
- [ ] G3 (`expected_legend_required: false`), G7 (`expected_zones`) regenerate
      cleanly with the correct type signature
- [ ] Validator T-008 fires correctly: sequence diagrams without VNet
      containers, logical/network with public ingress have a trust-boundary
      cell

### WS-AGENT-ICONS-VARIANTS (T-017, T-018, T-035)

- [ ] `references/icon-variants.md` referenced from agent body
- [ ] `manifest.json` `variants{}` covers any new service families
- [ ] G4 (variant-heavy: NC-A100, ADLS Gen2, ACR Premium) regenerates with
      variant labels in cell `value`
- [ ] **T-035 single-batch**: post-uplift trace shows exactly one
      `search-shapes` call for G3, G4 (was 3, 4 in baseline)

### WS-AGENT-SEMANTICS-TEMPLATES (T-019, T-020)

- [ ] `references/semantic-zones.md` referenced from agent body
- [ ] G2, G5, G7 regenerate with subscription scope, region zone, trust
      boundary as actual container cells (not legend entries)
- [ ] Validator T-008 trust-boundary check passes on G3, G5, G6, G7

### WS-AGENT-LABELS-LEGEND (T-021, T-022)

- [ ] `references/legend-template.md` referenced from agent body
- [ ] G1, G2, G4, G5, G6 regenerate with a real legend cell (not just a
      mention in `value`)
- [ ] G3 (sequence type) correctly omits the legend per OQ-2 carve-out
- [ ] Validator T-010 firing only on diagrams that should have legends
- [ ] No literal `&#xa;` in any legend cell value (G6 baseline bug)

### WS-AGENT-SCALING-DECOMP (T-023, T-024)

- [ ] `references/large-architecture-decomposition.md` referenced from agent
      body
- [ ] G6 (>50 resources) regenerates with ≥3 `<diagram>` pages, ≤30 cells
      per page
- [ ] G5 (~25 resources) decomposition optional — both single-page and
      multi-page acceptable, but single-page must score layout ≥3/4
- [ ] Dynamic circuit-breaker cap respected: ≤25 calls for ≤20 resources,
      ≤40 for 21–50, ≤60 for >50

### WS-MCP-LAYOUT (T-025, T-026)

- [ ] If T-025 / T-026 land: `deno task test` includes new test files;
      benchmarks confirm <200ms for 50-vertex layout
- [ ] Side-by-side render shows reduced edge crossings vs. baseline

### WS-MCP-PRESETS (T-027)

- [ ] `get-style-presets` includes `apex-arch-fills`, `apex-arch-zones`,
      `apex-arch-edges`, `fonts`, `line-weights`, `themes`
- [ ] G5 palette drift (4 unexpected fillColor values in baseline)
      eliminated post-uplift

### WS-MCP-LEGEND-GEN (T-028, deferred)

- [ ] If T-028 lands: `generate-legend` tool registered in
      `tool_definitions.ts`, handler in `tools.ts`, tests in
      `tests/handlers.test.ts`
- [ ] Idempotent on re-invocation (no duplicate legend cell)

### WS-MCP-ZONES-TEMPLATE (T-029, deferred)

- [ ] If T-029 lands: `apply-zone-template` tool registered with multi-level
      nesting (Subscription → RG → VNet → Subnet)
- [ ] G5 MG hierarchy regression (Connectivity/Identity drawn as peers of
      Platform) eliminated

### WS-MCP-SCALE-PERF (T-030, T-031, T-037)

- [ ] T-030 single-pass placeholder resolution: `tests/placeholder.test.ts`
      passes; bench shows ≥3× throughput at 100 placeholders
- [ ] T-031 `get-diagram-stats` returns `cells_per_sqpx`,
      `density_warning`, `density_failure`, `suggested_action`
- [ ] If T-037 lands: native multi-page output replaces the Python merger
      pattern from G6

### WS-MCP-SEARCH-VARIANTS (T-032)

- [ ] `searchAzureIcons` boost ≥0.15 when query has tier/SKU keyword AND
      candidate title matches
- [ ] G4 query for "ACR Premium" returns the Premium-tier shape ahead of
      the family default

### WS-SHARED-RUBRIC (T-001)

- [ ] Threshold table in `references/quality-rubric.md` matches the
      validator's runtime constants (`MIN_FOR_LEGEND`, `MIN_FOR_ZONE`,
      density thresholds, FP ceiling)

### WS-SHARED-GOLDEN (T-002, T-003)

- [ ] Any new scenario in `tools/tests/drawio-golden/` validates against
      `tools/schemas/drawio-golden-scenario.schema.json`
- [ ] Pain-point coverage matrix in `tools/tests/drawio-golden/README.md`
      updated
- [ ] `render-golden-diff.mjs --post=<run-id>` produces an HTML index that
      opens cleanly in any browser

### WS-SHARED-VALIDATOR (T-006…T-010, T-034)

- [ ] All new validator checks documented in `references/validation-checklist.md`
- [ ] False-positive rate ≤5% per D-OQ3 — measured against the captured
      baseline `.drawio` inventory
- [ ] Each check advisory by default; `APEX_DRAWIO_RUBRIC=strict` promotes
      to error

### WS-SHARED-METRICS (T-011, T-012, T-033)

- [ ] `08-iteration-log.json` schema accepts new fields without breaking
      existing logs
- [ ] `regen-baseline.json` regenerated when threshold or rubric anchors
      change (per change-control protocol in `quality-rubric.md`)
- [ ] `run-drawio-quality-bench.mjs` emits both JSON and markdown reports

### WS-SHARED-ICONS-MANIFEST (T-004, T-005)

- [ ] `manifest.json` `variants{}` covers every service family added
- [ ] `npm run check:azure-icons-freshness` runs without errors (warns on
      drift; doesn't fail unless `--strict`)

## Goldens covered by this PR

List the scenarios that were re-run for this PR. At least one is required
for any change to the agent body, skill content, MCP server, or validator.

- [ ] G1 — Three-Tier Web App
- [ ] G2 — Hub-Spoke Landing Zone
- [ ] G3 — Event-Driven Microservices
- [ ] G4 — ML Training Pipeline
- [ ] G5 — Enterprise Landing Zone
- [ ] G6 — Hyperscale Platform
- [ ] G7 — Multi-Region Active-Active

For each ticked scenario, attach:

- [ ] Pre/post side-by-side render link (from `render-golden-diff.mjs` output)
- [ ] Updated `_baseline-runs.json` entry (retries, friction_count,
      rubric_score, quality_issues[])
- [ ] Snapshot of `quality-bench.md` showing the resulting verdict

## Backward compatibility

Per **D-BC** (resolved decision in plan): backward compatibility is
**waived** for the uplift programme. Existing `.drawio` files in
`site/public/demo/`, `.github/skills/drawio/templates/`, and
`agent-output/**/` may freely re-render under the post-change MCP without
migration. Reviewer is not required to inspect them unless the PR
introduces a structural change to MCP output.

## References

- Plan: [`agent-output/_plans/drawio-quality-uplift/plan.md`](../../agent-output/_plans/drawio-quality-uplift/plan.md)
- Backlog: [`agent-output/_plans/drawio-quality-uplift/backlog.json`](../../agent-output/_plans/drawio-quality-uplift/backlog.json)
- Quality rubric: [`.github/skills/drawio/references/quality-rubric.md`](../skills/drawio/references/quality-rubric.md)
- Validation checklist: [`.github/skills/drawio/references/validation-checklist.md`](../skills/drawio/references/validation-checklist.md)
- Resume context: [`agent-output/_plans/drawio-quality-uplift/RESUME.md`](../../agent-output/_plans/drawio-quality-uplift/RESUME.md)
