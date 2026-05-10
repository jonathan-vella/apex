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
- [ ] **Updates** — user issues `update batch 3` or `update <skill>` to apply audit recommendations + commit

### Batch 4 — entra-app-registration → microsoft-docs

- [x] Run sensei standard-mode score: entra-app-registration
- [x] Run sensei standard-mode score: github-operations
- [x] Run sensei standard-mode score: golden-principles
- [x] Run sensei standard-mode score: iac-common
- [x] Run sensei standard-mode score: mermaid
- [x] Run sensei standard-mode score: microsoft-docs
- [x] Generate `batch-4-audit.md`
- [x] Commit `chore(skills): Audit batch 4 report (sensei standard)`
- [ ] **Updates** — user issues `update batch 4` or `update <skill>` to apply audit recommendations + commit

### Batch 5 — python-diagrams → workflow-engine

- [x] Run sensei standard-mode score: python-diagrams
- [x] Run sensei standard-mode score: terraform-patterns
- [x] Run sensei standard-mode score: terraform-search-import
- [x] Run sensei standard-mode score: terraform-test
- [x] Run sensei standard-mode score: vendor-prompting
- [x] Run sensei standard-mode score: workflow-engine
- [x] Generate `batch-5-audit.md`
- [x] Commit `chore(skills): Audit batch 5 report (sensei standard)`
- [ ] **Updates** — user issues `update batch 5` or `update <skill>` to apply audit recommendations + commit

## Stage B — GEPA-mode audit (single global pass, read-only)

User-gated start: `gepa audit`. May run at any time, but recommended after Stage A is fully done.

- [ ] Run `npm run audit:skills:gepa` across all 33 skills
- [ ] Generate `gepa-audit.md` (summary table + per-skill `quality_detail` breakdown + deltas vs Stage A)
- [ ] Commit `chore(skills): GEPA audit report`
- [ ] **Updates** — user issues `update post-gepa` or `update <skill>` to apply GEPA-derived recommendations + commit

## Out-of-band action items

- [ ] **Accelerator-side**: extend `EXCLUDE_PATHS` in `azure-agentic-infraops-accelerator/.github/workflows/weekly-upstream-sync.yml` with `.github/skills/_audits/` (alongside the prior sensei exclusions)
