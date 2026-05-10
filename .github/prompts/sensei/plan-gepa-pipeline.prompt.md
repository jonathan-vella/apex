---
description: "Six-stage end-to-end GEPA pipeline for the 33 in-scope skills under .github/skills/. Builds on the completed plan-skillsAuditOptimize programme (frontmatter at GEPA 1.00 across all skills, body sections in place). Adds: token-budget squeeze, MCP-integration audit, Waza trigger-test scaffolding, GEPA optimize (LLM-driven via GitHub Models), and post-pipeline reporting. User-gated stage transitions; per-batch commits."
agent: agent
model: "Claude Opus 4.7"
tools: vscode, execute, read, agent, search, terminal
argument-hint: "stage <N> | tokens baseline | tokens squeeze batch <N> | mcp audit | tests batch <N> | optimize batch <N> | optimize <skill> | final report"
---

# Plan: Sensei GEPA Pipeline (end-to-end)

**TL;DR** — Six stages on `feat/skills-sensei` (or successor branch). Stages 1–3 are deterministic and cheap (token squeeze + MCP audit). Stage 4 authors Waza trigger tests. Stage 5 runs LLM-driven GEPA `optimize` per skill (~80 candidates each, ~2,640 LLM calls total via GitHub Models / `gh auth token`). Stage 6 produces the final cross-skill report. Each stage is user-gated; the agent never advances past a gate without an explicit trigger.

## Predecessor

This plan picks up where [`plan-skillsAuditOptimize.prompt.md`](../plan-skillsAuditOptimize.prompt.md) finished. That programme (Stage A → Stage B Round 1 → Round 2) brought all 33 in-scope skills to GEPA `quality_score: 1.00`. This plan layers in the remaining sensei capabilities (token budgets, MCP integration, trigger tests, GEPA `optimize`).

## Locked decisions

| Topic                  | Decision                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Scope                  | Same 33 active skills — `.github/skills/`, excluding `sensei` (submodule) and `archived_skills/`                    |
| Stage cadence          | User-gated; each stage commits before the next begins                                                               |
| Trigger test framework | **Waza** (sensei native YAML) — simpler authoring, no repo dependency on Vitest for skill-routing tests             |
| Trigger test location  | `tests/{skill}/trigger_tests.yaml` (Waza convention)                                                                |
| GEPA optimize LLM      | GitHub Models via `gh auth token`; default model from sensei is `openai/gpt-4o`; we override to `claude-opus-4.7`   |
| Optimize iterations    | 80 per skill (sensei default); reduce to 40 if token quota becomes a concern                                        |
| Optimize candidate gate | Apply only candidates that score higher AND pass `validate:agents` + `validate:agent-registry` + `lint:vendor-prompting` + `validate:skills` |
| Files location          | Reports → `.github/skills/_audits/`; Waza tests → `tests/{skill}/trigger_tests.yaml`                                 |
| Tracker                | Single `.github/skills/_audits/TODO.md` extended with Stage 1–6 sections                                            |
| Commit cadence         | Per-batch (Stages 2, 4, 5); single commit (Stages 1, 3, 6)                                                          |

## Stages

### Stage 1 — Token-budget baseline (read-only)

User trigger: `tokens baseline`.

1. Run `cd .github/skills/sensei && npm run tokens count -- ../../../.github/skills/**/SKILL.md --format=json` and capture as `.github/skills/_audits/tokens-baseline.json`.
2. Run `cd .github/skills/sensei && npm run tokens compare main HEAD --format=json` to capture the audit-branch delta.
3. Generate `.github/skills/_audits/01-tokens-baseline.md`:
   - Top-10 highest-token `SKILL.md` files
   - Skills exceeding the 500-token soft limit
   - Skills exceeding the 5000-token hard limit (should be zero)
   - `compare` delta vs `main` (Round 2 impact)
4. Commit `chore(skills): Token-budget baseline (stage 1)`.
5. Stop and wait.

### Stage 2 — Token squeeze (per-batch, user-gated)

User trigger: `tokens squeeze batch <N>` (1–5).

For each skill in the batch, when `tokens count` shows > 500 tokens:

1. Run `cd .github/skills/sensei && npm run tokens suggest -- ../../../.github/skills/{skill}/SKILL.md` to surface candidate sections to relocate.
2. Move bulk content (large tables, decision trees, multi-section workflows) to `.github/skills/{skill}/references/{topic}.md`; replace with a one-line pointer in `SKILL.md`.
3. Re-run `tokens count` per skill; verify the file is below 500 tokens or has a justified `.token-limits.json` override.
4. Run validators (`validate:skills`, `validate:agents`, `lint:vendor-prompting`).
5. Append "Stage 2 — Token squeeze (batch N)" section to `.github/skills/_audits/01-tokens-baseline.md`.
6. Commit `feat(skills): Squeeze SKILL.md token budget (batch N, stage 2)`.
7. Stop and wait.

### Stage 3 — MCP-integration audit (read-only)

User trigger: `mcp audit`.

For the four skills currently declaring `INVOKES:` (`azure-kusto`, `azure-quotas`, `microsoft-docs`, `drawio`) plus any added in Stage 2:

1. Verify each skill body has:
   - `## MCP Tools Used` (or equivalent table listing tools + parameters)
   - `## Prerequisites` (auth, package install, MCP server config)
   - CLI fallback pattern for when MCP is unavailable
   - No name collision (skill name ≠ MCP tool name)
2. Generate `.github/skills/_audits/02-mcp-integration.md` — per-skill traffic-light for the four checks above; recommend remediation diffs (NOT applied).
3. Commit `chore(skills): MCP-integration audit (stage 3)`.
4. Stop and wait.

### Stage 3 updates — user-gated

User trigger: `mcp update` or `mcp update <skill>`.

1. Apply the recommended diffs from `02-mcp-integration.md`.
2. Run validators.
3. Append "Post-update" section to `02-mcp-integration.md`.
4. Commit `feat(skills): Apply MCP-integration audit findings`.

### Stage 4 — Waza trigger-test scaffolding (per-batch, user-gated)

User trigger: `tests batch <N>` (1–5; same alphabetical batches as the predecessor plan).

For each skill in the batch:

1. Read the skill's `description:` frontmatter to extract `WHEN:` and `USE FOR:` phrases.
2. Generate `tests/{skill}/trigger_tests.yaml` using the Waza template ([`.github/skills/sensei/references/test-templates/waza.md`](../../skills/sensei/references/test-templates/waza.md)). Required minimums:
   - 10 `shouldTriggerPrompts` (exact + question + command + context variants)
   - 5 `shouldNotTriggerPrompts` (anti-triggers, competing skills, MCP-direct, unrelated)
3. Run the GEPA evaluator's trigger-accuracy check (sensei calls this "fit") on the new tests against the current `SKILL.md`:
   ```bash
   python .github/skills/sensei/scripts/src/gepa/auto_evaluator.py score \
       --skill {skill} --skills-dir .github/skills --tests-dir tests --json
   ```
   Confirm `trigger_accuracy` is non-null (proves the harness was discovered).
4. Append "Stage 4 — Trigger tests (batch N)" section to `.github/skills/_audits/03-trigger-tests.md`.
5. Commit `feat(tests): Add Waza trigger tests for batch N skills (stage 4)`.
6. Stop and wait.

### Stage 5 — GEPA optimize (per-batch or per-skill, user-gated)

User trigger: `optimize batch <N>` or `optimize <skill>`.

**Prerequisites**: Stage 4 complete for the target skills (`tests/{skill}/trigger_tests.yaml` exists).

For each skill:

1. Capture the pre-optimize state: `tokens count`, GEPA `score` JSON, current `SKILL.md` SHA.
2. Run GEPA `optimize`:
   ```bash
   OPENAI_API_BASE=https://models.github.ai/inference \
   OPENAI_API_KEY=$(gh auth token) \
   python .github/skills/sensei/scripts/src/gepa/auto_evaluator.py optimize \
       --skill {skill} \
       --skills-dir .github/skills \
       --tests-dir tests \
       --iterations 80 \
       --model claude-opus-4.7-1m-internal
   ```
3. Diff the proposed `SKILL.md` against the pre-optimize state. If the proposed candidate:
   - Scores **higher** on GEPA `score` AND
   - Passes `validate:skills` + `validate:agents` + `validate:agent-registry` + `lint:vendor-prompting` AND
   - Does not regress existing trigger tests (re-run `score` with `--tests-dir tests`)

   then apply it. Otherwise reject and log the rejection reason.
4. Append per-skill before/after table to `.github/skills/_audits/04-gepa-optimize.md`:
   - Score before / after / delta
   - Token count before / after / delta
   - Trigger accuracy before / after
   - Outcome: `applied` / `rejected (reason)`
5. Commit per skill: `feat(skills): GEPA optimize {skill} (stage 5)`.
6. Stop after each batch/skill and wait.

> **Cost note**: GEPA optimize uses LLM credits. The user may pause mid-batch with `pause`; the agent records the partial-state in `04-gepa-optimize.md` and waits.

### Stage 6 — Final cross-skill report

User trigger: `final report`.

1. Run final `npm run audit:skills:gepa` (Stage B style).
2. Run final `tokens count` and `tokens compare main HEAD`.
3. Run trigger-accuracy check across all skills with tests.
4. Generate `.github/skills/_audits/05-pipeline-final.md`:
   - Pipeline summary table (Stage A→B Round 2 → Stage 5 deltas per skill)
   - Token-budget aggregate (before/after totals across the 33 skills)
   - Trigger-accuracy aggregate (mean accuracy, skills with regressions)
   - Outstanding skills (any that did not converge in Stage 5)
   - Recommended cadence for periodic re-runs (e.g., quarterly Stage 1 + 6)
5. Commit `chore(skills): Sensei GEPA pipeline final report (stage 6)`.

## Tracker integration

Extend `.github/skills/_audits/TODO.md` with a "Sensei GEPA Pipeline (Plan 2)" section:

- One checkbox row per stage gate
- Per-batch checkboxes for Stages 2, 4, 5
- Per-skill checkboxes inside Stage 5 (33 skills, optimize-or-skip)

## Relevant files

- `.github/skills/_audits/01-tokens-baseline.md` — Stage 1 + Stage 2 reports
- `.github/skills/_audits/02-mcp-integration.md` — Stage 3 report
- `.github/skills/_audits/03-trigger-tests.md` — Stage 4 report
- `.github/skills/_audits/04-gepa-optimize.md` — Stage 5 per-skill log
- `.github/skills/_audits/05-pipeline-final.md` — Stage 6 final report
- `.github/skills/_audits/tokens-baseline.json` — Stage 1 raw output
- `tests/{skill}/trigger_tests.yaml` — Waza trigger tests
- `.github/skills/{skill}/SKILL.md` — modified by Stages 2 (squeeze) and 5 (optimize) only
- `.github/skills/{skill}/references/{topic}.md` — created by Stage 2 squeeze

## Verification

| Stage | Check |
| ----- | ----- |
| 1     | `tokens-baseline.json` parses; `01-tokens-baseline.md` exists                                                  |
| 2     | After each batch: `tokens count` shows target skills < 500 (or have `.token-limits.json` override); validators pass |
| 3     | `02-mcp-integration.md` traffic-light covers all `INVOKES:` skills                                              |
| 4     | After each batch: every skill in the batch has `tests/{skill}/trigger_tests.yaml`; `score --tests-dir tests` returns non-null `trigger_accuracy` |
| 5     | After each skill: GEPA score delta is non-negative; all four validators pass; trigger accuracy non-regressed   |
| 6     | `05-pipeline-final.md` exists; aggregates published                                                            |

## Decisions / scope boundaries

- **In scope**: Token budgets, MCP integration audit, Waza trigger-test authoring, GEPA `optimize` rewrites of `SKILL.md`, final cross-skill report.
- **Out of scope**: Skill body refactors beyond Stage 2 squeezes; `references/*.md` content changes (only relocations from Stage 2); changes to the `sensei` submodule itself; agent (`.agent.md`) and prompt (`.prompt.md`) files; new skills.
- **Submodule isolation**: No edits ever land in `.github/skills/sensei/`. We consume its scripts read-only.
- **`optimize` reversibility**: every Stage 5 commit is per-skill, so any regression can be reverted with a single `git revert`.
- **Validator gate on `optimize`**: candidates that lift GEPA score but break validators are rejected with the reason logged in `04-gepa-optimize.md`.

## Open considerations

1. **Quota for GitHub Models** — 33 skills × 80 iterations is meaningful; if quota is hit, re-run `optimize` with `--iterations 40` or pause and resume next billing period.
2. **Waza runner for CI** — Waza is sensei-native; if we want CI enforcement of trigger tests, add a small wrapper script (e.g., `tools/scripts/run-trigger-tests.mjs`) that shells out to the GEPA evaluator's `score --tests-dir tests --strict` mode.
3. **`.token-limits.json` overrides** — some skills (e.g., `azure-prepare` at ~2.5K tokens) may legitimately need a higher cap; capture explicit overrides in Stage 2.
4. **GEPA optimize LLM choice** — sensei defaults to `openai/gpt-4o`. We override to `claude-opus-4.7-1m-internal` for consistency with this repo's authoring agent. If the override fails, fall back to default.
5. **Idempotency** — re-running any read-only stage should produce identical output; re-running write stages requires a fresh branch or revert.

## Sequencing tips

- **Stage 1 first, always** — gives the baseline to compare against later.
- **Stage 3 can run in parallel with Stage 2** — they touch different fields.
- **Stage 4 must precede Stage 5** for any skill — `optimize` needs the trigger tests as fitness function.
- **Stage 5 per skill, not per batch** — the LLM-driven loop is per skill; a "batch" trigger here means "run the LLM loop on each skill in the alphabetical batch, sequentially, with a stop-and-wait between skills if the user prefers".

## Status

`Draft — awaiting Stage 1 trigger (`tokens baseline`).`
