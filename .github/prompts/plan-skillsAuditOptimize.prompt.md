---
description: "Two-stage audit programme for skills frontmatter compliance. Stage A: per-batch read-only audit using sensei standard scoring + GEPA score-mode (deterministic, no LLM). Stage B: a single global GEPA score-all cross-skill report. User applies updates between stages on demand. No `optimize` subcommand, no LLM calls, no trigger-harness."
agent: agent
model: "Claude Opus 4.7"
tools: vscode, execute, read, agent, search, terminal
argument-hint: "audit batch N | update batch N | update <skill> | gepa audit | update post-gepa"
---

# Plan: Skills audit-then-update programme

**TL;DR** — Two read-only audit stages, with user-driven updates in between. Stage A: per-batch sensei standard scoring + GEPA `score`-mode signal (deterministic, no LLM). Stage B: a single global GEPA `score-all` cross-skill report. Both stages share the same underlying GEPA `score` algorithm; the difference is **scope** (per-batch vs all-skills) and **deliverable** (per-batch reports vs global delta report). The user decides when and what to update; the agent never applies changes automatically.

## Locked decisions

| Topic            | Decision                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| Scope            | All 33 active skills under `.github/skills/`, excluding `sensei` (submodule) and `archived_skills/`               |
| Stage A batching | 5 alphabetical chunks of 6–7 skills each (per-batch reports + commits)                                            |
| Stage B          | Single global GEPA score-all pass across all skills                                                               |
| Audit semantics  | Strict read-only — no skill-file edits during audit runs                                                          |
| Update trigger   | `update batch <N>`, `update <skill>`, or `update post-gepa` — explicit, user-issued                               |
| Files location   | `.github/skills/_audits/`                                                                                         |
| Tracker format   | Single `TODO.md` with checkboxes per skill per stage                                                              |
| Report format    | Both — concise summary table + detailed appendix per batch and one for Stage B                                    |
| Commit cadence   | Per-batch: 1 audit commit, then optional 1 update commit. Stage B: 1 audit commit, then optional 1 update commit. |
| LLM usage        | **None.** GEPA is run in `score` mode only.                                                                       |
| Test harness     | **None.** GEPA `score` does not require `tests/{skill}/triggers.test.ts`.                                         |

## Batch composition (Stage A only)

| Batch | Skills                                                                                                                          | Count |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1     | azure-adr, azure-artifacts, azure-bicep-patterns, azure-cloud-migrate, azure-compliance, azure-compute, azure-cost-optimization | 7     |
| 2     | azure-defaults, azure-deploy, azure-diagnostics, azure-governance-discovery, azure-kusto, azure-prepare, azure-quotas           | 7     |
| 3     | azure-rbac, azure-resources, azure-storage, azure-validate, context-management, docs-writer, drawio                             | 7     |
| 4     | entra-app-registration, github-operations, golden-principles, iac-common, mermaid, microsoft-docs                               | 6     |
| 5     | python-diagrams, terraform-patterns, terraform-search-import, terraform-test, vendor-prompting, workflow-engine                 | 6     |

## Stages

### Phase 0 — Scaffolding (one-time, no user gate, **done**)

1. Create `.github/skills/_audits/` directory.
2. Generate `TODO.md` with the per-skill checklist for both stages.
3. Add wrapper script `tools/scripts/run-sensei-audit.mjs` (reads frontmatter + token CLI + GEPA `score` evaluator → JSON per skill).
4. Add npm scripts: `audit:skills` (wrapper) and `audit:skills:gepa` (raw GEPA `score-all`).
5. Commit Phase 0 artifacts only.

### Stage A — Per-batch audit (read-only) using sensei standard + GEPA `score`-mode

For each batch (in order, on user trigger `audit batch <N>` or auto-sequenced if user says `audit batches 1-5`):

1. Run `npm run audit:skills -- --batch <N>` (read-only — uses sensei standard scoring + GEPA `score`).
2. Generate `.github/skills/_audits/batch-<N>-audit.md` with:
   - Summary table (skill, current adherence, GEPA score, tokens, top issue, recommended action)
   - Detailed appendix per skill: full current frontmatter, scoring breakdown, concrete proposed before/after diff (text only — not applied), token delta projection, MCP-integration check (where INVOKES applies).
3. Tick the matching boxes in `TODO.md`.
4. Commit `chore(skills): Audit batch <N> report (sensei standard)`.
5. Hand off to user for review. **Stop and wait.**

### Stage A updates — user-gated (`update batch <N>` or `update <skill>`)

When the user issues `update batch <N>` or `update <skill>`:

1. Apply the proposed before/after diffs from `batch-<N>-audit.md` for each skill in the batch (or the named skill).
2. Run validators: `npm run validate:agents`, `validate:agent-registry`, `lint:vendor-prompting`, `validate:skills`. Reject any skill change that fails validators.
3. Re-score the updated skills via `npm run audit:skills -- --skills <name1>,<name2>` — append a "Post-update" section to `batch-<N>-audit.md` showing before/after scores.
4. Commit `feat(skills): Update batch <N> per audit findings`.
5. Tick the matching update boxes in `TODO.md`.

> **User control**: at any point the user may edit skill files manually instead of issuing `update batch <N>`. The agent honors hand edits and re-scores on request.

### Stage B — GEPA-mode audit (single global pass, read-only)

Triggered when the user says `gepa audit` (typically after Stage A completes, but the user may run it at any time):

1. Run `npm run audit:skills:gepa` to get GEPA `score-all` output across all 33 skills (deterministic, no LLM).
2. Cross-join with the sensei standard scores from Stage A reports (if available).
3. Generate `.github/skills/_audits/gepa-audit.md` with:
   - Summary table: skill, GEPA score, token count, deltas vs. last Stage A audit (where available), top issue, suggested action.
   - Detailed appendix per skill: GEPA's `quality_detail` breakdown (`description_length`, `has_use_for`, `has_when`, `has_rules`, `has_steps`, `no_bad_patterns`), feedback strings, false-positive flags (e.g., the GEPA TODO/FIXME regex misfiring on quality-checklist text).
4. Tick the Stage B boxes in `TODO.md`.
5. Commit `chore(skills): GEPA audit report`.
6. Hand off to user for review. **Stop and wait.**

### Stage B updates — user-gated (`update post-gepa` or `update <skill>`)

When the user issues `update post-gepa` or per-skill `update <skill>`:

1. Apply proposed changes from `gepa-audit.md` (typically smaller deltas — adding `WHEN:` or `USE FOR:` literals, fixing GEPA-detected gaps).
2. Run validators (same as Stage A updates).
3. Re-run `npm run audit:skills:gepa` and append a "Post-update" section to `gepa-audit.md`.
4. Commit `feat(skills): Update skills per GEPA audit findings`.

## Relevant files

- `.github/skills/_audits/TODO.md` — programme tracker
- `.github/skills/_audits/batch-{1..5}-audit.md` — Stage A per-batch reports
- `.github/skills/_audits/gepa-audit.md` — Stage B global report
- `tools/scripts/run-sensei-audit.mjs` — wrapper for repeatable audit runs
- `package.json` — `audit:skills` and `audit:skills:gepa` npm scripts
- `.github/skills/sensei/scripts/src/gepa/auto_evaluator.py` — upstream evaluator (read-only; no edits to submodule)
- `.github/skills/{skill}/SKILL.md` — modified only on explicit `update batch <N>`, `update <skill>`, or `update post-gepa`

## Verification

| Stage          | Check                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 (done)       | `ls .github/skills/_audits/TODO.md`; `npm run audit:skills -- --skills azure-adr` returns valid JSON                                                    |
| Stage A audit  | `npm run validate:skills` (no skill files changed during audit); `batch-<N>-audit.md` parses as markdown                                                |
| Stage A update | After each update: `npm run validate:agents`, `validate:agent-registry`, `validate:skills`, `lint:vendor-prompting`; re-score deltas appended to report |
| Stage B audit  | `npm run audit:skills:gepa` returns valid JSON; `gepa-audit.md` parses as markdown                                                                      |
| Stage B update | Same validators as Stage A update; final `audit:skills:gepa` run shows ≥ target improvement                                                             |

## Decisions / scope boundaries

- **In scope**: 33 active skills' frontmatter; per-batch and one Stage B report; minor wrapper scripts.
- **Out of scope**: Skill body content rewrites; archived skills; the sensei submodule itself; agent (`.agent.md`) and prompt (`.prompt.md`) files; GEPA `optimize` subcommand; trigger test harnesses; LLM-driven rewrites.
- **`azure-adr` re-baseline**: re-audited in Batch 1 alongside others for consistency.
- **Submodule isolation**: no edits ever land in `.github/skills/sensei/`. We consume its scripts read-only.
- **No automated rewrites**: every skill-file change requires an explicit user `update` command.

## Resolved considerations

1. **GEPA `score`-mode is shared by both stages** — `tools/scripts/run-sensei-audit.mjs` calls GEPA `score` per skill on every Stage A batch run; `npm run audit:skills:gepa` calls GEPA `score-all` once across all 33 skills for Stage B. Same algorithm, different scope. The two stages differ in the **deliverable**:
   - Stage A → per-batch report with proposed before/after diffs and recommended actions per skill.
   - Stage B → single global report with cross-skill rankings, baseline-vs-current deltas, and aggregate trends.
2. **No LLM dependency** — GEPA `score` and `score-all` are deterministic regex-based content checks. No API calls, no `gh auth token`, no `OPENAI_API_KEY`.
3. **No test harness** — neither stage requires `tests/{skill}/triggers.test.ts`. The harness scaffolding work is removed from the plan entirely.
4. **No `gepa` Python package** — the `score`/`score-all` subcommands use only Python stdlib + the regex-based content quality scorer in `auto_evaluator.py` from the upstream sensei submodule.
5. **Accelerator sync exclusion** — Phase 0 added an action item to `TODO.md` for extending `EXCLUDE_PATHS` in the accelerator's `weekly-upstream-sync.yml` to include `.github/skills/_audits/` (alongside earlier sensei exclusions). Applied to the accelerator repo separately when the user is ready.
