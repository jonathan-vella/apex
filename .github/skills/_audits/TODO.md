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

- [ ] Sensei pre-audit (Round 2)
- [ ] Apply hybrid heading edits (azure-rbac, azure-resources, azure-storage, context-management, docs-writer, drawio)
- [ ] Validators + batch re-score
- [ ] Append "Post-update — Round 2" to `batch-3-audit.md`
- [ ] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 3, round 2)`

### Batch 4 — entra-app-registration → microsoft-docs (6 skills)

- [ ] Sensei pre-audit (Round 2)
- [ ] Apply hybrid heading edits (entra-app-registration, github-operations, golden-principles, iac-common, mermaid, microsoft-docs)
- [ ] Validators + batch re-score
- [ ] Append "Post-update — Round 2" to `batch-4-audit.md`
- [ ] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 4, round 2)`

### Batch 5 — python-diagrams → workflow-engine (6 skills)

- [ ] Sensei pre-audit (Round 2)
- [ ] Apply hybrid heading edits (python-diagrams, terraform-patterns, terraform-search-import, terraform-test, vendor-prompting, workflow-engine)
- [ ] Validators + batch re-score
- [ ] Append "Post-update — Round 2" to `batch-5-audit.md`
- [ ] Commit `feat(skills): Add ## Rules / ## Steps body sections (batch 5, round 2)`

### Final — global GEPA score-all (Round 2)

- [ ] Run `npm run audit:skills:gepa`
- [ ] Append "Post-update — Round 2" section to `gepa-audit.md`
- [ ] Commit `chore(skills): GEPA audit report (round 2)`

## Out-of-band action items

- [ ] **Accelerator-side**: extend `EXCLUDE_PATHS` in `azure-agentic-infraops-accelerator/.github/workflows/weekly-upstream-sync.yml` with `.github/skills/_audits/` (alongside the prior sensei exclusions)
