# Skills Audit-then-Optimize Programme — Tracker

> **Source plan**: [`.github/prompts/plan-skillsAuditOptimize.prompt.md`](../../prompts/plan-skillsAuditOptimize.prompt.md)
> **Branch**: `feat/skills-sensei`
> **Phases**: 0 (scaffolding) → 1 (audit per batch) → 2 (optimize per user command) → 3 (final GEPA audit)

## Phase 0 — Scaffolding (no user gate)

- [x] Create `.github/skills/_audits/` directory
- [x] Author `TODO.md` (this file)
- [x] Add `tools/scripts/run-sensei-audit.mjs` wrapper
- [x] Add `audit:skills:gepa` npm script
- [x] Commit `chore(skills): Phase 0 scaffolding for skills audit programme`
- [ ] **Action item**: Note for accelerator workflow — extend `EXCLUDE_PATHS` in `weekly-upstream-sync.yml` to include `.github/skills/_audits/` and `tests/` (apply later when accelerator-side changes are batched)

## Phase 1 — Standard-mode audit (read-only, per batch)

User-gated start: **explicit `audit batch <N>` or auto-run after Phase 0 completes**.

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

### Batch 2 — azure-defaults → azure-quotas

- [ ] Run sensei standard-mode score: azure-defaults
- [ ] Run sensei standard-mode score: azure-deploy
- [ ] Run sensei standard-mode score: azure-diagnostics
- [ ] Run sensei standard-mode score: azure-governance-discovery
- [ ] Run sensei standard-mode score: azure-kusto
- [ ] Run sensei standard-mode score: azure-prepare
- [ ] Run sensei standard-mode score: azure-quotas
- [ ] Generate `batch-2-audit.md`
- [ ] Commit `chore(skills): Audit batch 2 report (sensei standard)`

### Batch 3 — azure-rbac → drawio

- [ ] Run sensei standard-mode score: azure-rbac
- [ ] Run sensei standard-mode score: azure-resources
- [ ] Run sensei standard-mode score: azure-storage
- [ ] Run sensei standard-mode score: azure-validate
- [ ] Run sensei standard-mode score: context-management
- [ ] Run sensei standard-mode score: docs-writer
- [ ] Run sensei standard-mode score: drawio
- [ ] Generate `batch-3-audit.md`
- [ ] Commit `chore(skills): Audit batch 3 report (sensei standard)`

### Batch 4 — entra-app-registration → microsoft-docs

- [ ] Run sensei standard-mode score: entra-app-registration
- [ ] Run sensei standard-mode score: github-operations
- [ ] Run sensei standard-mode score: golden-principles
- [ ] Run sensei standard-mode score: iac-common
- [ ] Run sensei standard-mode score: mermaid
- [ ] Run sensei standard-mode score: microsoft-docs
- [ ] Generate `batch-4-audit.md`
- [ ] Commit `chore(skills): Audit batch 4 report (sensei standard)`

### Batch 5 — python-diagrams → workflow-engine

- [ ] Run sensei standard-mode score: python-diagrams
- [ ] Run sensei standard-mode score: terraform-patterns
- [ ] Run sensei standard-mode score: terraform-search-import
- [ ] Run sensei standard-mode score: terraform-test
- [ ] Run sensei standard-mode score: vendor-prompting
- [ ] Run sensei standard-mode score: workflow-engine
- [ ] Generate `batch-5-audit.md`
- [ ] Commit `chore(skills): Audit batch 5 report (sensei standard)`

## Phase 2 — Optimize approved batches (user-gated)

> **Trigger phrase**: `optimize batch <N>` or `optimize <skill>` — explicit per-batch/per-skill.

### Per-batch optimize checklist (repeat per approved batch)

- [ ] Install GEPA (`pip install --user 'gepa>=0.3.0'`) — once
- [ ] Set env: `OPENAI_API_BASE=https://models.github.ai/inference` + `OPENAI_API_KEY=$(gh auth token)` — once

### Batch 1 optimize

- [ ] Author trigger harnesses (`tests/{skill}/triggers.test.ts`) for batch 1
- [ ] User reviews/edits seed harnesses
- [ ] Run GEPA optimize: azure-adr
- [ ] Run GEPA optimize: azure-artifacts
- [ ] Run GEPA optimize: azure-bicep-patterns
- [ ] Run GEPA optimize: azure-cloud-migrate
- [ ] Run GEPA optimize: azure-compliance
- [ ] Run GEPA optimize: azure-compute
- [ ] Run GEPA optimize: azure-cost-optimization
- [ ] Apply approved candidates (must pass `validate:agents` + `validate:agent-registry` + `lint:vendor-prompting`)
- [ ] Commit `feat(skills): Optimize batch 1 (GEPA + Claude Opus)`

### Batch 2 optimize

- [ ] Author trigger harnesses for batch 2
- [ ] User reviews/edits seed harnesses
- [ ] Run GEPA optimize for each batch-2 skill
- [ ] Apply approved candidates (gated on validators)
- [ ] Commit `feat(skills): Optimize batch 2 (GEPA + Claude Opus)`

### Batch 3 optimize

- [ ] Author trigger harnesses for batch 3
- [ ] User reviews/edits seed harnesses
- [ ] Run GEPA optimize for each batch-3 skill
- [ ] Apply approved candidates (gated on validators)
- [ ] Commit `feat(skills): Optimize batch 3 (GEPA + Claude Opus)`

### Batch 4 optimize

- [ ] Author trigger harnesses for batch 4
- [ ] User reviews/edits seed harnesses
- [ ] Run GEPA optimize for each batch-4 skill
- [ ] Apply approved candidates (gated on validators)
- [ ] Commit `feat(skills): Optimize batch 4 (GEPA + Claude Opus)`

### Batch 5 optimize

- [ ] Author trigger harnesses for batch 5
- [ ] User reviews/edits seed harnesses
- [ ] Run GEPA optimize for each batch-5 skill
- [ ] Apply approved candidates (gated on validators)
- [ ] Commit `feat(skills): Optimize batch 5 (GEPA + Claude Opus)`

## Phase 3 — Final GEPA-mode audit (after all approved batches optimized)

- [ ] Run GEPA `score-all` across all 33 skills
- [ ] Generate `final-gepa-audit.md` (baseline vs. current, deltas, top wins, sub-0.7 diagnoses, trigger accuracy)
- [ ] Validate report parses + is human-readable
- [ ] Commit `docs(skills): Final GEPA audit report`

## Out-of-band action items

- [ ] **Accelerator-side**: extend `EXCLUDE_PATHS` in `azure-agentic-infraops-accelerator/.github/workflows/weekly-upstream-sync.yml` with `.github/skills/_audits/` and `tests/` (in addition to the prior sensei exclusions)
