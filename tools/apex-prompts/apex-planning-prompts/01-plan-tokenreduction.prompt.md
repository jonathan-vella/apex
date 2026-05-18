# Plan 01: Token-reduction (test04-01 findings)

> **Series**: Plan 01 of 3 in the token-reduction workstream.
> **Plan 02** ([`02-plan-subagent-isolation.prompt.md`](./02-plan-subagent-isolation.prompt.md))
> is a dependent follow-up — do not start it until this plan merges.
> **Plan 03** ([`03-plan-vnetPlanningGate.prompt.md`](./03-plan-vnetPlanningGate.prompt.md))
> is an unrelated workstream.

## Resume from a fresh chat session

This section exists so a brand-new chat with no memory can pick up the work.

- **Status**: NOT STARTED. Phase 0 has not run; no baseline JSON exists
  in `agent-output/_baselines/`. The plan itself is the only deliverable
  so far — nothing else has been merged.
- **Working branch**: `feat/test04-token-reduction` — **does not exist
  yet**. Create it from `main` as the first action.
- **First action when resuming** (paste verbatim):
  1. `git fetch origin && git checkout -b feat/test04-token-reduction origin/main`
  2. Extract the baseline log corpus (the `logs/` and `tmp/` paths are
     gitignored, so the JSON files only ship via this archive):
     `tar -xzf .github/data/token-reduction-logs.tar.gz`
     This recreates `logs/test04-01.json`, two
     `logs/agent-debug-log-*.json`, and two
     `tmp/agent-debug-log-*.json` — the exact ≥3-session corpus
     Phase 0 consumes and the canonical `logs/test04-01.json` that
     Phase 1 verification re-profiles. Confirm with
     `ls logs/test04-01.json tmp/agent-debug-log-*.json` before
     proceeding.
  3. Open this file (`tools/apex-prompts/apex-planning-prompts/01-plan-tokenreduction.prompt.md`)
     and start Phase 0 ("Multi-log baselining") below.
  4. Create `/memories/session/plan01-progress.md` and use it as the
     live per-phase status tracker for the duration of the work (this
     plan file stays frozen; the session memory file mutates).
- **Progress tracking**: session memory only. **Do not** use
  `apex-recall` — this is a meta-improvement plan, not an APEX workflow
  project.
- **Plan is frozen**: do not edit phases or targets without re-running
  the adversarial review that produced them. Status notes go in the
  session memory file, not here.

## Related work already shipped

Do not re-do these — they are committed on `main`:

- **Commit `53dab573` (PR #390)** — codegen one-file-per-turn cadence
  for `06b-bicep-codegen` and `06t-terraform-codegen` agents, plus the
  new `.github/skills/iac-common/references/codegen-shared-workflow.md`
  → "Phase 2: Output Cadence" section and
  `codegen-file-order.md`. This is **not part of this plan** but is
  the same workstream theme. It also retroactively validates the
  per-turn isolation pattern that Plan 02 Phase 3b depends on.
- **Repo memory** `/memories/repo/codegen-model-mix-2026.md` already
  exists. Phase 3 of this plan UPDATES it (single file per S4); do not
  create a duplicate.

---

# Plan v2: Address test04-01 findings (token + speed + quality)

Revised plan incorporating findings from the adversarial review
(1 BLOCKER, 5 MUST-FIX, 6 SHOULD-FIX, 3 NICE-TO-HAVE). Headline
mechanism for the largest saving — Gate-boundary `/clear` handoff —
replaces the unimplementable "context-window-checkpoint" from v1.

**Working branch**: `feat/test04-token-reduction` (new, off `main` —
the current `feat/artifact-lint-token-reduction` branch is named for
a different workstream and is already 15 commits deep).

**Target** (set against an N≥3 baseline range, not the single
test04-01 outlier): **45–55 % main-agent input-token reduction at
p50**, with no quality regression on Steps 1, 2, 3.5 artifacts.

Six phases. Phase 0 + Phase 1 sequential BLOCKING; Phases 2a–2d, 3, 4
parallel after; Phase 5 last.

---

## Phase 0 — Multi-log baselining (BLOCKING, sequential)

A single run is not a baseline. Establish a real distribution before
committing to numeric targets.

**Steps**

1. Identify ≥3 historical OTel session logs under `logs/` plus
   `tmp/agent-debug-log-*.json` representing different workflow shapes
   (Step 1 only, Step 1→2, Step 1→2→3.5). On a fresh device these
   paths are gitignored — extract them once via
   `tar -xzf .github/data/token-reduction-logs.tar.gz` (see "First
   action when resuming" above).
2. Run the profiler (Phase 1 deliverable) against each.
3. Compute baseline range: p50 / p90 / max for every headline metric
   (input tokens, avg/call, askQuestions count, challenger
   invocations, error span count, agent wall time, user-wait wall
   time — split per S2).
4. Commit results to `agent-output/_baselines/multi-log-baseline.json`
   and reference from `/memories/repo/log-profile-baselines.md`.

**Verification**

- `agent-output/_baselines/multi-log-baseline.json` exists with
  ≥3 sample sessions and computed percentiles.
- Phase 5 targets are restated as **percentage of p50 baseline**, not
  absolute tokens.

---

## Phase 1 — Profiler tooling (BLOCKING, sequential)

Lock the measurement instrument before any change.

**Steps**

1. Promote `tmp/analyze-test04-*.py` to
   `tools/scripts/profile_debug_log.py` (Python — matches repo
   conventions per S1; uses existing `.venv` and `requirements.txt`).
   Outputs stable JSON metrics: token totals per model, per-call
   distribution buckets, subagent wall-time, tool-call sizes,
   duplicate-read map, error list, askQuestions count + durations.
2. Add an `npm run profile:debug-log -- <path>` shim in `package.json`
   that invokes the Python script (parity with other `npm run`
   commands without a Node rewrite).
3. Add `tests/scripts/test_profile_debug_log.py` (pytest) against a
   small anonymised fixture in
   `tests/fixtures/otel-log-min.json` — fixture contains ~50 spans
   covering one chat span, one tool call, one error span; file paths
   replaced with `path/REDACTED` but token counts preserved.
4. Document the workflow under a new
   `.github/skills/context-management/references/log-profiling.md`.

**Relevant files**

- new: `tools/scripts/profile_debug_log.py`
- new: `tests/scripts/test_profile_debug_log.py`
- new: `tests/fixtures/otel-log-min.json`
- new: `.github/skills/context-management/references/log-profiling.md`
- edit: `package.json` — add `profile:debug-log` script
- edit: `.github/agents/11-context-optimizer.agent.md` — reference the
  new tool in the audit path

**Verification**

- `npm run profile:debug-log -- logs/test04-01.json` reproduces the
  same totals my analysis emitted (14.93M in, 144K out, 6 errors).
- `pytest tests/scripts/test_profile_debug_log.py` passes.

---

## Phase 2 — Token-cost reductions (parallel sub-tracks)

### Phase 2a — Gate-boundary `/clear` handoff (replaces v1's compression directive)

**Mechanism**: VS Code Copilot Chat history is owned by the chat client,
not the agent — there is no API to evict prior turns. The only
realistic main-agent saving comes from **user-driven `/clear` at Gate
boundaries**, resumed via `apex-recall`. Modelled against test04-01,
3–4 clears across the workflow project to **6.0–8.5M input tokens
(43–60 % reduction)** — better than the v1 projection, and via an
implementable mechanism.

**Steps**

1. Add a "Gate-boundary handoff" contract to
   `.github/skills/context-management/references/compression-templates.md`:
   on every accepted Gate, the orchestrator's final assistant message
   ends with a verbatim line — *"Run `/clear`, then switch the chat
   agent picker to `01-Orchestrator` and send `resume <project>` to
   continue Step N+1."*
2. Edit `01-orchestrator.agent.md` Gate-acceptance section to require
   `apex-recall checkpoint <project> <step> <phase>` **before** the
   resume-line is emitted, and forbid the agent from continuing to
   Step N+1 in the same chat session.
3. Resume path: in a new chat the user picks `01-Orchestrator` from
   the agent picker and sends `resume <project>`, which runs
   `apex-recall show <project> --json` as the first tool call, loads
   only the compact handoff JSON (~1–2 KB), and skips re-reading
   completed-step artifacts unless explicitly needed.
4. Pre-action lint:
   `tools/scripts/validate_orchestrator_handoff.py` parses
   `01-orchestrator.agent.md` and asserts every Gate-acceptance
   subsection contains the verbatim handoff line. Wired into
   `npm run validate:agents`.
5. Post-action profiler check: `profile_debug_log.py` flags any
   session with > 50 model calls between `/clear` boundaries as a
   compliance violation (informational warning).
6. New repo memory entry in
   `/memories/repo/codegen-model-mix-2026.md` (per S4 — single file)
   documenting the `/clear`-handoff pattern.

**Tradeoff**: 3–4 user clicks per workflow. Acceptable per user
decision (see "Decisions captured").

**Relevant files**

- edit: `.github/skills/context-management/references/compression-templates.md`
- edit: `.github/agents/01-orchestrator.agent.md`
- new: `tools/scripts/validate_orchestrator_handoff.py`
- edit: `package.json` — `validate:orchestrator-handoff` script
- edit: `tools/scripts/profile_debug_log.py` — add inter-clear span
  count warning

**Verification**

- `npm run validate:orchestrator-handoff` passes on the new agent body
  and fails on a fixture missing the handoff line.
- Smoke run (per N2 / Phase 5) shows the orchestrator emits the
  resume-line and the post-clear session starts at ≤45K input tokens
  on its first call.

### Phase 2b — Challenger-loop cap with defined recovery (M3)

Test04 fired 6 challenger invocations across 3 creative steps. Two
root causes possible — fix both.

**Steps**

1. **Root-cause check first**: `apex-recall show test04 --json | jq
   '.decisions.review_depth'` to confirm whether `review_depth =
   "deep"` was set. Capture result in
   `/memories/session/plan.md` notes.
2. Edit `01-orchestrator.agent.md` review-loop section to cap
   challenger invocations: **2 per step in default** (1 initial + 1
   `BLOCKER`-only revision), **4 per step in deep**. Add an
   explicit numbered ceiling near the existing `review_depth` block.
3. **Recovery flow** (M3): when the ceiling would be exceeded, the
   orchestrator MUST `vscode_askQuestions` with three options:
   - **Accept** — proceed with current artifact and findings.
   - **Override** — explicitly authorise one more pass (logged via
     `apex-recall decide --key challenger_override_<step>`).
   - **Abort** — halt workflow, preserve apex-recall state, instruct
     user how to resume after manual intervention.
4. Track per-step counter via apex-recall (single scalar per step,
   not nested — verify schema in
   `tools/apex-recall/docs/decision-keys.md`).
5. **Pre-action lint** (M4): `tools/scripts/validate_review_ceiling.py`
   parses orchestrator + challenger agent bodies and asserts the
   numbered ceiling text + recovery clause are present verbatim. Wire
   into `npm run validate:agents` (hard fail).
6. **Post-action validator**:
   `tools/scripts/validate_challenger_budget.py` parses an OTel log
   and reports invocations-per-step (warn only on first commit).
   Promote to hard fail after one clean run (per validation
   philosophy).

**Relevant files**

- edit: `.github/agents/01-orchestrator.agent.md` — explicit ceiling
  + recovery askQuestions block
- edit: `.github/agents/10-challenger.agent.md` — args contract
  surfaces the counter
- edit: `tools/apex-recall/docs/decision-keys.md` — register
  `challenger_invocations_<step>` and `challenger_override_<step>`
- new: `tools/scripts/validate_review_ceiling.py`
- new: `tools/scripts/validate_challenger_budget.py`
- edit: `package.json` — both validators

### Phase 2c — Filesystem precheck (scoped per S3 + root-causing per S6)

**Steps**

1. **Root-cause first (S6)**:
   `git log --all --oneline --grep='digest' -- .github/` to find when
   `.digest.md` references were introduced. Decide repo-wide whether
   to **delete the references** or **create the digest files** based
   on the workstream's intended state. Capture decision in
   `/memories/repo/codegen-model-mix-2026.md` and proceed.
2. Apply the decision: grep all `*.agent.md` + `**/SKILL.md` for
   `\.digest\.md`, reconcile uniformly.
3. **Scoped precheck rule (S3)**: in
   `.github/instructions/azure-artifacts.instructions.md`, add a rule
   that the following specific artifacts MUST use edit tools
   (`multi_replace_string_in_file` / `apply_patch`) for revision-2+
   writes — never `create_file`:
   - `agent-output/{project}/sku-manifest.json`
   - `agent-output/{project}/00-handoff.md`
   - `agent-output/{project}/README.md`
   Do NOT generalise to all artifacts (some are correctly
   re-rendered from templates each pass).
4. Orchestrator Phase 0 init uses `create_directory` for
   `agent-output/{project}` (eliminates span#57 ENOENT).

**Relevant files**

- edit: `.github/instructions/azure-artifacts.instructions.md`
- edit: `.github/agents/01-orchestrator.agent.md`
- edit: agents/skills with `.digest.md` references (decided in step 1)

### Phase 2d — Retry-race documentation (TRIMMED per M2)

The agent-body retry rule from v1 is **removed** — the retry happened
inside the chat client, outside any agent's reach. Keep only the
documentation + upstream-issue track.

**Steps**

1. Document the parallel-retry-race in `docs/devcontainer-hygiene.md`
   with OTel evidence (span#564 / #565 / #1773).
2. Add `.github/ISSUE_TEMPLATE/copilot-chat-feedback.md` (gh issue
   template) for filing upstream.
3. File one upstream issue using the template; link from the docs
   page. *No agent-body change. No apex-recall key.*

**Relevant files**

- edit: `docs/devcontainer-hygiene.md`
- new: `.github/ISSUE_TEMPLATE/copilot-chat-feedback.md`

---

## Phase 3 — Model routing changes (low effort, A/B for high-risk swap per M5)

Each item is a single frontmatter `model:` edit. The only behavioural
change is the `challenger-review-subagent` swap, which is gated.

**Confirmed swaps** (ship immediately):

1. **`05-iac-planner.agent.md`**: `Claude Opus 4.7 → Claude Sonnet
   4.6`. User-decided Option A.
2. **`04g-governance.agent.md`**: `GPT-5.5 → GPT-5.3-Codex`.
   Deterministic JSON.
3. **`07b-bicep-deploy.agent.md`** + **`07t-terraform-deploy.agent.md`**:
   `GPT-5.5 → GPT-5.3-Codex`. Tool-orchestration only.
4. **`10-challenger.agent.md`** (wrapper, NOT the subagent):
   `GPT-5.5 → GPT-5.3-Codex`. Wrapper orchestrates only.
5. **`11-context-optimizer.agent.md`**: `Claude Opus 4.7 → Claude
   Sonnet 4.6`. Log analysis.

**A/B-gated swap** (M5 — do NOT ship in the same commit):

6. **`_subagents/challenger-review-subagent.agent.md`**:
   `GPT-5.5 → Claude Sonnet 4.6`. Highest blast-radius change
   (affects every adversarial review). Run as an A/B pilot first:
   - Branch swap on a separate branch `pilot/challenger-sonnet`.
   - Re-run one real project end-to-end (Steps 1 → 4) with the swap.
   - Compare against a baseline run on GPT-5.5 using the quality
     rubric below.
   - Only merge after rubric passes.

**Quality rubric** (M5 — concrete, replaces "manual review"):

For each model-swap verification, the diff against baseline artifact
must satisfy ALL of:

- Required H2 sections present (per `validate:artifact-templates`).
- ≥ 90 % overlap on enumerated findings (severity + finding category).
- All `BLOCKER` findings preserved (no silent demotion).
- AVM module references unchanged or expanded (never reduced).
- Governance citations present where required by the artifact type.
- Cost estimate within ±5 % of baseline (where applicable).

**Single memory file** (S4): update
`/memories/repo/codegen-model-mix-2026.md` with the new mix + rollback
table. Do NOT create a duplicate Q2 file.

**Relevant files**

- edit: 5 `.agent.md` files (immediate swaps)
- edit (gated): 1 `.agent.md` file (challenger-review-subagent)
- new: `pilot/challenger-sonnet` branch (created only for the A/B)
- edit: `/memories/repo/codegen-model-mix-2026.md`
- run: `npm run validate:agents` + `npm run validate:agent-registry`

**Verification**

- Immediate swaps: validators green; smoke-run output diff matches
  rubric.
- A/B swap: rubric verdict captured in a new
  `agent-output/_baselines/challenger-sonnet-pilot.md` before merge.

---

## Phase 4 — Question batching (pre-action lint per M4)

The agent already mandates batching (line ~74 of
`02-requirements.agent.md`). Promote and enforce.

**Steps**

1. Restructure `02-requirements.agent.md` Phase 1 prompt: move the
   "Batch independent questions" rule to a P0 directive at the top of
   Phase 1 with an explicit numbered example (6 questions in one
   `vscode_askQuestions` call).
2. **Pre-action lint** (M4):
   `tools/scripts/validate_question_batching.py` parses
   `02-requirements.agent.md` and asserts the P0 batching block +
   numbered example are present. Wire into `npm run validate:agents`
   (hard fail).
3. **Post-action validator**: extend `profile_debug_log.py` to count
   `vscode_askQuestions` per phase; flag > 3 in a single phase as
   informational warning.

**Relevant files**

- edit: `.github/agents/02-requirements.agent.md`
- new: `tools/scripts/validate_question_batching.py`
- edit: `tools/scripts/profile_debug_log.py`
- edit: `.github/agents/11-context-optimizer.agent.md` — reference the
  new check in its audit pipeline

**Verification**

- `npm run validate:question-batching` fails on the current agent body
  and passes after the edit.
- Re-run of 02-Requirements on a small test project shows
  `askQuestions` count drops from 29 → ≤ 10.

---

## Phase 5 — Documentation + smoke-run harness (N2, S5, N3)

**Steps**

1. **Smoke-run harness (N2)**: add
   `tests/integration/smoke-run.md` describing a minimal manual
   end-to-end test — a fake project through Steps 1 → 2 — including
   what to capture (OTel log, apex-recall state, askQuestions count,
   challenger invocations). Used as Phase 2a/2b/2c acceptance.
2. **Single memory file** (S4 + S6 consolidation):
   `/memories/repo/codegen-model-mix-2026.md` updated with model mix,
   `.digest.md` reconciliation decision, and `/clear`-handoff
   pattern. *No new memory files created.*
3. **PR-template (S5)**: add to `.github/PULL_REQUEST_TEMPLATE.md` a
   single checkbox — *"This change affects input-token budget /
   per-call latency: [ ] YES [ ] NO"*. Only YES requires a magnitude
   estimate. Defaults to NO for the 90 %.
4. **Validator-latency budget (N3)**: capture current
   `npm run validate:all` runtime before the new validators land;
   declare a 30-second budget; if exceeded after adding the new
   validators, parallelise via `npm-run-all2` or move some validators
   to `pre-push` only.
5. **CHANGELOG.md**: one grouped entry covering all commits.

**Relevant files**

- new: `tests/integration/smoke-run.md`
- edit: `/memories/repo/codegen-model-mix-2026.md`
- edit: `.github/PULL_REQUEST_TEMPLATE.md`
- edit: `docs/devcontainer-hygiene.md` — "Log profiling" section
- edit: `CHANGELOG.md`

---

## Sequencing

```text
Phase 0 → Phase 1 ─┬─ Phase 2a ─┐
                   ├─ Phase 2b ─┤
                   ├─ Phase 2c ─┤─ Phase 5
                   ├─ Phase 2d ─┤
                   ├─ Phase 3  ─┤
                   └─ Phase 4  ─┘
```

- **Sequential, BLOCKING**: Phase 0 → Phase 1 (must complete first;
  every later phase needs the profiler and the baseline range).
- **Parallel after Phase 1**: 2a, 2b, 2c, 2d, 3, 4 — independent.
  Each lands as its own commit on `feat/test04-token-reduction`.
- **Sequential, last**: Phase 5 (rolls up actual numbers).

---

## Expected outcome (against multi-log p50 baseline, not test04-01 alone)

Targets restated as percentages so they survive variance across runs.
Wall-time split per S2 — agent latency vs. user-input wait are
distinct levers.

| Metric                                 |    Baseline | Target                   | Source phase   |
| -------------------------------------- | ----------: | ------------------------ | -------------- |
| Main-agent input tokens (p50)          |   set in P0 | **−45 to −55 %**         | 2a, 2b, 3      |
| Max input tokens / call                |   set in P0 | **≤ 110K** (never > cap) | 2a             |
| Challenger invocations / step          |   set in P0 | **1 default / max 2**    | 2b             |
| `gpt-5.5` call share                   |   set in P0 | **−65 % vs baseline**    | 3              |
| `vscode_askQuestions` count / Step 1   |   set in P0 | **≤ 10**                 | 4              |
| Agent wall time (excl. user-wait)      |   set in P0 | **−15 %**                | 2b, 3          |
| User-wait wall time (askQuestions)     |   set in P0 | **−60 %**                | 4              |
| Hard error spans (non-benign)          |   set in P0 | **0**                    | 2c             |

---

## Decisions captured

- **B1 mechanism**: **CONFIRMED — Gate-boundary `/clear` handoff**
  (user decision, May 2026). Agent-driven self-`/clear` is
  infeasible; the agent prompts the user to clear at Gates and
  resumes via apex-recall. Cost: 3–4 user clicks per workflow.
- **Scope**: process + agent-frontmatter + documentation changes
  only. No VS Code chat-client patches (Phase 2d is upstream-only).
- **Quality safeguard**: every model-swap (Phase 3) ships with a
  rollback row in `/memories/repo/codegen-model-mix-2026.md` and the
  highest-risk swap (`challenger-review-subagent`) is A/B-gated.
- **Validation philosophy**: prefer pre-action lints (hard fail) over
  post-action validators (informational warn first, promote to fail
  after one clean run). Three validators are pre-action this time.
- **Subagent trace attachment**: **DEFERRED** (user decision, May
  2026). The ~1,240 s of subagent LLM time stays unprofiled.
- **05-IaC-Planner model swap**: **CONFIRMED — Option A** (user
  decision, May 2026). Switch immediately; rollback path documented.
- **`challenger-review-subagent` swap**: **A/B-gated** (review
  finding M5). Not bundled with the other Phase 3 swaps.
- **Branch**: `feat/test04-token-reduction` (new branch off `main`).
- **Profiler language**: Python (matches existing repo conventions).

---

## Risk register (NEW)

| Phase | Risk | Mitigation / Rollback |
| ----- | ---- | --------------------- |
| 0 | Baseline variance too wide for meaningful targets | Take median of medians across logs; report band, not point |
| 2a | Users find 3–4 `/clear` interruptions disruptive | Make handoff line wording user-friendly; document UX cost; revert by removing the contract line from compression-templates.md |
| 2b | Hard-stop blocks a legitimate deep review | Override path via askQuestions; apex-recall decision logged |
| 2c | `.digest.md` decision (delete vs. create) wrong direction | Capture in git commit message + memory file; reversible via revert |
| 3 (immediate) | Sonnet 4.6 IaC-planner output regresses | Rubric in Phase 3 verification; rollback = single frontmatter revert |
| 3 (A/B) | Sonnet 4.6 challenger misses findings GPT-5.5 caught | Pilot branch; merge gated by rubric; do not merge if any BLOCKER demoted |
| 4 | Reduced batching causes worse requirements quality | Manual review of next 02-Requirements run; revert promotion if requirements suffer |
| 5 | New validators push `validate:all` over 30s | Parallelise or move to `pre-push` only |

---

## Out of scope

- Subagent trace attachment (deferred).
- Replacing `vscode_askQuestions` with a form-style multi-step UI
  (future workstream after Phase 4).
- VS Code chat-client retry-race fix (upstream-only via Phase 2d).
