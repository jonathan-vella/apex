# Strictness Ratcheting Tracker

> **Goal**: Upgrade all artifact validation from `relaxed` to `standard` strictness
>
> **Status**: ✅ **COMPLETE** - All 12 artifacts at standard strictness

## Strictness Configuration

The artifact template validator uses per-artifact strictness:

| Artifact Category  | Artifacts                                                                                                                                     | Strictness | Status      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| Core (established) | `01-requirements`, `04-implementation-plan`, `06-deployment-summary`, `04-governance-constraints`                                             | `standard` | ✅ Complete |
| Legacy artifacts   | `02-architecture-assessment`                                                                                                                  | `standard` | ✅ Complete |
| Wave 2 (05)        | `05-implementation-reference`                                                                                                                 | `standard` | ✅ Complete |
| Wave 2 (07-\*)     | `07-design-document`, `07-operations-runbook`, `07-resource-inventory`, `07-backup-dr-plan`, `07-compliance-matrix`, `07-documentation-index` | `standard` | ✅ Complete |

Override with environment variable: `STRICTNESS=standard npm run lint:artifact-templates`

## Ratcheting Plan

### Phase 1: Established Core Artifacts ✅ Complete

- [x] `01-requirements.md` - standard
- [x] `04-implementation-plan.md` - standard
- [x] `06-deployment-summary.md` - standard

### Phase 2: Newly Templatized Artifacts ✅ Complete

- [x] `02-architecture-assessment.md` - relaxed → **standard** ✅
  - [x] Rewrote ecommerce artifact to match template (v3.9.0)
  - [x] Upgraded strictness
- [x] `04-governance-constraints.md` - relaxed → **standard** ✅
  - [x] Updated static-webapp artifact to match template
  - [x] Updated simple-web-api artifact to match template
  - [x] Upgraded strictness

### Phase 3: Implementation Reference ✅ Complete

- [x] `05-implementation-reference.md` - relaxed → **standard** ✅
  - [x] Rewrote ecommerce artifact to match template (v3.9.0)
  - [x] Upgraded strictness

### Phase 4: Workload Documentation ✅ Complete

- [x] `07-design-document.md` - relaxed → **standard** ✅
- [x] `07-operations-runbook.md` - relaxed → **standard** ✅
- [x] `07-resource-inventory.md` - relaxed → **standard** ✅
- [x] `07-backup-dr-plan.md` - relaxed → **standard** ✅
- [x] `07-compliance-matrix.md` - relaxed → **standard** ✅
- [x] `07-documentation-index.md` - relaxed → **standard** ✅

## History

### v3.9.0 - All Artifacts Standard (2026-01-14)

| Check    | Result          |
| -------- | --------------- |
| Failures | 0               |
| Warnings | 3 (optional H2) |
| Mode     | standard        |

- All 12 artifact types now at standard strictness
- Restructured all Wave 2 (07-\*) artifacts to match templates
- Rewrote legacy ecommerce artifacts (02-_, 05-_)
- Added optional section allowances for common extra content

### v3.8.1 - Generalized Validation (2026-01-14)

- Expanded from 4 core artifacts to 12 total
- Added per-artifact strictness configuration
- Created 8 new templates for Wave 2 artifacts
- Renamed `validate-wave1-artifacts.mjs` → `validate-artifact-templates.mjs`

### v3.8.0 - Core Artifacts (2026-01-13)

| Check    | Result   |
| -------- | -------- |
| Failures | 0        |
| Warnings | 0        |
| Mode     | standard |

---

_Last updated: 2026-01-14 (v3.9.0)_
