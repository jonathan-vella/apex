# Repository Content Archive

> Documentation-first plan for removing redundant active content while preserving restorable history.

## Status

**State**: Completed
**Branch**: `chore/archive-redundant-content-2026-08-27`
**Baseline commit**: `0f17fdb859a94bc2402a1aa266dcefec5b02df51`
**Created**: 2026-08-27
**Owner**: Jonathan Vella
**Inventory**: [Redundancy inventory](../../../../.archive/redundancy-inventory-2026-08-27.json)

No additional active content may move or be removed until the inventory is approved. Existing uncommitted test
consolidation is carried on this branch and is documented as the first archive batch.

## Objective

Remove content that is redundant, unreachable, superseded, or historical-only from active repository paths. Preserve
retired content in deterministic dated tarballs under `.archive/redundant-content/`, with checksums and source commit
metadata sufficient for inspection and restoration.

Reducing file count is not an objective. Active behavior, discoverability, validation coverage, auditability, and
reproducibility take precedence.

## Fixed Decisions

- All work occurs on `chore/archive-redundant-content-2026-08-27`.
- The current test-consolidation work remains on this branch and becomes archive batch `retired-root-tests`.
- Automated findings, zero live references, semantic duplication, and historical-only status are candidate evidence.
- Archive payloads use deterministic dated `.tar.gz` files with repository-relative member paths.
- This plan and the JSON inventory must be committed and approved before archive creation or further active-path edits.
- Git history is primary provenance; repository-local tarballs provide direct inspection and restoration.

## Baseline

The baseline was captured after branch creation and before this document was written.

| Check                        | Result             | Evidence                                                     |
| ---------------------------- | ------------------ | ------------------------------------------------------------ |
| Branch naming and scope      | Pass               | Cross-cutting `chore/` branch; no path restriction           |
| Quarterly audit              | Pass with warnings | Unreferenced-skill warnings require auto-discovery review    |
| Deprecated references        | Pass               | No active deprecated path references                         |
| Terminology                  | Pass               | No deprecated terminology findings                           |
| Deprecated models            | Pass               | No deprecated model assignments                              |
| Skill validation             | Pass with warnings | Orphaned references and advisory description length findings |
| Session-state validation     | Pass               | Template conforms to current schema                          |
| Extension and VS Code checks | Pass               | No duplicate or denied extension configuration               |
| Full validation              | Pass               | Repository validation completed before inventory authoring   |

The unreferenced-skill warnings for `docs-writer`, `terraform-search-import`, and `terraform-test` are false positives:
these skills are auto-discovered from `SKILL.md` frontmatter and expose distinct user-triggered workflows. They are
retained.

## Eligibility Rules

A candidate is eligible for archival only when all applicable conditions are met:

1. Evidence is reproducible and recorded in the inventory.
2. Runtime, discovery, CI, package, documentation, generator, schema, and test consumers are traced.
3. Unique useful material is moved to a named canonical replacement before archival.
4. Post-change checks demonstrate dependency closure and preserved behavior.
5. The reviewer records an `approved` verdict and rationale.
6. The source appears in exactly one archive and no active consumer reads from `.archive`.

Auto-discovered entrypoints, schemas, templates, fixtures, registries, workflow graphs, package scripts, generated
sources of truth, and audit sidecars cannot qualify from text-reference counts alone.

## Proposed Changes

The JSON inventory is authoritative for exact source paths and dependencies.

| ID      | Proposed action                | Archive group         | Summary                                                          |
| ------- | ------------------------------ | --------------------- | ---------------------------------------------------------------- |
| ARC-001 | Archive                        | `retired-root-tests`  | Sensei trigger vectors excluded from main-bound work             |
| ARC-002 | Archive                        | `retired-root-tests`  | SKU alias test for a removed documentation contract              |
| ARC-003 | Archive                        | `retired-root-tests`  | Unreferenced scenario fixtures with no active consumer           |
| ARC-004 | Consolidate then archive       | `superseded-guidance` | Unreachable Step 3 ADR review reference                          |
| ARC-005 | Consolidate then archive       | `superseded-guidance` | Unreachable cost-estimate standards reference                    |
| ARC-006 | Consolidate then archive       | `superseded-guidance` | Unreachable workload-documentation reference                     |
| ARC-007 | Edit and archive prior version | `superseded-guidance` | Dead `docs/**/*.md` glob segment                                 |
| RET-001 | Retain                         | None                  | Useful root tests and fixtures already migrated to `tools/tests` |
| RET-002 | Retain                         | None                  | Auto-discovered skills reported as textually unreferenced        |
| RET-003 | Retain                         | None                  | Targeted H2 checker with a unique single-artifact CLI            |
| RET-004 | Retain                         | None                  | Independent contract tests that cover distinct behavior          |
| RET-005 | Retain                         | None                  | Generated registries and explorer assets with active consumers   |
| RET-006 | Retain                         | None                  | Existing frozen archive payloads                                 |

## Archive Layout

Approved payloads will use these paths:

```text
.archive/redundant-content/
├── retired-root-tests-2026-08-27.tar.gz
├── superseded-guidance-2026-08-27.tar.gz
└── CHECKSUMS.sha256
```

Tarballs must use sorted names, fixed owner and group, a fixed UTC modification time, and repository-relative member
paths. The inventory will be updated after creation with each archive's SHA-256, byte size, complete member list, source
commit, and creation parameters.

Files already absent from the working tree will be reconstructed from the baseline commit before archiving. This rule
applies to the root test content in ARC-001 through ARC-003.

## Batch Sequence

### Batch 1: Retired Root Tests

1. Reconstruct ARC-001 through ARC-003 from the baseline commit in a temporary directory.
2. Create and verify `retired-root-tests-2026-08-27.tar.gz`.
3. Preserve useful migrated tests and fixtures under `tools/tests`.
4. Include the existing package, CI, documentation, and path corrections.
5. Run Node contract, Python tooling, SKU fixture, formatting, JSON, Markdown, and structural checks.

### Batch 2: Superseded Guidance

1. Move unique ADR review behavior into the active Design agent or indexed ADR skill guidance.
2. Reconcile cost-estimate requirements with canonical templates and `cost-estimate-sections.md`.
3. Reconcile workload documentation with active Step 7 templates and docs-writer standards.
4. Remove the inactive `docs/**/*.md` glob branch from the active instruction.
5. Archive the four superseded source snapshots and update every affected reference index.
6. Run agent, skill, instruction, artifact, documentation, and link validation.

No test files will be merged merely because they share a directory or runner. Distinct test contracts remain distinct.

## Documentation Reconciliation

After approved archive batches pass validation:

- Add each tarball, purpose, retirement date, and inventory link to `.archive/README.md`.
- Record the completed cleanup under the Unreleased section of `CHANGELOG.md`.
- Update repository and site documentation only where active paths or capabilities changed.
- Regenerate owned indexes and registries through their generator commands.
- Move this plan to `tools/tests/exec-plans/completed/`.
- Record the work as resolved in `tools/tests/exec-plans/tech-debt-tracker.md`.

Existing loose content under `.archive/_archived_skills/` remains frozen. It is already outside active workflows and is
not repackaged by this project.

## Validation

Each archive batch must pass focused checks before commit. Final verification requires:

```bash
npm run validate:all
npm run format:check
npm run lint:md
npm run lint:links
npm run lint:site-links
npm run lint:deprecated-refs
npm run lint:orphaned-content
npm run lint:docs-freshness
npm run lint:skill-references
npm run validate:no-hardcoded-counts
git diff --check
sha256sum -c .archive/redundant-content/CHECKSUMS.sha256
```

An inventory reconciliation check must also prove that every approved source is absent from active paths and appears in
exactly one archive.

## Rollback

- Before removal, restore from the active working-tree version or baseline commit.
- After archival, verify the checksum and extract the relevant repository-relative member from its tarball.
- For complete provenance, use `git show <source_commit>:<source_path>`.
- Revert one dependency-closed archive commit at a time; do not partially restore a batch.

## Approval Gate

**Decision**: Approved for ARC-001 through ARC-007

The user delegated autonomous execution while unavailable. GitHub Copilot approved the documented candidates on
2026-08-27 without attributing the review decision to the user. Retain decisions remain unchanged.

Approval authorizes only entries whose inventory verdict changes from `proposed` to `approved`. Entries marked `retain`
or `defer` remain untouched. Any new candidate requires an inventory revision and renewed approval before archival.

## Completion

All approved candidates were implemented on 2026-08-27. Both deterministic archives pass checksum and byte-for-byte
rebuild verification. Active dependency searches are clean, retained tests pass, orphaned skill-reference warnings are
resolved, and the architecture explorer was regenerated through its owning command.
