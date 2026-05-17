# Plan 02: Subagent Isolation for Step 2 / 4 / 7 Synthesis Turns

> **Series**: Plan 02 of 3 in the token-reduction workstream.
> **Hard dependency** on
> [`01-plan-tokenreduction.prompt.md`](./01-plan-tokenreduction.prompt.md)
> — do not start this plan until Plan 01 is merged to `main`.
> **Plan 03** ([`03-plan-vnetPlanningGate.prompt.md`](./03-plan-vnetPlanningGate.prompt.md))
> is an unrelated workstream.

## Resume from a fresh chat session

This section exists so a brand-new chat with no memory can pick up the work.

- **Status**: BLOCKED on Plan 01. None of the dependencies in Phase 0
  exist yet. **Do not begin Phase 1 authoring until every Phase 0
  check below passes.**
- **Working branch**: `feat/render-subagent-isolation` — **must not
  be created until Plan 01's `feat/test04-token-reduction` is merged
  to `main`**. Creating it earlier risks rebase pain against the new
  baseline + profiler + `/clear` contract.
- **First action when resuming**:
  1. Run the Phase 0 checks in order. If any fail, halt and return to
     Plan 01 owner.
  2. Only when ALL Phase 0 checks pass:
     `git fetch origin && git checkout -b feat/render-subagent-isolation origin/main`.
  3. Create `/memories/session/plan02-progress.md` and use it as the
     live per-phase status tracker.
- **Progress tracking**: session memory only. **Do not** use
  `apex-recall` — this is a meta-improvement plan, not an APEX
  workflow project.
- **Plan is frozen**: do not edit phases, rubric thresholds, or
  locked decisions without re-running the design dialogue that
  produced them (see "Decisions captured" — every entry is locked).

## Related work already shipped

Do not re-do these — they are committed on `main`:

- **Commit `53dab573` (PR #390)** — codegen one-file-per-turn cadence
  in `06b-bicep-codegen` / `06t-terraform-codegen` plus the new
  "Phase 2: Output Cadence" section in
  `.github/skills/iac-common/references/codegen-shared-workflow.md`.
  This **retroactively validates the loop pattern chosen for Phase 3b**
  (one subagent call per As-Built artifact) — the same per-response
  output-token ceiling that drove that decision is now codified for
  codegen. The protocol authored in Phase 1 of this plan must
  reference that section so the rule stays in one place.
- **Plan 01 Phase 3** is the source of the cheaper-model routing
  changes. This plan's Phase 4 lesson ("render-subagent may permit
  cheaper model on parent") is a FOLLOW-UP, not a re-doing.

---

# Plan: Subagent Isolation for Step 2 / 4 / 7 Synthesis Turns

Dedicated plan introducing **render-subagents** that isolate the
single-shot artifact-synthesis turns of the Architect (Step 2), IaC
Planner (Step 4), and As-Built (Step 7) agents from the main session's
context window. Builds on the mechanism already proven by
`challenger-review-subagent`, `cost-estimate-subagent`, and the
`execution_subagent` wrappers in `test04-01` (25 internal spans hidden
from the parent in <11 KB of returned bytes).

**This plan is dependent on the full delivery of
[`01-plan-tokenreduction.prompt.md`](./01-plan-tokenreduction.prompt.md).**
Subagent isolation measures itself against the post-tokenreduction
baseline — without `/clear` and the multi-log baseline already in place,
the marginal saving cannot be separated from the larger
tokenreduction wins.

**Working branch**: `feat/render-subagent-isolation` (new, off `main`,
created **after** `feat/test04-token-reduction` merges).

**Target**: additional **−5 to −10 percentage points** main-agent
input-token reduction at p50, on top of the 45–55 % from
plan-tokenreduction. Combined ceiling: **−54 to −68 %** vs the
pre-tokenreduction baseline. No quality regression measured by the
A/B quality rubric (Phase 2).

Five phases. Phases 0, 1, 2 sequential BLOCKING; Phase 3 parallel
after Phase 2 PASS; Phase 4 last.

---

## Phase 0 — Prerequisites verification (BLOCKING, sequential)

This plan must not start until token-reduction has shipped. Confirm
the dependencies before any authoring begins.

**Checks** (all must PASS):

1. `feat/test04-token-reduction` is merged to `main`.
2. `agent-output/_baselines/multi-log-baseline.json` exists with N≥3
   logs (tokenreduction Phase 0 output).
3. `tools/scripts/profile_debug_log.py` exists and runs (tokenreduction
   Phase 1 output).
4. Gate-boundary `/clear` handoff is live in the orchestrator
   (tokenreduction Phase 2a) — verified by grep for the handoff cue
   in `01-orchestrator.agent.md`.
5. `tests/integration/smoke-run.md` exists (tokenreduction Phase 5
   output) — used as the harness for Phase 4 of this plan.
6. Lessons-learned from a real post-tokenreduction workflow run are
   captured in `/memories/repo/log-profile-baselines.md` (so the new
   baseline range is known, not assumed).

**Stop rule**: if any check fails, halt this plan and route back to
the owner of the relevant tokenreduction phase. Do not begin Phase 1.

**Verification**: write the prerequisite checklist + results to
`agent-output/_baselines/render-subagent-prereq.md` (manual artifact,
not a workflow output).

---

## Phase 1 — Protocol authoring inside `context-management` skill (BLOCKING, sequential)

Single canonical source of truth for the render-subagent contract.
**No new skill is created** — the protocol extends the existing
`context-management` skill (Mode A: Runtime Compression, Mode B: Audit
→ adds **Mode C: Render-Subagent Isolation**).

**Files touched**:

1. **`.github/skills/context-management/SKILL.md`** — add a `Mode C`
   section (≤15 lines) that indexes the new reference file. Update the
   skill `description` to mention render-subagent isolation alongside
   runtime compression and audit. Update the `WHEN` triggers to
   include `"render subagent"`, `"isolation protocol"`,
   `"step 2/4/7 synthesis"`.
2. **`.github/skills/context-management/references/render-subagent-protocol.md`**
   — NEW file. Contains:
   - **Cadence contract**: pre-gather inputs → invoke → receive
     `complete` or `needs_info` → handle.
   - **Schema**: JSON shape of subagent return value.

     ```json
     {
       "status": "complete | needs_info | error",
       "artifact_path": "agent-output/{project}/04-implementation-plan.md",
       "summary_line": "≤120 chars for orchestrator handoff",
       "questions": [ /* present only when status == needs_info */
         { "key": "rpo_minutes", "prompt": "...", "options": [...] }
       ],
       "error": { "code": "...", "detail": "..." }  // when status == error
     }
     ```

   - **`needs_info` escape hatch rules** (per the locked decision):
     - Default: subagent renders with all inputs pre-gathered by the
       parent — no `needs_info` emitted.
     - Escape hatch: subagent MAY emit `needs_info` only for
       genuinely blocking gaps (a required Wave-1 contract field is
       missing, an unresolved Deny-policy maps to none of the
       supplied inputs, etc.).
     - Minor gaps (style choices, optional fields) MUST be rendered
       as documented assumptions in the artifact body, not bounced
       back to the parent.
   - **Cap on re-invocation**: parent may re-invoke the same subagent
     at most **twice** per artifact (3 calls total). On the third
     `needs_info`, parent must surface the loop to the user via
     `askQuestions` with Accept-assumptions / Override / Abort
     options.
   - **Error taxonomy**: `MISSING_INPUT`, `SCHEMA_VIOLATION`,
     `TEMPLATE_LOAD_FAIL`, `WRITE_FAIL`, `UNEXPECTED`. Parent action
     per code documented in a table.
   - **Quality rubric** (re-used by Phase 2 A/B pilot, see below).
   - **Anti-patterns**: subagent calling `vscode_askQuestions` (it
     cannot); subagent invoking another subagent (depth limit);
     subagent reading conversation history (it has none).
3. **`tools/scripts/validate-render-subagent-contract.mjs`** — NEW.
   Static check that every agent claiming `render-subagent` capability
   declares the return schema in its frontmatter and references
   `render-subagent-protocol.md`. Wire into `npm run validate:agents`
   as a hard fail.

**Stop rule**: do not start Phase 2 until the validator runs green on
`context-management/references/render-subagent-protocol.md` and the
SKILL.md index entry.

**Verification**: `npm run validate:agents` passes; `npm run lint:md`
passes on the two `context-management` files.

---

## Phase 2 — Step 4 A/B pilot (BLOCKING, sequential)

Pilot the entire render-subagent pattern on Step 4 (IaC Planner)
first. Step 4 chosen because: (a) inputs are the most deterministic
post-tokenreduction (plan-readiness contract is mature), (b) its
synthesis turn is the largest single output payload after As-Built,
(c) failure mode is recoverable (return-to-Step-4 handoff already
exists).

**Pilot branch**: `pilot/render-subagent-step4` off
`feat/render-subagent-isolation`.

**Steps**:

1. **Author** `.github/agents/04-iac-plan-render-subagent.agent.md` —
   thin wrapper agent that:
   - Reads `context-management/references/render-subagent-protocol.md`
     at boot.
   - Accepts inputs: project name, all Wave-1 contract artifacts, plan
     template, decisions snapshot from `apex-recall show`.
   - Returns the JSON schema above.
   - Does NOT call `vscode_askQuestions` (anti-pattern from the
     protocol).
   - Body ≤200 lines (well under the 520-line cap; this is a thin
     dispatch wrapper, not a full agent).
2. **Modify** `.github/agents/05-iac-planner.agent.md` — replace its
   inline synthesis turn with a `runSubagent` call to the new
   render-subagent. Keep all interactive question-gathering, gate
   logic, challenger orchestration, and apex-recall checkpoints in
   the main agent. Only the "now write the artifact body" turn
   moves into the subagent.
3. **Register** the new subagent in
   `.github/agent-registry.json` (or wherever the registry lives —
   `tools/scripts/_lib/paths.mjs` will reveal it).
4. **Measure** against the multi-log baseline:
   - Run the same Step-4 input through both the legacy main-agent
     synthesis path and the new render-subagent path.
   - Profile both with `profile_debug_log.py`.
   - Score against the rubric below.

**A/B quality rubric** (all must PASS to merge the pilot):

| Criterion | Threshold |
|---|---|
| Token saving | Render-subagent path uses **≥4 pp fewer main-agent input tokens** than legacy path on identical input |
| Artifact challenger-finding parity | Same finding set within **±10 %** count and no NEW BLOCKER findings introduced |
| AVM-module coverage | Same set of AVM modules used (no silent drops); count may only stay flat or grow |
| Wave-1 contract completeness | `04-iac-contract.json` / `04-policy-property-map.json` / `04-environment-manifest.json` fields ALL populated — `needs_info` permitted only for fields the legacy path also left empty |
| `needs_info` round-trips | ≤2 per artifact in the pilot run |
| Wall-clock (agent + user-wait, per S2) | Within **±15 %** of legacy path on the same input |
| Silent-assumption count | Subagent-injected assumptions ≤ legacy path's count (no quality compromise via hidden defaults) |

**Stop rule**: if any rubric criterion fails, halt fan-out. Either
revise the protocol (Phase 1 follow-up) or abandon the pilot and
document the root cause in `/memories/repo/render-subagent-pilot.md`.

**Verification**: pilot branch carries
`agent-output/_baselines/render-subagent-pilot-step4.json` with raw
profiler output for both paths and the rubric scorecard.

---

## Phase 3 — Fan-out to Steps 2 + 7 (parallel after Phase 2 PASS)

Only enter after Phase 2 PASS. Two parallel sub-tracks because the
agents are independent; share the validated protocol from Phase 1.

### Phase 3a — Step 2 Architecture render-subagent

1. Author `.github/agents/02-architect-render-subagent.agent.md`.
2. Modify `.github/agents/03-architect.agent.md` to dispatch the
   WAF + cost-estimate synthesis turn to the new subagent. Keep
   WAF interview, alternatives gathering, and cost-feasibility review
   logic in the main agent.
3. Measure with the same rubric as Phase 2, scoped to Step 2 inputs.
4. Pre-existing `cost-estimate-subagent` continues to run inside the
   render-subagent — depth limit of two is fine per the protocol's
   anti-pattern table, since the cost-estimate result is precomputed
   by the parent before invoking the render-subagent.

### Phase 3b — Step 7 As-Built render-subagent

Step 7 generates 6–7 separate documents (design doc, runbook, cost,
compliance matrix, BCDR, inventory, index). Two viable shapes:

- **Single subagent invocation, full suite**: matches the existing
  As-Built monolithic body; highest single-call cost but cleanest
  contract.
- **Per-artifact subagent invocations** (loop): each document is its
  own call. Lower per-call cost but multiple round-trips.

**Decision**: start with the loop pattern (per-artifact invocation).
The 06b/06t length-limit incident proved that a single response
emitting 6+ files trips the per-response output-token ceiling. The
loop pattern naturally avoids it.

1. Author `.github/agents/07-asbuilt-render-subagent.agent.md` — one
   subagent body, but invoked once per As-Built artifact.
2. Modify `.github/agents/08-as-built.agent.md` to drive the loop:
   read inputs once, then dispatch 6 subagent calls (one per artifact),
   each returning the protocol schema.
3. Rubric: same as Phase 2 but apply per-artifact. Aggregate score
   must PASS across all artifacts.

**Stop rule** (both sub-tracks): if either Step 2 or Step 7 fails the
rubric, halt that sub-track and document root cause. The other
sub-track continues if it passes.

**Verification**: per-sub-track `*-pilot-step2.json` / `*-step7.json`
in `agent-output/_baselines/`.

---

## Phase 4 — Validation, docs, lessons (final)

After Phase 3 completes (one or both sub-tracks).

1. **Smoke run**: execute `tests/integration/smoke-run.md` (the
   harness from tokenreduction Phase 5) end-to-end against a
   representative project. Confirm:
   - All three render-subagents fire when expected.
   - `needs_info` escape hatch fires at most where the legacy paths
     also had open questions.
   - Combined `/clear` + render-subagent token saving meets the
     −54 to −68 % combined target.
2. **Update `AGENTS.md`** Agent Workflow table: mark Steps 2, 4, 7 as
   "synthesis turn isolated via render-subagent". One row addition,
   no schema break.
3. **Update `.github/copilot-instructions.md` → Skills section**: one
   line confirming `context-management` now hosts Mode C.
4. **Update `count-manifest.json`** with the new subagent count
   (per `no-hardcoded-counts.instructions.md`).
5. **Lessons-learned**: append a single section to
   `/memories/repo/codegen-model-mix-2026.md` covering whether
   render-subagent isolation changed the recommended model routing
   for the parent agents (likely: cheaper model on parent now that
   it carries less context).
6. **PR checklist update**: extend the PR template's token-reduction
   YES/NO checkbox (from tokenreduction S5) with a second checkbox:
   "Render-subagent dispatch verified: YES/NO" — only required when
   touching Steps 2, 4, or 7 agents.

**Verification**: `npm run validate:all` passes; smoke-run profiler
output committed to `agent-output/_baselines/render-subagent-final.json`;
PR description references the rubric scorecard.

---

## Risk register

| Risk | Likelihood | Impact | Rollback |
|---|---|---|---|
| Render-subagent's input cost (full inputs passed once per call) outweighs the main-context saving on a small project | Medium | Medium | Skip the dispatch for projects where the plan-readiness summary < 30 KB; threshold in the protocol |
| `needs_info` loop hits the 2-call cap and surfaces an `askQuestions` to the user, eroding the no-friction promise | Medium | Low | Acceptable per locked decision; the visible re-prompt is the safety valve |
| Iterative artifact refinement after challenger review costs full-input re-render | High | Medium | Document as a known cost in the protocol; refinements <500 char remain in main agent, not re-dispatched |
| `cost-estimate-subagent` invoked inside `02-architect-render-subagent` exceeds subagent-depth limit | Low | High | Pre-compute cost estimate in main agent before dispatching render-subagent (already in plan) |
| New validator (`validate-render-subagent-contract.mjs`) adds >5s to `validate:all` | Low | Low | Parallelise with existing validators (per tokenreduction N3) |
| Step 7 loop dispatches accidentally batch into one response and re-trigger the codegen length-limit failure mode | Low | High | Render-subagent protocol explicitly inherits the one-file-per-turn rule from `codegen-shared-workflow.md` Phase 2 cadence |
| Pilot branch quality regression invisible until a real workflow run | Medium | High | Mandatory smoke-run before merging the pilot to feature branch |
| Combined `/clear` + render-subagent saving < projected −54 to −68 % | Medium | Low | Document actual measured range; do not block on missing 1–2 pp |

---

## Decisions captured

- **Scope (locked)**: Steps 2 (Architecture), 4 (IaC Plan), 7
  (As-Built). Step 3.5 (Governance) **dropped** — `discover.py`
  already isolates the deterministic work; the markdown synthesis is
  too small to justify a render-subagent.
- **Architecture (locked)**: hybrid — thin per-step wrapper agents
  (`02-architect-render-subagent`, `04-iac-plan-render-subagent`,
  `07-asbuilt-render-subagent`) backed by a shared
  `render-subagent-protocol.md` reference inside the existing
  `context-management` skill. **No new skill is created.**
- **Existing skill chosen for protocol**: `context-management`.
  Rationale: already the canonical home for context-window concerns;
  already loaded by orchestrator and codegen agents; new content
  becomes Mode C alongside Mode A (Runtime Compression) and Mode B
  (Audit).
- **`needs_info` contract (locked)**: pre-gather as default,
  `needs_info` as escape hatch for genuinely blocking gaps only.
  Re-invocation capped at 2.
- **Rollout (locked)**: A/B pilot on Step 4 only. Quality rubric must
  PASS before fan-out to Steps 2 + 7.
- **Token-reduction dependency (locked)**: full
  [`01-plan-tokenreduction.prompt.md`](./01-plan-tokenreduction.prompt.md)
  complete and merged before Phase 0
  of this plan begins.
- **Branch**: `feat/render-subagent-isolation` off `main` (post
  token-reduction merge).
- **Step 7 invocation shape**: loop pattern (one subagent call per
  As-Built artifact) — avoids the per-response output-token ceiling
  that hit the 06b codegen on the multi-file emission.

---

## Out of scope

- **Step 1 (Requirements)** — 5–10 interactive clarifying questions
  with branching follow-ups. Subagent isolation incompatible with
  multi-turn `askQuestions` flow.
- **Step 3.5 (Governance)** — `discover.py` already provides
  deterministic isolation; markdown synthesis too small to justify
  the wrapper overhead.
- **Step 5 (CodeGen)** — already isolated per file via the
  one-file-per-turn cadence (`codegen-shared-workflow.md` Phase 2).
- **Step 6 (Deploy)** — already isolated via
  `bicep-whatif-subagent`, `terraform-plan-subagent`,
  `policy-precheck-subagent`.
- **Iterative refinement after challenger review** — refinements
  <500 char stay in main agent (full-input re-dispatch would erase
  the saving).
- **Model-routing changes** — covered by
  [`01-plan-tokenreduction.prompt.md`](./01-plan-tokenreduction.prompt.md)
  Phase 3; this plan only flags the follow-up lesson in Phase 4.
- **Cross-step subagent reuse** — each step gets its own thin
  wrapper. Resist the temptation to collapse them into a single
  generic `render-subagent` (locked decision).
- **A user-facing toggle to disable render-subagents** — if the
  rubric passes, the dispatch is unconditional. Opt-out would
  double the surface area for parity testing.
