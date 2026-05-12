# Plan: Verify Agent Hand-Offs Are In Line With Workflow (v2)

Validate that every agent `handoffs[]` UI button, every `agents[]` subagent
dispatch entry, every `00-handoff.md` companion file, and the Bicep/Terraform
track parity all match the authoritative `workflow-graph.json` DAG. Extend
the DAG to declare `return_edges`, a structured `challenger` block, and a
schema version. Add an opt-in `kind:` taxonomy on handoff entries to make
intent explicit. Surface findings as `--suggest`-only patch comments.

## Goal

For every workflow handoff seam, prove that what an agent's frontmatter says
(both `handoffs[]` and `agents[]`) matches what the DAG declares, what its
peers expect, and what `00-handoff.md` records — across Bicep and Terraform
tracks, with explicit kind taxonomy and a documented evolution path.

## Scope clarifications (post-review)

- **Two distinct surfaces** validated separately:
  - `handoffs[]` — UI buttons (label/agent/prompt) — checked by rules in
    `validate-agents.mjs`.
  - `agents[]` — `#runSubagent` dispatch list — checked by a new rule
    against the DAG's `challenger.review_subagent` and known subagent
    inventory.
- **`00-handoff.md` template structure** moves to `validate-artifacts.mjs`
  (Sg2) co-located with other H2-sync artifact rules.
- **Skill home** for new rules: `workflow-engine` (NOT `vendor-prompting`).

## Phases & Steps

> **Dependency notation**: each substep lists `Hard depends on` (must
> complete first) and `Parallel with` (independent). Tests (C3) depend on
> all of B; baseline run (C4) depends on C1 + C2.

### Phase A — Ground truth: extend `workflow-graph.json`

**A0. Schema versioning** — Add top-level `schema_version: "2.2"` to
`workflow-graph.json` (current implicit version = 2.1 per `metadata.version`).
All Phase A additions ride on this bump. **Hard depends on**: none.
**Parallel with**: none.

**A1. Structured challenger block** — Replace the implicit single-node
challenger model with:

```json
"challenger": {
  "wrapper_agent": "10-Challenger",
  "review_subagent": "challenger-review-subagent"
}
```

The wrapper is a legal `handoffs[].agent` target (UI button); the subagent
is a legal `agents[]` entry (`#runSubagent` dispatch). They are NOT
interchangeable. **Hard depends on**: A0. **Parallel with**: A2.

**A2. `return_edges[]`** — Sibling to `edges[]`. Shape:
`{ from: <step-id>, to: <step-id>, condition: "on_fail" | "on_refine", reason: "<text>" }`.
Populate with edges that exist today only in agent prose:

- `step-5b → step-4` (Bicep CodeGen → Planner) — `on_fail`
- `step-5t → step-4` (Terraform CodeGen → Planner) — `on_fail`
- `step-6b → step-5b` — `on_fail`
- `step-6t → step-5t` — `on_fail`
- `step-1 → step-1`, `step-2 → step-2`, `step-3_5 → step-3_5`,
  `step-4 → step-4` — `on_refine`

`to` is modeled as the **step** (matches handoff button landing). **Hard
depends on**: A0. **Parallel with**: A1.

**A3. `orchestrator_targets[]`** — New top-level field listing agent names
that may be handed off to from anywhere as legal "return to orchestrator"
targets: `["01-Orchestrator", "01-Orchestrator-fastpath"]`. Resolves M4
(every agent today has "↩ Return to Orchestrator"). **Hard depends on**:
A0. **Parallel with**: A1, A2.

**A4. Schema update** — Update `tools/schemas/workflow-graph.schema.json`
to permit `schema_version`, `challenger` (object), `return_edges`,
`orchestrator_targets`. Extend edge `condition` enum to include
`on_refine` (already has `on_fail`). **Hard depends on**: A1, A2, A3.
**Parallel with**: none.

**A5. Graph validator update** — Extend `validate-workflow-graph.mjs` to
validate the new fields (referenced agents exist, return_edge sources/
targets are valid step IDs, no duplicates with `edges[]`, `schema_version`
matches a known minor version). **Hard depends on**: A4. **Parallel with**:
none.

**A6. Consumer inventory & compat check** (M8) — Audit consumers of
`workflow-graph.json` and confirm graceful handling of new fields:

- `generate-explorer-graph.mjs` — verify reads only known fields
- `validate-workflow-table-sync.mjs` — verify no break on new fields
- `architecture-explorer-graph.json` (built artifact) — rebuild and diff
- Any agent prose that quotes the graph schema

**Hard depends on**: A1-A5. **Parallel with**: none.

### Phase B — Rule core (handoff target/kind/artifact alignment)

All rules added to the inline `VENDOR_RULES`-style registry in
`validate-agents.mjs` (existing pattern), with rule IDs prefixed
`workflow-handoff-*`. Severity defaults below; `--suggest` flag prints
unified-diff-style patch suggestions to stdout but writes nothing.

**B0. `--only` filter dispatch** (M7) — Extend the `--only=<group>`
parsing in `validate-agents.mjs` to recognize `--only=workflow-handoffs`
and select rules by `workflow-handoff-*` ID prefix. Mirrors the existing
`vendor-prompting` filter pattern. **Hard depends on**: Phase A complete.
**Parallel with**: none.

**B1a. `workflow-handoff-target-001` (warn)** — Validate
`handoffs[].agent` target legality. A target is legal iff:

1. It is the same agent (self-loop), OR
2. It is in `orchestrator_targets[]` (return-to-orchestrator), OR
3. It is `challenger.wrapper_agent` (review button), OR
4. There exists `forwardReachable(source_step, target_step)` defined as:
   "a path `step-X → gate-? → step-Y` of length ≤ 2 in `edges[]` with
   `condition: on_complete`, OR a length-1 `on_skip` edge", OR
5. There exists a matching entry in `return_edges[]` with
   `from: source_step, to: target_step`.

Cross-track jumps (`step-5b → step-6t`, `step-5t → step-6b`, `step-6b →
step-5t`, `step-6t → step-5b`) are **always illegal** and emit `error`
severity regardless of any of the above (M3 resolution).

**Excluded as sources** (skipped entirely): `01-Orchestrator`,
`01-Orchestrator-fastpath`, `09-Diagnose`, `11-Context-Optimizer`,
`10-Challenger` (wrapper itself).
**`e2e-orchestrator` is NOT excluded** (S6 — its handoffs SHOULD align
with the DAG).

**Hard depends on**: B0. **Parallel with**: B1b, B2, B5.

**B1b. `workflow-handoff-kind-001` (info, opt-in to warn)** (Sg1) —
When a `handoffs[]` entry includes a `kind:` field, validate it matches
the DAG-derived edge type:

| `kind` value  | Required DAG match                                |
| ------------- | ------------------------------------------------- |
| `forward`     | `forwardReachable(source_step, target_step)` true |
| `self-refine` | source agent == target agent                      |
| `return`      | `return_edges[]` contains the edge                |
| `challenger`  | target == `challenger.wrapper_agent`              |
| `meta`        | target ∈ `orchestrator_targets[]`                 |

Initial severity = `info` (kind field is opt-in for now). Documented
upgrade path: when ≥80% of handoffs in repo carry `kind:`, raise to
`warn`; when 100%, make `kind:` required (separate rule). **Hard depends
on**: B0. **Parallel with**: B1a, B2, B5.

**B2. `workflow-handoff-artifact-sync-001` (warn)** — For every artifact
path in a handoff `prompt` (regex: `agent-output/\{project\}/[\w.-]+\.md`):

- If the path appears after `Input:` → must be in source step's
  `produces[]` OR any upstream step's `produces[]`.
- If the path appears after `Output:` → must be in source step's
  `produces[]` (when self-loop) OR target step's `produces[]` (when
  forward edge).

Reuses the path regex from `checkHandoffEnrichment`. **Hard depends on**:
B0. **Parallel with**: B1a, B1b, B5.

**B3. `workflow-handoff-self-loop-bound-001` (warn)** (M5) — Self-loop
handoffs are legal but bounded:

- Max 6 self-loops per agent (warn above; matches current Architect's 4)
- Every self-loop prompt MUST satisfy `handoff-enrichment-001`
  (Input + Output references) — re-emits as this rule when violated in
  a self-loop context

**Hard depends on**: B0. **Parallel with**: B1a, B1b, B2, B5.

**B4. `workflow-handoff-track-parity-001` (warn)** (M5/S2) — For
dual-track agents (06b/07b vs 06t/07t):

Compare normalized handoff *structure*, not raw strings:

1. Strip `Bicep|Terraform|terraform|bicep|TF|tf` tokens from labels
2. Map track-specific subagent names:
   `bicep-whatif-subagent` ↔ `terraform-plan-subagent`
3. Compare resulting tuples `(label_normalized, target_role, kind)`
   where `target_role` collapses 06b/06t → "codegen", 07b/07t → "deploy",
   etc.

Asymmetries fail. Document the normalization spec in
`workflow-engine/references/track-parity-spec.md`. **Hard depends on**:
B0. **Parallel with**: B1a, B1b, B2, B3.

**B5. `workflow-handoff-subagent-dispatch-001` (warn)** (M1) — NEW —
validates `agents[]` (the subagent dispatch list, distinct from
`handoffs[]`):

- Every entry must be either a known top-level agent name OR a known
  subagent in `.github/agents/_subagents/` (build inventory at startup).
- If an entry is `challenger-review-subagent`, source agent must be
  recognized as artifact-producing (B5 reuses the
  `isArtifactProducer` heuristic from `validate-agents.mjs`).
- If an entry is `cost-estimate-subagent`, source must be 03-Architect or
  08-As-Built (the only two pricing-authoritative steps per
  `orchestrator-handoff-guide.md`).

**Hard depends on**: B0, A1 (needs `challenger.review_subagent`).
**Parallel with**: B1a, B1b, B2, B3, B4.

### Phase C — Wire-up, tests, baseline

**C1. npm script** — Add `lint:workflow-handoffs` as alias for
`node tools/scripts/validate-agents.mjs --only=workflow-handoffs`. Add to
`validate:_node` and `validate:_node-ci`. **Hard depends on**: Phase B
complete. **Parallel with**: C2.

**C2. Companion-file artifact rule** (Sg2) — Move B3 (was
`handoff-doc-template-001`) to `validate-artifacts.mjs`:

- Add `00-handoff.md` to the artifact templates table
- Required H2 sections from `orchestrator-handoff-guide.md`:
  `## Completed Steps`, `## Key Decisions`, `## Open Challenger Findings
  (must_fix only)`, `## Context for Next Step`, `## Skill Context`,
  `## Artifacts`
- ≤60 line cap (configurable, but default to spec)

The cohesion check (was B4 / `handoff-doc-state-001`) — `## Artifacts`
section must list union of `produces[]` for completed steps — also
moves to `validate-artifacts.mjs` at `info` severity.

**Hard depends on**: Phase A (needs `produces[]` in DAG).
**Parallel with**: C1.

**C3. Test fixtures and regression tests** (S1) — Under
`tools/tests/fixtures/workflow-handoffs/`:

- 3 synthetic `00-handoff.md` files (one per major gate: G1, G2.5, G5)
  with deliberate structural variety
- 5 synthetic agent fixtures, each tripping exactly one of B1a/B1b/B2/
  B3/B4/B5 (one fixture per rule)
- Negative fixtures: cross-track jump (must hit `error`), missing
  artifact ref, asymmetric track, oversized self-loop list, illegal
  subagent

Tests added to `tools/tests/workflow-handoffs/run.test.mjs` using
`node --test`. **Hard depends on**: B1a, B1b, B2, B3, B4, B5, C2.
**Parallel with**: none.

**C4. Live-repo baseline + CI gating decision** (S5) — BEFORE merging
C1's wire-up to `validate:_node-ci`:

1. Run `node tools/scripts/validate-agents.mjs --only=workflow-handoffs`
   against the live repo
2. Capture findings to `tmp/workflow-handoffs-baseline.json`
3. **Decision branch**:
   - If 0 `error` findings (no cross-track jumps in live repo) →
     proceed with B1a cross-track at `error`
   - If `error` findings exist → downgrade to `warn` initially, file
     a remediation issue tracking the fixes, raise to `error` after
     remediation merges

**Hard depends on**: C1, C2. **Parallel with**: C3.

**C5. Skill home** (M6) — Document the new rules in
`.github/skills/workflow-engine/`:

- Add `references/handoff-validation-rules.md` listing each rule, its
  severity, and the DAG fields it consults
- Add `references/track-parity-spec.md` (the B4 normalization spec)
- Update `SKILL.md` and `SKILL.digest.md` to mention the new
  validation surface
- Do NOT add to `vendor-prompting/rules.json` — keeps audit boundary
  clean

**Hard depends on**: C1, C2. **Parallel with**: C3, C4.

### Phase D — Rollback / evolution policy

**D1. Schema evolution policy** (Sg4) — Document in
`workflow-engine/references/schema-evolution.md`:

- `schema_version` follows semver (`major.minor`)
- **Additive changes** (new optional fields, new edge conditions, new
  node types) → bump minor (2.2 → 2.3)
- **Breaking changes** (renaming a field, removing an enum value,
  changing semantics) → bump major (2.x → 3.0) and require dual-read
  support in `validate-workflow-graph.mjs` for ≥1 release
- Validators MUST refuse to run if `schema_version` major doesn't match
  their expected major

**Hard depends on**: A0. **Parallel with**: anything.

**D2. Rollback plan** (Sg4) — If Phase A causes consumer breakage:

1. Revert `workflow-graph.json` to schema_version 2.1
2. Validators read `schema_version` and skip `return_edges`/`challenger`
   block-aware checks below 2.2 (graceful degradation)
3. New rules in `validate-agents.mjs` short-circuit to `info` when DAG
   schema_version < 2.2

**Hard depends on**: A0, B0. **Parallel with**: anything.

### Phase E — Optional follow-up

**E1.** Remediate any drift surfaced by C4 (separate PR; out of scope
for this plan).

**E2.** Once `kind:` adoption ≥ 80%, raise B1b severity to `warn` and
file a campaign issue to backfill remaining handoffs.

## Relevant Files

- [.github/skills/workflow-engine/templates/workflow-graph.json](.github/skills/workflow-engine/templates/workflow-graph.json) — Phase A: add `schema_version`, `challenger`, `return_edges`, `orchestrator_targets`
- [tools/schemas/workflow-graph.schema.json](tools/schemas/workflow-graph.schema.json) — Phase A4
- [tools/scripts/validate-workflow-graph.mjs](tools/scripts/validate-workflow-graph.mjs) — Phase A5
- [tools/scripts/generate-explorer-graph.mjs](tools/scripts/generate-explorer-graph.mjs) — Phase A6 consumer audit
- [tools/scripts/validate-workflow-table-sync.mjs](tools/scripts/validate-workflow-table-sync.mjs) — Phase A6 consumer audit
- [tools/scripts/validate-agents.mjs](tools/scripts/validate-agents.mjs) — Phase B (B0-B5 rules; reuse `parseStructuredHandoffs`, `isArtifactProducer`, `getBody`, `VENDOR_RULES` registry pattern, `--only` dispatch)
- [tools/scripts/validate-artifacts.mjs](tools/scripts/validate-artifacts.mjs) — Phase C2 (gate-companion file checks)
- [.github/skills/workflow-engine/references/orchestrator-handoff-guide.md](.github/skills/workflow-engine/references/orchestrator-handoff-guide.md) — source of H2 spec for C2
- [.github/skills/workflow-engine/references/track-parity-spec.md](.github/skills/workflow-engine/references/track-parity-spec.md) — NEW (B4)
- [.github/skills/workflow-engine/references/handoff-validation-rules.md](.github/skills/workflow-engine/references/handoff-validation-rules.md) — NEW (C5)
- [.github/skills/workflow-engine/references/schema-evolution.md](.github/skills/workflow-engine/references/schema-evolution.md) — NEW (D1)
- [package.json](package.json) — `lint:workflow-handoffs` (C1)
- [tools/tests/workflow-handoffs/run.test.mjs](tools/tests/workflow-handoffs/run.test.mjs) — NEW (C3)
- [tools/tests/fixtures/workflow-handoffs/](tools/tests/fixtures/workflow-handoffs/) — NEW (C3)
- [agent-output/nordic-foods/00-handoff.md](agent-output/nordic-foods/00-handoff.md) — only existing instance; one of three C3 fixtures

## Verification

1. `node tools/scripts/validate-workflow-graph.mjs` passes after Phase A; new fields validate; schema_version recognized.
2. `npm run build:explorer-graph` (A6) regenerates `architecture-explorer-graph.json` with no consumer errors.
3. `node tools/scripts/validate-agents.mjs --list-rules` shows the 6 new `workflow-handoff-*` rule IDs (B1a, B1b, B2, B3, B4, B5).
4. `node tools/scripts/validate-agents.mjs --only=workflow-handoffs` runs cleanly on the synthetic fixtures (C3); each fixture trips exactly its target rule.
5. `node tools/scripts/validate-agents.mjs --suggest --only=workflow-handoffs` prints unified-diff patch comments and writes nothing.
6. `npm run lint:artifact-templates` after C2 enforces `00-handoff.md` H2 structure on `agent-output/*/00-handoff.md` files.
7. `npm run validate:all` is green end-to-end.
8. `tmp/workflow-handoffs-baseline.json` (C4) lists every current finding by rule, severity, file; CI gating decision documented in PR description.
9. Rollback dry-run: temporarily set `schema_version` to `"2.1"` and confirm new rules degrade to `info` (D2).

## Decisions

- **Deliverable**: Extend `validate-agents.mjs` for `handoffs[]`/`agents[]` rules; extend `validate-artifacts.mjs` for `00-handoff.md` template; new skill references under `workflow-engine`.
- **Skill home**: `workflow-engine` (NOT `vendor-prompting`).
- **Fix mode**: `--suggest` prints unified-diff patch comments; never modifies files.
- **DAG augmentation**: schema_version 2.2 adds `challenger` (object), `return_edges`, `orchestrator_targets`.
- **Edge policy**: forward DAG edges (length ≤ 2 across a gate), self-loops (bounded), declared return edges, challenger wrapper, orchestrator targets are legal. Cross-track jumps forbidden at `error`.
- **`kind:` taxonomy** (Sg1): opt-in initially at `info`; planned upgrade path documented.
- **Excluded sources** for B1a: `01-Orchestrator`, `01-Orchestrator-fastpath`, `09-Diagnose`, `11-Context-Optimizer`, `10-Challenger`. `e2e-orchestrator` is INCLUDED (S6).
- **Self-loop cap**: 6 per agent (warn above), every self-loop must pass `handoff-enrichment-001`.
- **`return_edges` granularity**: `to` modeled as the **step** (not gate).
- **Subagent dispatch (`agents[]`)** validated by B5; `challenger.review_subagent` and `cost-estimate-subagent` are the canonical entries.
- **Fixtures**: 3+ synthetic `00-handoff.md` and one synthetic agent per rule under `tools/tests/fixtures/`.
- **CI gating** (S5): cross-track at `error` only after C4 baseline confirms 0 live findings; otherwise `warn` with remediation issue.
- **Out of scope**: Remediating drift the new rules surface (Phase E1), backfilling `kind:` across all agents (E2).

## Resolved Considerations

1. **Cross-track severity**: B1a cross-track = `error`; rest = `warn`.
   Matches `frontmatter-model-style-001` precedent for structural (not
   stylistic) violations. Conditional on C4 baseline (S5).
2. **`return_edges` granularity**: model `to` as the **step** — aligns
   with handoff button landing.
3. **Companion-file state check severity**: stays `info`. `00-handoff.md`
   is overwritten at every gate; between-gate staleness is normal.
4. **Skill home**: `workflow-engine`, not `vendor-prompting` (M6).
5. **`agents[]` vs `handoffs[]`**: validated as separate surfaces (M1).
6. **Challenger model**: structured `{wrapper_agent, review_subagent}`
   block, not a single scalar (M2).
7. **`forwardReachable` algorithm**: defined as "path of length ≤ 2 over
   `step → gate → step` with `on_complete` edges, OR length-1 `on_skip`"
   (M3).
8. **Orchestrator as universal return target**: handled via
   `orchestrator_targets[]` DAG field (M4).
9. **Self-loops**: bounded at 6 and required to pass enrichment (M5).
10. **`--only` filter**: extended to recognize `workflow-handoffs` group
    via `workflow-handoff-*` ID prefix (M7).
11. **Consumer compatibility**: explicit Phase A6 audit (M8).
12. **Sample size**: 3 synthetic + 1 real `00-handoff.md` fixtures (S1).
13. **Track parity normalization**: structural tuple comparison, not raw
    strings; spec documented in `track-parity-spec.md` (S2).
14. **Step 3 (Design) skip path**: `forwardReachable` algorithm allows
    `on_skip` length-1 edges, so `03-Architect → 04g-Governance` is
    legal via the existing `step-3 → step-3_5 (on_skip)` edge (S3).
15. **Patch suggestion format**: unified diff (`git diff -u` style) with
    file path + line numbers (S4).
16. **CI gating risk**: C4 baseline gates the `error` severity decision
    (S5).
17. **`e2e-orchestrator` inclusion**: NOT exempted; its handoffs SHOULD
    align with the DAG (S6).
18. **`kind:` taxonomy** (Sg1): opt-in `info`; promotion path
    documented.
19. **Companion-file checks** (Sg2): moved to `validate-artifacts.mjs`.
20. **Dependency tracking** (Sg3): each substep lists `Hard depends on`
    and `Parallel with`.
21. **Schema evolution & rollback** (Sg4): Phase D1 + D2 — semver-style
    `schema_version`, additive-by-default, breaking changes require
    major bump and dual-read; validators degrade gracefully when
    `schema_version` < expected.
