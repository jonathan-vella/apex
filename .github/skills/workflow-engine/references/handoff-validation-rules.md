<!-- ref:handoff-validation-rules-v1 -->

# Workflow Handoff Validation Rules

> Reference for the `workflow-handoffs` validation surface in
> `tools/scripts/validate-agents.mjs`. Companion to
> `track-parity-spec.md` (B4 details) and `schema-evolution.md`
> (D1 schema policy). Cross-checked against
> [`../templates/workflow-graph.json`](../templates/workflow-graph.json)
> at runtime.

## Why a separate rule registry

The `WORKFLOW_HANDOFF_RULES` array lives **separate** from
`VENDOR_RULES` (defect D-C5). The vendor-prompting cross-check
(`lint:vendor-prompting`) iterates only `VENDOR_RULES` against
`vendor-prompting/rules.json`; workflow-handoff rules are NOT
added to that file. Run via:

```bash
npm run lint:workflow-handoffs            # severity-gated (warn/error)
npm run test:workflow-handoffs            # synthetic fixture suite
node tools/scripts/validate-agents.mjs --suggest --only=workflow-handoffs
```

`--suggest` prints unified-diff style patch comments to stdout
without modifying files (defect D-Verification).

## Graceful degradation (D2)

When `workflow-graph.json`'s `metadata.version` is below `"2.2"`,
every `workflow-handoff-*` finding downgrades to `info`. New top-
level fields (`challenger`, `return_edges`, `orchestrator_targets`,
`ui_pseudo_targets`) are treated as empty/null; `forwardReachable`
still works using `edges[]` only.

## Rules

### B1a — `workflow-handoff-target-001` (warn; cross-track jumps = error)

`handoffs[].agent` must point to a legal target. A target is legal iff
**any** of the following match:

1. It appears in `ui_pseudo_targets[]` (e.g., `agent: agent` for
   "Open in Editor").
2. It equals the source agent (self-loop).
3. It appears in `orchestrator_targets[]`.
4. It equals `challenger.wrapper_agent` AND the source is an
   artifact-producing agent (or in `CHALLENGER_DISPATCHER_ALLOWLIST`).
5. `forwardReachable(source_step, target_step)` is true: a path of
   length ≤ 2 across `step → gate → step` with `on_complete`
   conditions, OR a length-1 `on_skip` edge.
6. `return_edges[]` contains a matching `(from, to)` pair.

**Cross-track jumps** (`step-5b → step-6t`, `step-5t → step-6b`,
`step-6b → step-5t`, `step-6t → step-5b`) are **always illegal at
`error` severity**, regardless of any other match.

**Excluded as sources** (skipped entirely): `01-Orchestrator`,
`09-Diagnose`, `11-Context Optimizer`,
`10-Challenger`. **`E2E Orchestrator` is NOT excluded** (per
S6 — its handoffs SHOULD align with the DAG).

### B1b — REMOVED (kind taxonomy not viable)

Reserved-for-future-use. The original B1b rule (`workflow-handoff-kind-001`)
relied on a `kind:` field on each handoff entry. **VS Code Copilot's
handoff schema rejects `kind:` as an unknown property**, so this rule
was withdrawn and the field stripped from all agent files.

If a future Copilot release adds an extension point for handoff
metadata, this rule can be reinstated. Until then, the relationship
between a handoff and the DAG is derived **structurally** by B1a
(target legality) and B4 (track parity) using `(label, agent)` only —
no inline taxonomy field is required.

### B2 — `workflow-handoff-artifact-sync-001` (warn)

For every artifact path matching
`agent-output/{project}/[\w.-]+\.md` in a handoff `prompt`:

- **Input**: must be produced by some workflow step (any node's
  `produces[]`).
- **Output**:
  - Self-loop → must be in source step's `produces[]`.
  - Forward edge → must be in target step's `produces[]` (or source's
    if target has none).

Path role is determined by linear scan: each path is associated with
the nearest preceding `Input:` or `Output:` label (case-insensitive).
Paths without any preceding label are role=`unknown` and not checked.

### B3 — `workflow-handoff-self-loop-bound-001` (warn)

Self-loops (`handoffs[i].agent` == source) are legal but bounded:

- Maximum **6** self-loops per agent.
- Every self-loop prompt must satisfy enrichment (Input + Output
  references) — this rule references the existing
  `handoff-enrichment-001` finding instead of double-emitting.

### B4 — `workflow-handoff-track-parity-001` (warn)

Cross-track structural parity. See [`track-parity-spec.md`](./track-parity-spec.md)
for the normalization spec.

### B5 — `workflow-handoff-subagent-dispatch-001` (warn)

Validates `agents[]` (the `#runSubagent` dispatch list, distinct
from `handoffs[]`):

- Build subagent inventory at startup from
  `.github/agents/_subagents/*.agent.md`.
- **Wildcard handling**: `agents: ["*"]` is legal iff the agent has
  frontmatter `cross_cutting: true` OR appears in
  `CROSS_CUTTING_ALLOWLIST` (initial: `11-Context Optimizer`).
- Otherwise every entry must match a known top-level agent name OR a
  known subagent name.
- `challenger-review-subagent` requires an artifact-producing source
  (workflow node `produces[]` non-empty, or `handoffs[]` references
  `agent-output/`, or in `CHALLENGER_DISPATCHER_ALLOWLIST`).
- `cost-estimate-subagent` requires source ∈ {`03-Architect`,
  `08-As-Built`} (per pricing-authority guard in
  `orchestrator-handoff-guide.md`).

## CI gating (Phase C4 outcome)

Live-repo baseline at the time of rule introduction: **0 errors,
5 warns** (4 drift in `04-Design`/`03-Architect` skip-paths and
`07x` track parity, 1 artifact-sync drift). Cross-track jumps fire
at `error`; the live repo has zero, so the rule shipped at full
severity. Drift surfacing is tracked as Phase E1 follow-up.

## Test fixtures

`tools/tests/fixtures/workflow-handoffs/`:

- 5 synthetic agent fixtures, one per active rule (B1a/B2/B3/B4/B5).
  B1b was withdrawn; no fixture exercises a `kind:` field.
- 3 synthetic `00-handoff.md` fixtures (G1, G2.5, G5; companion-file
  H2-sync rule in `validate-artifacts.mjs`).

Driven by `tools/tests/workflow-handoffs/run.test.mjs`. The B4
fixture pair runs only when
`WORKFLOW_HANDOFFS_TEST_TRACK_PAIRS='[["A","B"]]'` is exported,
keeping the production track-parity check unchanged.
