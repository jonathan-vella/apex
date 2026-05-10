# Skills Audit-then-Update Programme — Tracker

> **Source plan**: [`.github/prompts/plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md)
> **Branch**: `feat/skills-sensei`
> **Stages**: 0 (scaffolding) → A (sensei standard audit per batch + user updates) → B (GEPA score-all audit + user updates)

## Phase 0 — Scaffolding (no user gate)

- [x] Create `.github/skills/_audits/` directory
- [x] Author `TODO.md` (this file)
- [x] Add `tools/scripts/run-sensei-audit.mjs` wrapper
- [x] Add `audit:skills` and `audit:skills:gepa` npm scripts
- [x] Commit Phase 0 artifacts

## Stage A — Sensei standard-mode audit (per batch, read-only)

User-gated start: `audit batch <N>` or `audit batches 1-5` for sequential.

### Batch 1 — azure-adr → azure-cost-optimization

- [x] Run sensei standard-mode score: azure-adr
- [x] Run sensei standard-mode score: azure-artifacts
- [x] Run sensei standard-mode score: azure-bicep-patterns
- [x] Run sensei standard-mode score: azure-cloud-migrate
- [x] Run sensei standard-mode score: azure-compliance
- [x] Run sensei standard-mode score: azure-compute
- [x] Run sensei standard-mode score: azure-cost-optimization
- [x] Generate `batch-1-audit.md`
- [x] Commit `chore(skills): Audit batch 1 report (sensei standard)`
- [x] **Updates** — user issued `update batch 1`; all 7 diffs applied, 4/7 now pass GEPA ≥ 0.7 (was 1/7), commit recorded

### Batch 2 — azure-defaults → azure-quotas

- [x] Run sensei standard-mode score: azure-defaults
- [x] Run sensei standard-mode score: azure-deploy
- [x] Run sensei standard-mode score: azure-diagnostics
- [x] Run sensei standard-mode score: azure-governance-discovery
- [x] Run sensei standard-mode score: azure-kusto
- [x] Run sensei standard-mode score: azure-prepare
- [x] Run sensei standard-mode score: azure-quotas
- [x] Generate `batch-2-audit.md`
- [x] Commit `chore(skills): Audit batch 2 report (sensei standard)`
- [x] **Updates** — user issued `update batch 2`; all 7 diffs applied (incl. INVOKES for kusto + quotas), 6/7 now pass GEPA ≥ 0.7 (was 2/7), azure-prepare trimmed from 1019→693 chars, azure-deploy normalized to standard anti-trigger format and reached 1.00, commit recorded

### Batch 3 — azure-rbac → drawio

- [x] Run sensei standard-mode score: azure-rbac
- [x] Run sensei standard-mode score: azure-resources
- [x] Run sensei standard-mode score: azure-storage
- [x] Run sensei standard-mode score: azure-validate
- [x] Run sensei standard-mode score: context-management
- [x] Run sensei standard-mode score: docs-writer
- [x] Run sensei standard-mode score: drawio
- [x] Generate `batch-3-audit.md`
- [x] Commit `chore(skills): Audit batch 3 report (sensei standard)`
- [x] **Updates** — user issued `update batch 3`; all 7 diffs applied, azure-resources fixed from Invalid (1367→574 chars), drawio + docs-writer rewritten to High tier, 6/7 now pass GEPA ≥ 0.7 (was 1/7), azure-validate reaches 1.00, commit recorded

### Batch 4 — entra-app-registration → microsoft-docs

- [x] Run sensei standard-mode score: entra-app-registration
- [x] Run sensei standard-mode score: github-operations
- [x] Run sensei standard-mode score: golden-principles
- [x] Run sensei standard-mode score: iac-common
- [x] Run sensei standard-mode score: mermaid
- [x] Run sensei standard-mode score: microsoft-docs
- [x] Generate `batch-4-audit.md`
- [x] Commit `chore(skills): Audit batch 4 report (sensei standard)`
- [x] **Updates** — user issued `update batch 4`; all 6 diffs applied, 4 stale refs fixed, 5/6 now pass GEPA ≥ 0.7 (was 0/6), microsoft-docs gained INVOKES for Microsoft Learn MCP, commit recorded

### Batch 5 — python-diagrams → workflow-engine

- [x] Run sensei standard-mode score: python-diagrams
- [x] Run sensei standard-mode score: terraform-patterns
- [x] Run sensei standard-mode score: terraform-search-import
- [x] Run sensei standard-mode score: terraform-test
- [x] Run sensei standard-mode score: vendor-prompting
- [x] Run sensei standard-mode score: workflow-engine
- [x] Generate `batch-5-audit.md`
- [x] Commit `chore(skills): Audit batch 5 report (sensei standard)`
- [x] **Updates** — user issued `update batch 5`; all 6 diffs applied, vendor-prompting `Triggers:` → `WHEN:` normalized, all 6/6 now pass GEPA ≥ 0.7 (was 1/6), commit recorded

## Stage B — GEPA-mode audit (single global pass, read-only)

User-gated start: `gepa audit`. May run at any time, but recommended after Stage A is fully done.

- [x] Run `npm run audit:skills:gepa` across all 33 skills
- [x] Generate `gepa-audit.md` (summary table + per-skill `quality_detail` breakdown + deltas vs Stage A)
- [x] Commit `chore(skills): GEPA audit report`
- [ ] **Updates** — user issues `update post-gepa` or `update <skill>` to apply GEPA-derived recommendations + commit

> **Stage B summary (2026-05-10)**: 33 skills audited via `score-all`. 3 at 1.00, 7 at 0.83, 23 at 0.67. Average 0.74 (unchanged vs Stage A). Two non-zero deltas: `azure-artifacts` 0.50 → 0.67 (+0.17), `azure-compute` 0.83 → 0.67 (−0.16, regression — investigate). Residual gap: 28× missing `## Rules`, 25× missing `## Steps` body sections — explicitly out-of-scope per the source plan. See [`gepa-audit.md`](./gepa-audit.md) for details. Awaiting `update post-gepa` or `update <skill>` to proceed.

## Round 2 — Body-section pass (scope expansion, user-approved 2026-05-10)

User explicitly approved expanding scope beyond the original frontmatter-only programme. Strategy: hybrid (rename existing equivalent headings to `## Rules` / `## Steps` where one exists; author a minimal section otherwise). Per-batch sensei pre-audit → updates → validators → batch re-score → final GEPA `score-all`.

### Batch 1 — azure-adr → azure-cost-optimization (6 skills)

- [x] Sensei pre-audit (Round 2)
- [x] Investigate & fix `azure-compute` regression (re-add `## Steps`)
- [x] Apply hybrid heading edits (azure-adr, azure-artifacts, azure-bicep-patterns, azure-compliance, azure-compute, azure-cost-optimization)
- [x] Run validators (`validate:agents`, `validate:agent-registry`, `validate:skills`, `lint:vendor-prompting`)
- [x] Append "Post-update — Round 2" section to `batch-1-audit.md`
- [x] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 1, round 2)` — all 6 → 1.00 ✓

### Batch 2 — azure-defaults → azure-quotas (6 skills, azure-deploy already 1.00)

- [x] Sensei pre-audit (Round 2)
- [x] Apply hybrid heading edits (azure-defaults, azure-diagnostics, azure-governance-discovery, azure-kusto, azure-prepare, azure-quotas)
- [x] Validators + batch re-score
- [x] Append "Post-update — Round 2" to `batch-2-audit.md`
- [x] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 2, round 2)` — all 6 → 1.00 ✓

### Batch 3 — azure-rbac → drawio (6 skills, azure-validate already 1.00)

- [x] Sensei pre-audit (Round 2)
- [x] Apply hybrid heading edits (azure-rbac, azure-resources, azure-storage, context-management, docs-writer, drawio)
- [x] Validators + batch re-score
- [x] Append "Post-update — Round 2" to `batch-3-audit.md`
- [x] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 3, round 2)` — all 6 → 1.00 ✓

### Batch 4 — entra-app-registration → microsoft-docs (6 skills)

- [x] Sensei pre-audit (Round 2)
- [x] Apply hybrid heading edits (entra-app-registration, github-operations, golden-principles, iac-common, mermaid, microsoft-docs)
- [x] Validators + batch re-score
- [x] Append "Post-update — Round 2" to `batch-4-audit.md`
- [x] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 4, round 2)` — all 6 → 1.00 ✓

### Batch 5 — python-diagrams → workflow-engine (6 skills)

- [x] Sensei pre-audit (Round 2)
- [x] Apply hybrid heading edits (python-diagrams, terraform-patterns, terraform-search-import, terraform-test, vendor-prompting, workflow-engine)
- [x] Validators + batch re-score
- [x] Append "Post-update — Round 2" to `batch-5-audit.md`
- [x] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 5, round 2)` — all 6 → 1.00 ✓

### Final — global GEPA score-all (Round 2)

- [x] Run `npm run audit:skills:gepa`
- [x] Append "Post-update — Round 2" section to `gepa-audit.md`
- [x] Commit `chore(skills): GEPA audit report (round 2)` — **33 / 33 skills at 1.00, average 1.00 ✓**

## Plan 1 — Status: COMPLETE (2026-05-10)

[`plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md) finalized. All 33 in-scope skills at GEPA `quality_score: 1.00`. The remaining sensei capabilities (token squeeze, MCP integration, trigger tests, GEPA `optimize`) move to Plan 2.

## Plan 2 — Sensei GEPA Pipeline (end-to-end)

Source plan: [`.github/prompts/sensei/plan-gepa-pipeline.prompt.md`](../../prompts/sensei/plan-gepa-pipeline.prompt.md). Six stages, user-gated.

### Stage 1 — Token-budget baseline (read-only)

User trigger: `tokens baseline`.

- [x] Run `tokens count` for all 33 skills
- [x] Run `tokens compare main HEAD` to capture Round 2 delta
- [x] Generate `01-tokens-baseline.md`
- [x] Commit `chore(skills): Token-budget baseline (stage 1)`

> **Stage 1 summary (2026-05-10)**: 33 SKILL.md files total **60,351 tokens** (mean 1,829, max 2,806 `drawio`).
> All 33 exceed the 500-token soft limit; **0 / 33** exceed the 5,000-token hard limit. Round 2 delta vs `main`:
> **+3,095 tokens** net across 33 SKILL.md files (28 increased from body-section additions; 5 decreased from
> Round 1 trims that survived). See [`01-tokens-baseline.md`](./01-tokens-baseline.md). Awaiting
> `tokens squeeze batch <N>` to start Stage 2.

### Stage 2 — Token squeeze (per-batch, user-gated)

User trigger: `tokens squeeze batch <N>` (1–5).

- [x] Batch 1 — squeeze + validators + commit (`fcd5ae7`) — net -1,067 tokens (-9.6%); largest savings: `azure-cost-optimization` -766 (-35%), `azure-artifacts` -312 (-18%); 33/33 within new repo-root `.token-limits.json` limits
- [x] Batch 2 — squeeze + validators + commit (`0805f3c`) — net -1,240 tokens (-8.9%); largest savings: `azure-prepare` -860 (-35%), `azure-kusto` -210 (-11%), `azure-defaults` -170 (-7%)
- [x] Batch 3 — squeeze + validators + commit (`c9ee2c9`) — net -1,339 tokens (-10.2%); largest savings: `docs-writer` -525 (-23%), `azure-resources` -361 (-16%), `drawio` -232 (-8%), `context-management` -221 (-11%)
- [x] Batch 4 — squeeze + validators + commit (`134a186`) — net -2,543 tokens (-22.7%, biggest batch); largest savings: `golden-principles` -993 (-58%), `iac-common` -771 (-35%), `github-operations` -411 (-18%), `entra-app-registration` -368 (-15%)
- [x] Batch 5 — squeeze + validators + commit — net -798 tokens (-7.3%); largest savings: `workflow-engine` -293 (-16%), `terraform-search-import` -276 (-18%), `vendor-prompting` -177 (-8%)

> **Stage 2 grand totals (2026-05-10)**: 33 SKILL.md files **60,351 → 53,364 tokens (-6,987, -11.6%)**.
> 17 skills decreased; 1 skill +0.6% (structural relocation, token-neutral); 15 unchanged.
> 13 reference files created or extended (10 new, 3 extended).
> 33 / 33 within repo-root `.token-limits.json` soft limits. Validators all green.
> Awaiting `mcp audit` to start Stage 3.

### Stage 3 — MCP-integration audit (read-only) + updates

User triggers: `mcp audit`, then `mcp update` or `mcp update <skill>`.

- [x] Audit `azure-kusto`, `azure-quotas`, `microsoft-docs`, `drawio` (+ any new INVOKES from Stage 2)
- [x] Generate `02-mcp-integration.md`
- [x] Commit `chore(skills): MCP-integration audit (stage 3)`
- [x] Apply remediation diffs (user-gated) + commit — net +1,013 tokens across 4 skills, all within `.token-limits.json` overrides

> **Stage 3 audit + remediation summary (2026-05-10)**: 4 INVOKES skills audited and updated.
> Per-skill deltas: `azure-kusto` +138, `azure-quotas` +405 (resolved INVOKES contradiction
> with new `## MCP Tools (Optional Augmentation)`), `microsoft-docs` +104 (added 3rd tool +
> Prerequisites), `drawio` +366 (added MCP Tools merged with workflow summary, CLI fallback
> notice, name-collision note). All four skills within their `.token-limits.json` limits.
> Cumulative impact across Stages 2+3: **60,351 → 54,377 tokens (-5,974, -9.9%)**.

### Stage 4 — Waza trigger-test scaffolding (per-batch, user-gated)

User trigger: `tests batch <N>`.

- [ ] Batch 1 — author `tests/{skill}/trigger_tests.yaml` + verify trigger_accuracy + commit
- [ ] Batch 2 — same
- [ ] Batch 3 — same
- [ ] Batch 4 — same
- [ ] Batch 5 — same

### Stage 5 — GEPA optimize (per-batch or per-skill, user-gated)

User triggers: `optimize batch <N>` or `optimize <skill>`. Prerequisite: Stage 4 complete for the target skills.

- [ ] Batch 1 — per-skill optimize + validator gate + per-skill commits
- [ ] Batch 2 — same
- [ ] Batch 3 — same
- [ ] Batch 4 — same
- [ ] Batch 5 — same

### Stage 6 — Final cross-skill report

User trigger: `final report`.

- [ ] Run final `audit:skills:gepa` + `tokens count` + trigger-accuracy check
- [ ] Generate `05-pipeline-final.md`
- [ ] Commit `chore(skills): Sensei GEPA pipeline final report (stage 6)`

## Out-of-band action items

- [ ] **Accelerator-side**: extend `EXCLUDE_PATHS` in `azure-agentic-infraops-accelerator/.github/workflows/weekly-upstream-sync.yml` with `.github/skills/_audits/` (alongside the prior sensei exclusions)
