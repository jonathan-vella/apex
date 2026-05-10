# Stage 5 — GEPA optimize (per-skill, user-gated)

> **Plan**: [`plan-gepa-pipeline.prompt.md`](../../prompts/sensei/plan-gepa-pipeline.prompt.md) — Stage 5
> **Started**: 2026-05-10
> **Status**: **Smoke test only — paused after one rejected candidate**

This stage runs sensei's GEPA `optimize` LLM loop against each skill's
trigger-test fitness function. Per the plan, every candidate must clear a
**validator gate** (lift GEPA score AND pass `validate:skills` +
`validate:agents` + `validate:agent-registry` + `lint:vendor-prompting`)
AND a **functional-regression gate** (preserve existing skill behavior and
hand-off rules).

## Stage 5 prerequisites — resolved

The plan's locked decision (`claude-opus-4.7-1m-internal`) is not exposed on
the GitHub Models inference catalog. Per the plan's open consideration #4
("If the override fails, fall back to default"):

- **Auth**: dev-container `GH_TOKEN` (fine-grained PAT) returned 403 `no_access`
  for every model on the inference endpoint. Resolved by switching to the
  interactive `gh auth login --web` flow (web session token `gho_*`); all
  41 catalog models became reachable.
- **Python deps installed**: `gepa>=0.3.0`, `litellm` (sensei's optimize loop
  uses litellm for the proposer LLM via `make_litellm_lm`).
- **Model selection**: `openai/gpt-5` chosen by user for the smoke test
  (Anthropic models are not on the catalog).
- **Iterations**: 80 (sensei default; plan also lists 40 as a quota fallback).

## Smoke test — `azure-prepare` (rejected)

Trigger: user direction "proceed with gpt-5" after the auth-blocker resolved.

### Pre-optimize state

- Pre-optimize SHA: `81a6ac46c5ebe60a827d6a2d7e5fbf0da1e58c57`
- Snapshot saved to [`stage5-snapshots/azure-prepare.before.md`](./stage5-snapshots/azure-prepare.before.md)
- 1,622 tokens, 109 lines
- `trigger_accuracy: 0.32`, `quality_score: 1.00`

### Run details

- **Model**: `openai/gpt-5` via GitHub Models inference (`https://models.github.ai/inference`)
- **Iterations**: 80 requested; the GEPA loop accepted the first proposal at
  iteration 1 (subsample score 2.59 vs base 2.51 → continue to full eval →
  found a better program with valset score 0.86 vs base 0.84) and converged on
  it. Subsequent iterations did not improve the pareto front.
- **Best valset score**: 0.8649 (vs base 0.8378)

### Candidate metrics

| Metric             | Before |    After |                 Δ |
| ------------------ | -----: | -------: | ----------------: |
| Tokens             |  1,622 |    1,252 | **−370 (−22.8%)** |
| Lines              |    109 |       83 |               −26 |
| `trigger_accuracy` |   0.32 | **0.68** |  **+0.36 (×2.1)** |
| `quality_score`    |   1.00 |     1.00 |         unchanged |

Validator gate (all four): **PASS**.

- `validate:skills` — 34 skills, 0 errors, 0 warnings
- `validate:agents` — 22 agents, 0 errors, 0 warnings
- `validate:agent-registry` — 0 errors, 0 warnings
- `lint:vendor-prompting` — 48 prompts, 0 errors, 0 warnings
- `tokens check` — 33/33 within `.token-limits.json` soft limits

### Rejection rationale

Despite passing the strict validator gate and lifting `trigger_accuracy`
×2, the candidate dropped functional content the trigger-test fitness
function does not measure. User decision: **reject — we cannot allow such
regression in functionality.**

Specific losses:

- 4 H2 sections removed from SKILL.md:
  - `## ❌ PLAN-FIRST WORKFLOW — MANDATORY` (the four-step blocking workflow)
  - `## ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION`
    (the routing table that hands off to `azure-cloud-migrate` for AWS / GCP /
    Lambda prompts BEFORE entering azure-prepare)
  - `## SDK References` (pointer to `references/sdk/` for azd / Identity /
    App Configuration SDKs across Python / .NET / TypeScript / Java)
  - `## Reference Index` (load-on-demand listing of all references)
- 6 reference files orphaned (no longer linked from SKILL.md): `references/specialized-routing.md`,
  `references/global-rules.md`, `references/azure-context.md`, `references/apim.md`,
  `references/services/durable-task-scheduler/README.md`,
  `references/services/functions/durable.md`
- The Stage 2 squeeze relocation (Phase 1 / Phase 2 detail in
  `references/phases.md`) was partially undone — phase detail re-inlined,
  pointer to `references/phases.md` dropped.

The rejection cause is structural: GEPA's fitness function only knows the
trigger-test corpus and the content-quality scorer's six binary checks
(`description_length`, `has_when`, `has_use_for`, `has_rules`, `has_steps`,
`no_bad_patterns`). Cross-cloud routing rules and reference indexes
contribute zero signal, so the optimizer prunes them.

### Rollback

`SKILL.md` restored from snapshot (`git hash-object` confirms identical SHA
`81a6ac46`); re-scored and the original `trigger_accuracy: 0.32` /
`quality_score: 1.00` matches the pre-optimize state.

## Pause and lessons

User decision: **stop Stage 5 here for this session.**

What this single run validated:

1. **Auth path works** — the working transport is `gh auth login --web`
   for the session token, then setting `OPENAI_API_BASE=https://models.github.ai/inference`
   together with `OPENAI_API_KEY=$(gh auth token)` for sensei's optimize loop.
2. **The optimizer can lift `trigger_accuracy`** — for `azure-prepare` the
   gain was ×2.1 in one iteration on `gpt-5`.
3. **The validator gate is necessary but not sufficient.** The plan's gate
   catches structural breakage but does not catch _functional_ regression
   on behavior the trigger tests don't probe.

What we learned to do **before** running Stage 5 broadly:

- Strengthen the rejection criteria: any candidate that drops an existing
  `## H2` section or orphans a `references/*.md` file must require explicit
  human approval, even when `trigger_accuracy` lifts.
- Consider adding "preservation" trigger-test cases for cross-skill hand-off
  rules (e.g., `"deploy AWS Lambda to Azure"` should NOT trigger
  `azure-prepare` — that already exists as anti-trigger; the missing case
  is "preserve the in-skill routing table to azure-cloud-migrate").
- Stage 5 is per-skill; each skill should be evaluated against the same
  two-gate test (validator + functional). One per-skill commit per accepted
  candidate; rejections are documented here.

## Status

Stage 5 paused. **0 / 33 skills accepted. 1 / 33 evaluated and rejected.**
Awaiting user direction on whether to:

- Resume Stage 5 with stricter rejection criteria.
- Skip Stage 5 entirely and produce the Stage 6 final report against
  Stage 1–4 deltas.
- Defer Stage 5 to a separate dedicated session.

## Stage 5-Audit — structural-regression detector (added 2026-05-10)

User direction: "can we run the next step purely in audit mode? i want to
avoid introducing any regressions into any of the skills."

This adds a **Stage 5-Audit** between Stage 4 and the (now-optional)
Stage 5-Apply. Audit mode runs the GEPA optimize loop exactly as Stage 5
specifies but **never writes to `.github/skills/{skill}/SKILL.md`**. It
saves each candidate to `stage5-snapshots/{skill}.candidate.md` and runs a
deterministic structural-regression detector to classify the candidate as
`SAFE` / `REVIEW` / `REJECT` — purely a recommendation surface.

### Detector

[`tools/scripts/audit-gepa-candidate.mjs`](../../../tools/scripts/audit-gepa-candidate.mjs).
No LLM calls. Deterministic markdown structural diff. Exit code reflects
the verdict: 0 = SAFE, 1 = REVIEW, 2 = REJECT.

### Detector rules (locked 2026-05-10 by user decision)

| # | Rule | Severity | Catches |
| ---: | --- | --- | --- |
| 1 | H2 section preservation | REJECT | Any `## H2` in `before` missing in `candidate` |
| 2 | Reference orphans | REJECT | Any `references/*.md` link in `before` missing in `candidate` AND that file exists on disk |
| 3 | Cross-skill mentions | REJECT | Any in-scope skill name mentioned in `before` body absent from `candidate` body |
| 4 | Table row count | REVIEW | A markdown table loses rows |
| 5 | Fenced code blocks | REVIEW | A fenced code block disappears |
| 6 | Version bump | REVIEW | Frontmatter `version:` changes |
| 7 | Aggressive trim | REVIEW | Token reduction > 25% |

Verdict precedence: REJECT > REVIEW > SAFE (highest severity wins).

### Calibration — `azure-prepare` snapshot from rejected smoke test

The detector was calibrated against the existing
[`stage5-snapshots/azure-prepare.before.md`](./stage5-snapshots/azure-prepare.before.md)
(SHA `81a6ac46`, 1,622 tokens) and
[`stage5-snapshots/azure-prepare.candidate.md`](./stage5-snapshots/azure-prepare.candidate.md)
(1,252 tokens, the rejected smoke-test candidate). No re-run of `optimize`
was needed — the existing snapshot is exactly the regression case the
detector must catch.

```text
$ node tools/scripts/audit-gepa-candidate.mjs \
    --skill azure-prepare \
    --before .github/skills/_audits/stage5-snapshots/azure-prepare.before.md \
    --candidate .github/skills/_audits/stage5-snapshots/azure-prepare.candidate.md
Verdict:    ❌ REJECT
```

Findings (matches the manual rejection rationale):

| Rule | Severity | Detail |
| --- | --- | --- |
| `h2-preservation` | REJECT | 5 H2 sections removed (Triggers, ❌ PLAN-FIRST WORKFLOW — MANDATORY, ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION, SDK References, Reference Index) |
| `reference-orphans` | REJECT | 7 `references/*.md` links removed (existing files orphaned): `azure-context.md`, `global-rules.md`, `apim.md`, `services/functions/durable.md`, `services/durable-task-scheduler/README.md`, `specialized-routing.md`, `phases.md` |
| `cross-skill-mentions` | REJECT | `azure-cloud-migrate` (2 mentions → 0) — exact functional regression we manually flagged |
| `table-rows` | REVIEW | Routing table dropped: 12 → 0 rows |
| `version-bump` | REVIEW | `1.0.6 → 1.1.0` |

The detector also caught two regressions the original manual review under-counted:
the `Triggers` H2 (manual review counted only 4 lost H2s; detector counts 5) and
the `phases.md` orphan (manual review listed only 6; detector lists 7 because
the malformed phases.md link in the original — written as
`...phases.md`](references/phases.md)` — was correctly normalized to a
single proper link target). Both are legitimate signal.

Negative test (`before` vs itself) returns `SAFE` with all metrics matching ✓.

### Recommended workflow

When the user is ready to resume Stage 5 in **audit-only mode**:

1. Run sensei `optimize` per skill in scope (no apply).
2. Save each candidate to `stage5-snapshots/{skill}.candidate.md`.
3. Run the detector per skill; collect verdicts.
4. Append a per-skill verdict table to this file with the diff summary.
5. Commit `chore(skills): Stage 5-Audit (audit-only) — N skills evaluated`.
6. **No SKILL.md changes**. The user reviews the report at their pace.

For any candidate the user later wants to apply, the Stage 5-Apply gate
runs:

- Detector verdict must be `SAFE` (or user explicitly overrides a `REVIEW`)
- All four validators must pass
- Per-skill commit, per the existing plan

Stage 5 stays paused. Detector is ready; trigger an audit pass with
`audit batch <N>` or `audit <skill>` (new triggers, distinct from the
plan's existing `optimize batch <N>` / `optimize <skill>`).
