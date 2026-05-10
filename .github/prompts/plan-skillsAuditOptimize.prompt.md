---
description: 'Three-phase programme to audit, optimize, and re-audit all skills using sensei standard mode and GEPA with Claude Opus 4.7. Runs alphabetical batches with strict user-gated optimize steps.'
agent: agent
model: 'Claude Opus 4.7'
tools: vscode, execute, read, agent, search, terminal
argument-hint: 'phase=0|audit|optimize|gepa-final, batch=1..5 (optional), skill=<name> (optional)'
---

# Plan: Skills audit-then-optimize programme

**TL;DR** — Three-phase programme on the `feat/skills-sensei` branch: (1) baseline audit each of 5 alphabetical batches (6–7 skills) with sensei standard mode, producing strict read-only reports; (2) optimize each batch with sensei + GEPA (Claude Opus 4.7) only when the user says `optimize batch <N>` or `optimize <skill>`; (3) final GEPA audit across all 33 skills. Tracker (`TODO.md`) and reports live under `.github/skills/_audits/`.

## Locked decisions

| Topic | Decision |
|---|---|
| Scope | All 33 active skills under `.github/skills/`, excluding `sensei` (submodule) and `archived_skills/` |
| Batching | 5 alphabetical chunks of 6–7 skills each |
| Audit semantics | Strict audit-only — no file edits until user says "optimize batch N" |
| Files location | `.github/skills/_audits/` |
| Tracker format | Single `TODO.md` with checkboxes per skill per phase |
| Report format | Both — concise summary table + detailed appendix per batch |
| Harness strategy | LLM-seed `tests/{skill}/triggers.test.ts`, then user reviews/edits before optimize |
| GEPA LLM | GitHub Models / `claude-opus-4.7-1m-internal` |
| Commit cadence | Per-batch: 1 commit for audit reports, 1 commit for approved edits |
| Optimize trigger | `optimize batch <N>` or `optimize <skill>` — explicit, per-batch/per-skill |
| Final GEPA audit | All 33 skills, baseline + optimized in a single report |

## Batch composition

| Batch | Skills | Count |
|---|---|---|
| 1 | azure-adr, azure-artifacts, azure-bicep-patterns, azure-cloud-migrate, azure-compliance, azure-compute, azure-cost-optimization | 7 |
| 2 | azure-defaults, azure-deploy, azure-diagnostics, azure-governance-discovery, azure-kusto, azure-prepare, azure-quotas | 7 |
| 3 | azure-rbac, azure-resources, azure-storage, azure-validate, context-management, docs-writer, drawio | 7 |
| 4 | entra-app-registration, github-operations, golden-principles, iac-common, mermaid, microsoft-docs | 6 |
| 5 | python-diagrams, terraform-patterns, terraform-search-import, terraform-test, vendor-prompting, workflow-engine | 6 |

> Note: `azure-adr` was already touched in earlier sensei runs this session. Batch 1 re-baselines it for consistency; user may opt to exclude it from re-optimization.

## Phases

### Phase 0 — Scaffolding (one-time, no user gate)

1. Create `.github/skills/_audits/` directory.
2. Generate `TODO.md` with the per-skill checklist for all 3 phases.
3. Add helper script `tools/scripts/run-sensei-audit.mjs` that wraps `npm run tokens count` + the GEPA `score` evaluator so per-batch audits are repeatable. Output: JSON per skill that the batch-report generator consumes.
4. Add npm script `audit:skills:gepa` running the GEPA score-all CLI.
5. Commit Phase 0 artifacts only.

### Phase 1 — Standard-mode audit per batch (5 iterations)

For each batch (in order):

1. Run sensei standard-mode scoring **read-only** for each skill in the batch. No frontmatter edits, no git changes to skills.
2. Generate `.github/skills/_audits/batch-N-audit.md` with:
   - Summary table (skill, current score, top issue, recommended action)
   - Detailed appendix per skill: full current frontmatter, scoring breakdown, concrete proposed before/after diff (text only — not applied), token delta projection, MCP-integration check (where INVOKES applies).
3. Tick the matching boxes in `TODO.md`.
4. Commit `chore(skills): Audit batch N report (sensei standard)`.
5. Hand off to user for review. **Stop and wait** for the user to say `optimize batch N` before any edits are made.

### Phase 2 — Optimize approved batches (user-gated)

Only when user issues `optimize batch <N>` or `optimize <skill>`:

1. **Author trigger harness** for each in-scope skill in the batch:
   - LLM-seed `tests/{skill}/triggers.test.ts` based on the audit findings (5–7 should-trigger, 5–7 should-not-trigger prompts each).
   - Show the seed harness diff. User reviews/edits before any optimize call runs.
2. **Install GEPA** if not already present: `pip install --user 'gepa>=0.3.0'` or `uv pip install --system 'gepa>=0.3.0'`.
3. **Configure LLM endpoint**: set `OPENAI_API_BASE=https://models.github.ai/inference` and `OPENAI_API_KEY=$(gh auth token)`; pass `--model claude-opus-4.7-1m-internal` to the GEPA optimizer (override sensei's `openai/gpt-4o` default).
4. **Run GEPA optimize** per skill: `python .github/skills/sensei/scripts/src/gepa/auto_evaluator.py optimize --skill <name> --skills-dir .github/skills --tests-dir tests --model claude-opus-4.7-1m-internal`.
5. Apply only the GEPA-proposed changes that improve the score AND pass `npm run validate:agents` + `validate:agent-registry` + `lint:vendor-prompting`. Reject candidates that violate repo rules.
6. Commit `feat(skills): Optimize batch N (GEPA + Claude Opus)`.
7. Tick the matching boxes in `TODO.md`.

### Phase 3 — Final GEPA-mode audit (after all batches optimized)

1. Run GEPA `score-all` across all 33 skills: `python .github/skills/sensei/scripts/src/gepa/auto_evaluator.py score-all --skills-dir .github/skills --tests-dir tests --json`.
2. Generate `.github/skills/_audits/final-gepa-audit.md` with:
   - Summary table: every skill's baseline score (from batch reports) vs. current GEPA score, delta column.
   - Top wins (largest improvements).
   - Skills still below 0.7 with diagnosis.
   - Trigger-accuracy summary per skill (true positive / false positive rates from the harness).
3. Tick the final boxes in `TODO.md`.
4. Commit `docs(skills): Final GEPA audit report`.

## Relevant files

- `.github/skills/_audits/TODO.md` — programme tracker (created in Phase 0)
- `.github/skills/_audits/batch-{1..5}-audit.md` — per-batch reports
- `.github/skills/_audits/final-gepa-audit.md` — Phase 3 deliverable
- `tools/scripts/run-sensei-audit.mjs` — wrapper for repeatable audit runs
- `tests/{skill}/triggers.test.ts` × 33 — GEPA harness, authored per-batch in Phase 2
- `package.json` — adds `audit:skills:gepa` npm script
- `.github/skills/sensei/scripts/src/gepa/auto_evaluator.py` — upstream evaluator (read-only; no edits to submodule)
- `.github/skills/{skill}/SKILL.md` — modified only in Phase 2 after explicit optimize command

## Verification

| Phase | Verification |
|---|---|
| 0 | `ls .github/skills/_audits/TODO.md`; `npm run audit:skills:gepa --dry-run` |
| 1 | `npm run validate:agents && npm run validate:agent-registry` (no skill files changed); each `batch-N-audit.md` parses via `npm run lint:md` |
| 2 | After each optimize: `npm run validate:agents`, `npm run validate:agent-registry`, `npm run lint:vendor-prompting`, `npm run validate:iac-security-baseline` (sanity), token check via `cd .github/skills/sensei && npm run tokens -- check ../{skill}/SKILL.md` |
| 3 | `final-gepa-audit.md` shows ≥ 0.7 score for ≥ 80% of skills; trigger accuracy ≥ 0.85 for optimized skills |

## Decisions / scope boundaries

- **In scope**: 33 active skills' frontmatter; per-skill trigger harnesses; per-batch and final reports; minor wrapper scripts.
- **Out of scope**: Skill body content rewrites beyond what GEPA proposes; archived skills; the sensei submodule itself; the accelerator-side workflow (already addressed in prior turn); any agent (`.agent.md`) or prompt (`.prompt.md`) files.
- **`azure-adr` re-baseline**: re-audited in Batch 1 alongside others for consistency; user decides at optimize time whether to re-touch.
- **Submodule isolation**: no edits ever land in `.github/skills/sensei/`. We consume its scripts read-only.

## Resolved considerations

1. **GEPA LLM** — `claude-opus-4.7-1m-internal` on GitHub Models. Passed to `auto_evaluator.py optimize --model claude-opus-4.7-1m-internal`. No model-list discovery needed at runtime.
2. **Trigger-harness location** — repo-root `tests/{skill}/triggers.test.ts` (sensei default). Created during Phase 2 only for skills entering optimization.
3. **Accelerator sync exclusion** — Phase 0 will add an action item to `TODO.md` listing the additional `EXCLUDE_PATHS` entries the accelerator's `weekly-upstream-sync.yml` will need: `.github/skills/_audits/` and `tests/` (alongside the earlier sensei exclusions). Applied to the accelerator repo separately when the user is ready.
