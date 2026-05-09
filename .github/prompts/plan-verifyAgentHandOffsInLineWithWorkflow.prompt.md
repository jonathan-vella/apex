# Plan: Verify Agent Hand-Offs Are In Line With Workflow (v3)

Validate that every agent `handoffs[]` UI button, every `agents[]` subagent
dispatch entry, every (future) `00-handoff.md` companion file, and the
Bicep/Terraform track parity all match the authoritative
`workflow-graph.json` DAG. Extend the DAG to declare a top-level
`workflow_version`, structured `challenger` block, `return_edges`,
`orchestrator_targets`, and `ui_pseudo_targets`. Add an opt-in `kind:`
taxonomy on handoff entries. Surface findings as `--suggest`-only patch
comments. New rules live in a dedicated `WORKFLOW_HANDOFF_RULES` registry
to keep skill boundaries clean.

## v3 changes (defect fixes)

This v3 folds in 8 defects from validation review:

- **D-A0** — Reuse `metadata.version` (bumped 2.1 → 2.2); no parallel
  `schema_version` field. Single source of truth.
- **D-A2a** — Add 4 missing `return_edges`: 2→1, 4→2, 6b→2, 6t→2.
- **D-A2b** — Allow `condition` to be string OR `[string, ...]` so a
  single from/to pair can be `["on_fail", "on_refine"]`. Map "↩ Fix
  Errors" labels → `on_fail`, "↩ Return to Step N" labels →
  `on_refine`.
- **D-A2c** — New top-level `ui_pseudo_targets[]: ["agent"]` allowlist
  for non-agent UI hooks (e.g., "Open in Editor").
- **D-B0** — Add `workflow-handoffs` as a new PART in the `PARTS` map of
  `validate-agents.mjs` (parallel to `vendor-prompting`), not a rule
  prefix filter.
- **D-B5** — Treat `agents: ["*"]` as a recognized wildcard for agents
  flagged `cross_cutting: true` in frontmatter (or by allowlist:
  `11-Context-Optimizer`).
- **D-C3** — 6 fixtures (one per rule B1a/B1b/B2/B3/B4/B5), not 5.
- **D-C5** — New rules live in a separate `WORKFLOW_HANDOFF_RULES`
  array; `VENDOR_RULES` cross-check against `vendor-prompting/rules.json`
  is scoped to that array only.
- **D-Verification** — No real `00-handoff.md` exists in repo. Drop the
  "1 real fixture" claim; all 3 companion-file fixtures synthetic.

## Goal

For every workflow handoff seam, prove that what an agent's frontmatter
says (both `handoffs[]` and `agents[]`) matches what the DAG declares,
what its peers expect, and what `00-handoff.md` records — across Bicep
and Terraform tracks, with explicit kind taxonomy and a documented
evolution path.

## Scope clarifications

- **Two distinct surfaces** validated separately:
  - `handoffs[]` — UI buttons (label/agent/prompt) — checked by rules
    in `validate-agents.mjs` (new PART `workflow-handoffs`).
  - `agents[]` — `#runSubagent` dispatch list — checked by a new rule
    against the DAG's `challenger.review_subagent`, the subagent
    inventory in `.github/agents/_subagents/`, and the wildcard
    convention.
- **`00-handoff.md` template structure** moves to
  `validate-artifacts.mjs` (Sg2) co-located with other H2-sync artifact
  rules.
- **Skill home** for new rules: `workflow-engine` (NOT
  `vendor-prompting`).

## Phases & Steps

> **Dependency notation**: each substep lists `Hard depends on` (must
> complete first) and `Parallel with` (independent). Tests (C3) depend
> on all of B; baseline run (C4) depends on C1 + C2.

### Phase A — Ground truth: extend `workflow-graph.json`

**A0. Version bump (single source of truth)** (D-A0) — Bump
`metadata.version` from `"2.1"` → `"2.2"`. Do NOT add a separate
`schema_version` field. All Phase A additions ride on this bump.
Validators read `metadata.version` exclusively. **Hard depends on**:
none. **Parallel with**: none.

**A1. Structured top-level `challenger` block** — Add a new top-level
`challenger:` field (sibling to `nodes`/`edges`/`metadata`). Does NOT
replace per-node `nodes[*].challenger` (which controls passes/lenses).
Shape:

```json
"challenger": {
  "wrapper_agent": "10-Challenger",
  "review_subagent": "challenger-review-subagent"
}
```

The wrapper is a legal `handoffs[].agent` target (UI button); the
subagent is a legal `agents[]` entry (`#runSubagent` dispatch). They
are NOT interchangeable. **Hard depends on**: A0. **Parallel with**:
A2, A3, A3b.

**A2. `return_edges[]`** (D-A2a, D-A2b) — Sibling to `edges[]`. Shape:

```json
{
  "from": "<step-id>",
  "to": "<step-id>",
  "condition": "on_fail" | "on_refine" | ["on_fail", "on_refine"],
  "reason": "<text>",
  "ui_label_pattern": "<regex matching the handoff label>"
}
```

Populate from a live audit of every `↩` button in agent files:

| from    | to      | condition                    | source UI button                     |
| ------- | ------- | ---------------------------- | ------------------------------------ |
| step-2  | step-1  | `on_refine`                  | 03-Architect "↩ Return to Step 1"    |
| step-4  | step-2  | `on_refine`                  | 05-IaC Planner "↩ Return to Step 2"  |
| step-5b | step-4  | `on_refine`                  | 06b "↩ Return to Step 4"             |
| step-5t | step-4  | `on_refine`                  | 06t "↩ Return to Step 4"             |
| step-6b | step-5b | `on_fail`                    | 07b "↩ Fix Deployment Issues"        |
| step-6b | step-2  | `on_refine`                  | 07b "↩ Return to Step 2"             |
| step-6t | step-5t | `on_fail`                    | 07t "↩ Fix Deployment Issues"        |
| step-6t | step-2  | `on_refine`                  | 07t "↩ Return to Step 2"             |
| step-1  | step-1  | `on_refine`                  | 02-Requirements "▶ Refine …"         |
| step-2  | step-2  | `on_refine`                  | 03-Architect "▶ Refresh Cost …"      |
| step-3_5| step-3_5| `on_refine`                  | 04g-Governance "▶ Refresh …"         |
| step-4  | step-4  | `on_refine`                  | 05-IaC Planner "▶ Revise Plan"       |

`to` is modeled as the **step** (matches handoff button landing).
**Hard depends on**: A0. **Parallel with**: A1, A3, A3b.

**A3. `orchestrator_targets[]`** — New top-level field listing agent
names that may be handed off to from anywhere as legal "return to
orchestrator" targets:
`["01-Orchestrator", "01-Orchestrator-fastpath"]`. Resolves M4 (every
agent today has "↩ Return to Orchestrator"). **Hard depends on**: A0.
**Parallel with**: A1, A2, A3b.

**A3b. `ui_pseudo_targets[]`** (D-A2c) — New top-level field listing
non-agent UI hooks that may appear in `handoffs[].agent`. Initial
value: `["agent"]` — for the literal `agent: agent` "Open in Editor"
sentinel in 02-Requirements. Documented contract: B1a treats matches
against this list as legal targets and skips edge resolution. **Hard
depends on**: A0. **Parallel with**: A1, A2, A3.

**A4. Schema update** (D-A2b) — Update
`tools/schemas/workflow-graph.schema.json` to permit:

- New top-level `challenger` (object), `return_edges` (array),
  `orchestrator_targets` (array of string), `ui_pseudo_targets`
  (array of string).
- Edge `condition` may be `string` OR `array` of strings (each from
  the same enum).
- Extend edge condition enum to include `on_refine`.
- `metadata.version` enum tightened to `"2.1" | "2.2"` (validators
  refuse unknown majors per D2).

**Hard depends on**: A1, A2, A3, A3b. **Parallel with**: none.

**A5. Graph validator update** — Extend `validate-workflow-graph.mjs`
to validate the new fields:

- referenced agents in `challenger`/`orchestrator_targets` exist
- `return_edges[]` sources/targets are valid step IDs
- no `(from, to, condition)` duplicates with `edges[]` (when condition
  is array, expand and compare per element)
- `ui_pseudo_targets[]` strings non-empty
- `metadata.version` matches a known version

**Hard depends on**: A4. **Parallel with**: none.

**A6. Consumer inventory & compat check** (M8) — Audit consumers of
`workflow-graph.json` and confirm graceful handling of new fields.
Sweep first via `grep -rn "workflow-graph.json" .` to enumerate
readers, then verify each:

- `tools/scripts/generate-explorer-graph.mjs` — reads only known fields
- `tools/scripts/validate-workflow-table-sync.mjs` — no break on new fields
- `tools/scripts/validate-agent-registry.mjs` — no break
- `site/public/architecture-explorer-graph.json` (built artifact) —
  rebuild via `npm run build:explorer-graph` and diff
- Any agent prose that quotes the graph schema (grep for
  `metadata.version`, `challenger`, `edges:` in `.github/agents/` and
  skill references)

**Hard depends on**: A1-A5. **Parallel with**: none.

### Phase B — Rule core (handoff target/kind/artifact alignment)

All rules added to a new `WORKFLOW_HANDOFF_RULES` array in
`validate-agents.mjs` — kept **separate** from `VENDOR_RULES` (D-C5).
The vendor-prompting cross-check loop iterates only `VENDOR_RULES`,
so workflow-handoff rules do not need to appear in
`vendor-prompting/rules.json`. Rule IDs prefixed `workflow-handoff-*`.
Severity defaults below; `--suggest` flag prints unified-diff-style
patch suggestions to stdout but writes nothing.

**B0. New PART `workflow-handoffs`** (D-B0) — Add an entry to the
`PARTS` map in `validate-agents.mjs`:

```js
const PARTS = {
  frontmatter: runFrontmatterValidation,
  structural: runAgentChecks,
  "model-alignment": runModelAlignment,
  "vendor-prompting": runVendorPrompting,
  "workflow-handoffs": runWorkflowHandoffs,  // NEW
};
```

`runWorkflowHandoffs()` iterates rules in `WORKFLOW_HANDOFF_RULES`,
short-circuits to `info` when `metadata.version < "2.2"` (D2 graceful
degradation), and supports `--suggest`. **Hard depends on**: Phase A
complete. **Parallel with**: none.

**B1a. `workflow-handoff-target-001` (warn)** — Validate
`handoffs[].agent` target legality. A target is legal iff:

1. It is in `ui_pseudo_targets[]` (e.g., `"agent"` sentinel), OR
2. It is the same agent (self-loop), OR
3. It is in `orchestrator_targets[]` (return-to-orchestrator), OR
4. It is `challenger.wrapper_agent` (review button), OR
5. There exists `forwardReachable(source_step, target_step)` defined
   as: "a path `step-X → gate-? → step-Y` of length ≤ 2 in `edges[]`
   with `condition: on_complete`, OR a length-1 `on_skip` edge", OR
6. There exists a matching entry in `return_edges[]` with
   `from: source_step, to: target_step`. When `condition` is an
   array, any element matches.

Cross-track jumps (`step-5b → step-6t`, `step-5t → step-6b`,
`step-6b → step-5t`, `step-6t → step-5b`) are **always illegal** and
emit `error` severity regardless of any of the above (M3 resolution).

**Excluded as sources** (skipped entirely): `01-Orchestrator`,
`01-Orchestrator-fastpath`, `09-Diagnose`, `11-Context-Optimizer`,
`10-Challenger` (wrapper itself).
**`e2e-orchestrator` is NOT excluded** (S6 — its handoffs SHOULD
align with the DAG).

**Hard depends on**: B0. **Parallel with**: B1b, B2, B5.

**B1b. `workflow-handoff-kind-001` (info, opt-in to warn)** (Sg1) —
When a `handoffs[]` entry includes a `kind:` field, validate it
matches the DAG-derived edge type:

| `kind` value  | Required DAG match                                      |
| ------------- | ------------------------------------------------------- |
| `forward`     | `forwardReachable(source_step, target_step)` true       |
| `self-refine` | source agent == target agent                            |
| `return`      | `return_edges[]` contains the edge                      |
| `challenger`  | target == `challenger.wrapper_agent`                    |
| `meta`        | target ∈ `orchestrator_targets[]`                       |
| `ui`          | target ∈ `ui_pseudo_targets[]`                          |

Initial severity = `info` (kind field is opt-in for now). Documented
upgrade path: when ≥80% of handoffs in repo carry `kind:`, raise to
`warn`; when 100%, make `kind:` required (separate rule). **Hard
depends on**: B0. **Parallel with**: B1a, B2, B5.

**B2. `workflow-handoff-artifact-sync-001` (warn)** — For every
artifact path in a handoff `prompt` (regex:
`agent-output/\{project\}/[\w.-]+\.md`):

- If the path appears after `Input:` → must be in source step's
  `produces[]` OR any upstream step's `produces[]`.
- If the path appears after `Output:` → must be in source step's
  `produces[]` (when self-loop) OR target step's `produces[]` (when
  forward edge).

Reuses the path regex from `checkHandoffEnrichment`. **Hard depends
on**: B0. **Parallel with**: B1a, B1b, B5.

**B3. `workflow-handoff-self-loop-bound-001` (warn)** (M5) —
Self-loop handoffs are legal but bounded:

- Max 6 self-loops per agent (warn above; matches current Architect's
  4 with headroom).
- Every self-loop prompt MUST satisfy `handoff-enrichment-001`
  (Input + Output references). **De-duplication**: if a self-loop
  already failed `handoff-enrichment-001` in the vendor-prompting
  PART, B3 references that finding (`see also: handoff-enrichment-001
  at line N`) instead of re-emitting.

**Hard depends on**: B0. **Parallel with**: B1a, B1b, B2, B5.

**B4. `workflow-handoff-track-parity-001` (warn)** (M5/S2) — For
dual-track agents (06b/07b vs 06t/07t):

Compare normalized handoff _structure_, not raw strings:

1. Strip `Bicep|Terraform|terraform|bicep|TF|tf` tokens from labels.
2. Map track-specific subagent names:
   `bicep-whatif-subagent` ↔ `terraform-plan-subagent`,
   `bicep-validate-subagent` ↔ `terraform-validate-subagent`.
3. Compare resulting tuples `(label_normalized, target_role, kind)`
   where `target_role` collapses 06b/06t → `"codegen"`, 07b/07t →
   `"deploy"`, etc.

Asymmetries fail. Document the normalization spec in
`workflow-engine/references/track-parity-spec.md`. **Hard depends
on**: B0. **Parallel with**: B1a, B1b, B2, B3.

**B5. `workflow-handoff-subagent-dispatch-001` (warn)** (M1, D-B5) —
NEW — validates `agents[]` (the subagent dispatch list, distinct from
`handoffs[]`):

- Build subagent inventory at startup from
  `.github/agents/_subagents/*.agent.md`.
- **Wildcard handling**: `agents: ["*"]` is legal iff the agent has
  frontmatter `cross_cutting: true` OR appears in the
  `CROSS_CUTTING_ALLOWLIST` (initial: `["11-Context-Optimizer"]`).
- Otherwise every entry must be either a known top-level agent name
  OR a known subagent name.
- If an entry is `challenger-review-subagent`, source agent must be
  recognized as artifact-producing (reuses the `isArtifactProducer`
  heuristic).
- If an entry is `cost-estimate-subagent`, source must be
  `03-Architect` or `08-As-Built` (the only two pricing-authoritative
  steps per `orchestrator-handoff-guide.md`).

**Hard depends on**: B0, A1 (needs `challenger.review_subagent`).
**Parallel with**: B1a, B1b, B2, B3, B4.

### Phase C — Wire-up, tests, baseline

**C1. npm script** — Add `lint:workflow-handoffs` as alias for
`node tools/scripts/validate-agents.mjs --only=workflow-handoffs`.
Add to `validate:_node` and `validate:_node-ci` (severity gating
deferred to C4 outcome). **Hard depends on**: Phase B complete.
**Parallel with**: C2.

**C2. Companion-file artifact rule** (Sg2) — Add `00-handoff.md`
checks to `validate-artifacts.mjs`:

- Add `00-handoff.md` to `ARTIFACT_HEADINGS` table (and to the H2
  sync source markdown if applicable).
- Required H2 sections from `orchestrator-handoff-guide.md`:
  `## Completed Steps`, `## Key Decisions`,
  `## Open Challenger Findings (must_fix only)`,
  `## Context for Next Step`, `## Skill Context`, `## Artifacts`.
- ≤60 line cap (configurable, default to spec).

The cohesion check — `## Artifacts` section must list union of
`produces[]` for completed steps — also lives in
`validate-artifacts.mjs` at `info` severity (state churn between
gates is normal, per resolved consideration #3).

**Hard depends on**: Phase A (needs `produces[]` in DAG, already
present). **Parallel with**: C1.

**C3. Test fixtures and regression tests** (S1, D-C3,
D-Verification) — Under
`tools/tests/fixtures/workflow-handoffs/`:

- **3 synthetic** `00-handoff.md` files (one per major gate: G1,
  G2.5, G5) with deliberate structural variety. **No real fixtures**
  — `agent-output/*/00-handoff.md` does not exist in repo.
- **6 synthetic agent fixtures**, each tripping exactly one of B1a,
  B1b, B2, B3, B4, B5 (one fixture per rule).
- Negative fixtures: cross-track jump (must hit `error`), missing
  artifact ref, asymmetric track, oversized self-loop list, illegal
  subagent, illegal `agents: ["*"]` from non-cross-cutting agent.

Tests added to `tools/tests/workflow-handoffs/run.test.mjs` using
`node --test`. **Hard depends on**: B1a, B1b, B2, B3, B4, B5, C2.
**Parallel with**: none.

**C4. Live-repo baseline + CI gating decision** (S5) — BEFORE
merging C1's wire-up to `validate:_node-ci`:

1. Run baseline:
   `node tools/scripts/validate-agents.mjs --format=json
   --only=workflow-handoffs > tmp/workflow-handoffs-baseline.json`
2. **Decision branch**:
   - If 0 `error` findings (no cross-track jumps in live repo) →
     proceed with B1a cross-track at `error`.
   - If `error` findings exist → downgrade to `warn` initially,
     file a remediation issue tracking the fixes, raise to `error`
     after remediation merges.
3. Document the decision in PR description and link the baseline
   JSON.

**Hard depends on**: C1, C2. **Parallel with**: C3.

**C5. Skill home** (M6) — Document the new rules in
`.github/skills/workflow-engine/`:

- Add `references/handoff-validation-rules.md` listing each rule
  (B1a, B1b, B2, B3, B4, B5), severity, DAG fields consulted, and
  escalation rules (e.g., B1b kind taxonomy).
- Add `references/track-parity-spec.md` (the B4 normalization spec).
- Update `SKILL.md` and `SKILL.digest.md` to mention the new
  validation surface.
- Do NOT add to `vendor-prompting/rules.json` — `WORKFLOW_HANDOFF_
  RULES` is its own registry (D-C5), keeps audit boundary clean.

**Hard depends on**: C1, C2. **Parallel with**: C3, C4.

### Phase D — Rollback / evolution policy

**D1. Schema evolution policy** (Sg4) — Document in
`workflow-engine/references/schema-evolution.md`:

- `metadata.version` follows semver `major.minor`.
- **Additive changes** (new optional fields, new edge conditions,
  new node types) → bump minor (2.2 → 2.3).
- **Breaking changes** (renaming a field, removing an enum value,
  changing semantics) → bump major (2.x → 3.0) and require dual-read
  support in `validate-workflow-graph.mjs` for ≥1 release.
- Validators MUST refuse to run if `metadata.version` major doesn't
  match their expected major.

**Hard depends on**: A0. **Parallel with**: anything.

**D2. Rollback / graceful degradation** (Sg4) — If Phase A causes
consumer breakage:

1. Revert `metadata.version` to `"2.1"`.
2. New rules in `validate-agents.mjs` short-circuit to `info` when
   `metadata.version < "2.2"`. Specifically:
   - `forwardReachable` works unchanged (uses `edges[]` only).
   - `return_edges`/`orchestrator_targets`/`ui_pseudo_targets`/top-
     level `challenger` treated as empty/null.
   - All `workflow-handoff-*` findings downgrade to `info`.
3. `validate-workflow-graph.mjs` accepts both 2.1 and 2.2 shapes
   (dual-read).

**Hard depends on**: A0, B0. **Parallel with**: anything.

### Phase E — Optional follow-up (out of scope)

**E1.** Remediate any drift surfaced by C4 baseline (separate PR).

**E2.** Once `kind:` adoption ≥ 80%, raise B1b severity to `warn` and
file a campaign issue to backfill remaining handoffs.

## Relevant Files

- `.github/skills/workflow-engine/templates/workflow-graph.json` — Phase A: bump `metadata.version` to 2.2, add top-level `challenger`, `return_edges`, `orchestrator_targets`, `ui_pseudo_targets`.
- `tools/schemas/workflow-graph.schema.json` — Phase A4 (allow new top-level fields, condition as string|array, version enum).
- `tools/scripts/validate-workflow-graph.mjs` — Phase A5.
- `tools/scripts/generate-explorer-graph.mjs` — Phase A6 consumer audit.
- `tools/scripts/validate-workflow-table-sync.mjs` — Phase A6 consumer audit.
- `tools/scripts/validate-agent-registry.mjs` — Phase A6 consumer audit (added in v3 sweep).
- `site/public/architecture-explorer-graph.json` — Phase A6 rebuild + diff.
- `tools/scripts/validate-agents.mjs` — Phase B (new `WORKFLOW_HANDOFF_RULES` registry, new `runWorkflowHandoffs` function, new `workflow-handoffs` PART; reuses `parseStructuredHandoffs`, `isArtifactProducer`, `getBody`).
- `tools/scripts/validate-artifacts.mjs` — Phase C2 (gate-companion file checks; add `00-handoff.md` to `ARTIFACT_HEADINGS`).
- `tools/scripts/_lib/artifact-headings.mjs` — Phase C2 (`00-handoff.md` H2 list).
- `.github/skills/workflow-engine/references/orchestrator-handoff-guide.md` — source of H2 spec for C2.
- `.github/skills/workflow-engine/references/track-parity-spec.md` — NEW (B4).
- `.github/skills/workflow-engine/references/handoff-validation-rules.md` — NEW (C5).
- `.github/skills/workflow-engine/references/schema-evolution.md` — NEW (D1).
- `package.json` — `lint:workflow-handoffs` script (C1).
- `tools/tests/workflow-handoffs/run.test.mjs` — NEW (C3).
- `tools/tests/fixtures/workflow-handoffs/` — NEW (C3): 3 synthetic `00-handoff.md` + 6 synthetic agent fixtures (one per rule).

## Verification

1. `node tools/scripts/validate-workflow-graph.mjs` passes after
   Phase A; new fields validate; `metadata.version: "2.2"` accepted.
2. `npm run build:explorer-graph` (A6) regenerates
   `architecture-explorer-graph.json` with no consumer errors;
   diff reviewed.
3. `node tools/scripts/validate-agents.mjs --list-rules` shows the
   6 new `workflow-handoff-*` rule IDs (B1a, B1b, B2, B3, B4, B5)
   under a new `workflow-handoffs` section, distinct from
   `vendor-prompting`.
4. `node tools/scripts/validate-agents.mjs
   --only=workflow-handoffs` runs cleanly on the synthetic fixtures
   (C3); each of the 6 fixtures trips exactly its target rule, and
   no fixture trips a different rule.
5. `node tools/scripts/validate-agents.mjs --suggest
   --only=workflow-handoffs` prints unified-diff patch comments
   and writes nothing (verify with `git status` clean post-run).
6. `npm run lint:artifact-templates` after C2 enforces
   `00-handoff.md` H2 structure on the 3 synthetic fixtures
   (no real `agent-output/*/00-handoff.md` exists yet).
7. `npm run validate:all` is green end-to-end.
8. `tmp/workflow-handoffs-baseline.json` (C4) lists every current
   finding by rule, severity, file. CI gating decision documented
   in PR description and the JSON committed (or referenced).
9. `npm run lint:vendor-prompting` still passes — confirms the
   `VENDOR_RULES` ↔ `rules.json` self-check is unaffected by the
   new `WORKFLOW_HANDOFF_RULES` registry.
10. Rollback dry-run: temporarily set `metadata.version` to
    `"2.1"` and confirm new rules degrade to `info` (D2);
    `validate-workflow-graph.mjs` accepts both shapes.

## Decisions

- **Deliverable**: extend `validate-agents.mjs` for
  `handoffs[]`/`agents[]` rules (separate `WORKFLOW_HANDOFF_RULES`
  registry); extend `validate-artifacts.mjs` for `00-handoff.md`
  template; new skill references under `workflow-engine`.
- **Skill home**: `workflow-engine` (NOT `vendor-prompting`).
- **Fix mode**: `--suggest` prints unified-diff patch comments;
  never modifies files.
- **DAG augmentation**: `metadata.version` bumped to 2.2 (single
  version field, D-A0). Adds top-level `challenger` (object),
  `return_edges`, `orchestrator_targets`, `ui_pseudo_targets`.
- **Edge condition shape**: string OR array of strings (D-A2b).
- **Edge policy**: forward DAG edges (length ≤ 2 across a gate),
  self-loops (bounded), declared return edges, challenger wrapper,
  orchestrator targets, UI pseudo-targets are legal. Cross-track
  jumps forbidden at `error`.
- **`return_edges[]` coverage**: includes 4 edges missed in v2
  (2→1, 4→2, 6b→2, 6t→2) (D-A2a).
- **`kind:` taxonomy** (Sg1): opt-in initially at `info`; planned
  upgrade path documented; includes new `ui` value for
  pseudo-targets.
- **Excluded sources** for B1a: `01-Orchestrator`,
  `01-Orchestrator-fastpath`, `09-Diagnose`,
  `11-Context-Optimizer`, `10-Challenger`. `e2e-orchestrator` is
  INCLUDED (S6).
- **Self-loop cap**: 6 per agent (warn above), every self-loop
  must pass `handoff-enrichment-001` (B3 references existing
  finding, no double emit).
- **`return_edges` granularity**: `to` modeled as the **step**
  (not gate).
- **Subagent dispatch (`agents[]`)** validated by B5;
  `challenger.review_subagent` and `cost-estimate-subagent` are
  the canonical entries; `agents: ["*"]` allowed only for
  cross-cutting agents (D-B5).
- **Fixtures**: 3 synthetic `00-handoff.md` + 6 synthetic agents
  (one per rule) under `tools/tests/fixtures/` (D-C3,
  D-Verification).
- **Registry separation** (D-C5):
  `WORKFLOW_HANDOFF_RULES` is its own array; the
  `VENDOR_RULES`↔`rules.json` cross-check is scoped to vendor
  rules only. Workflow rules are NOT added to
  `vendor-prompting/rules.json`.
- **`--only` filter** (D-B0): new PART `workflow-handoffs` added
  to the `PARTS` map of `validate-agents.mjs`.
- **CI gating** (S5): cross-track at `error` only after C4
  baseline confirms 0 live findings; otherwise `warn` with
  remediation issue.
- **Out of scope**: Remediating drift the new rules surface
  (Phase E1), backfilling `kind:` across all agents (E2).

## Resolved Considerations

(Carried forward from v2 + v3 deltas marked.)

1. **Cross-track severity**: B1a cross-track = `error`; rest =
   `warn`. Conditional on C4 baseline (S5).
2. **`return_edges` granularity**: model `to` as the **step**.
3. **Companion-file state check severity**: stays `info`.
   `00-handoff.md` is overwritten at every gate; between-gate
   staleness is normal.
4. **Skill home**: `workflow-engine`, not `vendor-prompting`
   (M6).
5. **`agents[]` vs `handoffs[]`**: validated as separate surfaces
   (M1).
6. **Challenger model**: structured `{wrapper_agent,
   review_subagent}` block at top level, NOT replacing per-node
   `challenger` (which carries passes/lenses).
7. **`forwardReachable` algorithm**: defined as "path of length
   ≤ 2 over `step → gate → step` with `on_complete` edges, OR
   length-1 `on_skip`" (M3).
8. **Orchestrator as universal return target**: handled via
   `orchestrator_targets[]` DAG field (M4).
9. **Self-loops**: bounded at 6 and required to pass enrichment
   (M5); B3 de-duplicates with `handoff-enrichment-001` instead
   of re-emitting.
10. **`--only` filter**: new PART `workflow-handoffs` (D-B0).
11. **Consumer compatibility**: explicit Phase A6 audit (M8),
    extended to also sweep `validate-agent-registry.mjs` and
    grep all readers.
12. **Sample size**: 3 synthetic `00-handoff.md` (no real ones
    exist) + 6 synthetic agents (D-C3, D-Verification).
13. **Track parity normalization**: structural tuple comparison;
    spec in `track-parity-spec.md` (S2).
14. **Step 3 (Design) skip path**: `forwardReachable` allows
    `on_skip` length-1 edges, so `03-Architect →
    04g-Governance` is legal via existing `step-3 → step-3_5
    (on_skip)` edge (S3).
15. **Patch suggestion format**: unified diff (`git diff -u`
    style) with file path + line numbers (S4).
16. **CI gating risk**: C4 baseline gates the `error` severity
    decision (S5).
17. **`e2e-orchestrator` inclusion**: NOT exempted (S6).
18. **`kind:` taxonomy** (Sg1): opt-in `info`; promotion path
    documented; includes `ui` for pseudo-targets (D-A2c).
19. **Companion-file checks** (Sg2): in `validate-artifacts.mjs`.
20. **Dependency tracking** (Sg3): each substep lists `Hard
    depends on` and `Parallel with`.
21. **Schema evolution & rollback** (Sg4): D1 + D2 — semver-
    style `metadata.version` (single source of truth, D-A0),
    additive-by-default, breaking changes require major bump
    and dual-read; validators degrade gracefully when
    `metadata.version < "2.2"`.
22. **Version field** (D-A0): single `metadata.version` field;
    no parallel `schema_version`.
23. **Edge condition shape** (D-A2b): string OR array of
    strings; allows one from/to pair to express both `on_fail`
    AND `on_refine`.
24. **UI pseudo-targets** (D-A2c): `ui_pseudo_targets[]`
    allowlist for non-agent UI hooks like `agent: agent`
    "Open in Editor".
25. **Wildcard `agents: ["*"]`** (D-B5): legal only for agents
    flagged `cross_cutting: true` or in
    `CROSS_CUTTING_ALLOWLIST`.
26. **Rule registry separation** (D-C5): new
    `WORKFLOW_HANDOFF_RULES` array, separate from
    `VENDOR_RULES`; vendor cross-check unchanged.
