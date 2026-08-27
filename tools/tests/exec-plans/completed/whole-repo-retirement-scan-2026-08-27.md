# Whole-Repository Retirement Scan

> Evidence-backed census of tracked repository content before any retirement or archival decision.

## Status

**State**: Completed
**Branch**: `chore/whole-repo-retirement-scan-2026-08-27`
**Baseline commit**: `b87b57f719520049d6bcf2f00bc3d9431c1002a7`
**Parent PR**: `#671` (merged)
**Created**: 2026-08-27
**Owner**: Jonathan Vella

The cleanup dependency merged through PR `#671`, and this branch was rebased onto its durable squash commit. The scan
may nominate retirement candidates, but it cannot approve, move, remove, consolidate, or archive them.

## Objective

Classify every tracked repository file exactly once using reproducible evidence. Identify content that may be retired,
consolidated, or archived without mistaking dynamic discovery, generated ownership, compatibility contracts, test
fixtures, published assets, or canonical sources of truth for unused content.

## Fixed Decisions

- The canonical census input is `git ls-files -s -z` at the recorded baseline commit.
- Every tracked path receives one status: `protected`, `retain`, `candidate`, or `defer`.
- Age is supporting evidence only and never sufficient for retirement.
- Automated checks may nominate candidates but cannot approve retirement.
- Existing archives are verified and indexed, not recursively repackaged.
- Explicit human approval is required before creating new archive payloads or changing candidate source paths.
- The scanner is read-only with respect to existing repository content; it writes only its declared reports.

## Scope

Included:

- Every path returned by `git ls-files`.
- Runtime and discovery metadata needed to interpret those paths.
- Agents, prompts, skills, instructions, workflows, actions, hooks, schemas, registries, scripts, tests, and fixtures.
- Site source, documentation, public assets, downloads, generated files, infrastructure, reports, and archive metadata.

Excluded from the tracked-file census:

- `.git` internals.
- Untracked dependencies, virtual environments, caches, and build output.
- Ignored operational data, which may be reported separately as workspace hygiene.
- Git-history rewriting or sensitive-data purging.

## Evidence Model

Each file record captures:

- Identity: path, Git mode, blob SHA, byte size, content type, and domain.
- Reachability: direct references, runtime callers, dynamic entrypoints, package scripts, workflows, tests, and routes.
- Ownership: CODEOWNERS, generator, canonical inputs, regeneration command, and existing archive membership.
- Duplication: exact duplicate group, normalized-text similarity candidates, functional overlap, and unique content.
- History: first and last commits, last-change date, and age in days.
- Governance: security and legal flags, review state, rationale, replacement, dependency updates, and validation checks.

A `candidate` requires at least two independent evidence layers unless it is byte-identical to a proven canonical owner.
Missing replacement, dependency, review, or validation evidence downgrades a proposed candidate to `defer`.

## Protected Categories

These categories cannot become candidates from reference counts alone:

- Auto-discovered agents, prompts, skills, and instructions.
- Dynamically loaded schemas and versioned contracts.
- Fixtures, mocks, and test-runner glob inputs.
- Registries, workflow graphs, and generated sources of truth.
- CI, package, hook, and human CLI entrypoints.
- Published routes, downloadable assets, and compatibility aliases.
- Audit sidecars and existing frozen archive payloads.

Each protected file must record the discovery, runtime, publication, generator, or source-of-truth mechanism that
protects it.

## Deliverables

| Path                                            | Purpose                                                |
| ----------------------------------------------- | ------------------------------------------------------ |
| `tools/schemas/retirement-scan.schema.json`     | Machine-readable inventory contract                    |
| `tools/scripts/audit-retirement-candidates.mjs` | Read-only census and evidence generator                |
| `tools/tests/`                                  | Scanner, schema, determinism, and reconciliation tests |
| `.archive/retirement-scan-2026-08-27.json`      | Complete per-file inventory                            |
| `.archive/retirement-scan-2026-08-27.md`        | Generated human review report                          |

The JSON inventory is authoritative. Summary counts in Markdown are generated from it and must not be maintained by
hand.

## Scan Phases

### Phase 1: Census and Metadata

1. Read tracked entries from `git ls-files -s -z`.
2. Assign stable IDs derived from repository-relative paths.
3. Record Git mode, blob SHA, size, content type, domain, and history.
4. Prove inventory paths equal tracked paths with no omissions or duplicates.

### Phase 2: Reachability and Ownership

1. Expand package scripts and aggregate runners.
2. Map GitHub Actions, reusable actions, hooks, and direct CLI entrypoints.
3. Map agent, prompt, skill, and instruction discovery.
4. Map schemas, tests, fixtures, generators, routes, assets, and downloads.
5. Verify archive checksums, members, indexes, and manifests.

### Phase 3: Duplication and Retirement Evidence

1. Group exact duplicates by blob SHA or SHA-256.
2. Generate normalized-text similarity candidates without auto-retiring them.
3. Find explicit deprecated, obsolete, superseded, historical-only, and dead-path markers.
4. Review functional overlap and unique content manually.
5. Flag legal, licensing, secret, customer-data, and provenance blockers.

### Phase 4: Classification and Report

1. Classify every tracked file as `protected`, `retain`, `candidate`, or `defer`.
2. Require complete retirement metadata for candidates.
3. Generate domain, evidence, risk, byte, age, duplicate, and archive-group summaries.
4. Commit the complete inventory and report without changing candidate source paths.

## Domain Review

Independent reviews may run in parallel for:

- Agents, prompts, skills, and instructions.
- Workflows, actions, hooks, devcontainer, and repository configuration.
- Tooling, libraries, schemas, registries, tests, fixtures, and prompts.
- Site content, source, assets, downloads, demos, and generated data.
- Infrastructure, agent output, root documentation, logs, reports, and top-level files.
- Existing archive indexes, manifests, loose snapshots, tarballs, and checksums.

All reviews write evidence into the same per-file contract. Directory-level conclusions are insufficient when member
files have different consumers or ownership.

## Scanner Safety

The scanner must:

- Use structured Git and JSON parsing rather than shell text splitting.
- Support spaces, executable modes, symlinks, and submodule entries.
- Avoid reading ignored or untracked dependency trees.
- Avoid printing or embedding file contents that may contain secrets.
- Write only the two declared scan reports when `--write` is supplied.
- Support a check mode that validates an existing inventory without rewriting it.
- Produce deterministic semantic output for the same baseline commit.

## Tests

Focused tests must cover:

- Schema validation and required candidate evidence.
- Complete, unique tracked-path coverage.
- Paths containing spaces and unusual Git modes.
- Stable IDs and deterministic semantic output.
- Exact duplicate grouping without automatic retirement.
- Dynamic-entrypoint and protected-category handling.
- Generated ownership and route/download publication.
- Existing archive checksum and member reconciliation.
- Read-only behavior outside declared report paths.

The scanner test script must be wired into CI and `validate:all` before the inventory is accepted.

## Baseline Checks

Before generating the inventory, record results for:

```bash
bash tools/scripts/validate-branch-naming.sh
bash tools/scripts/validate-branch-scope.sh
npm run audit:quarterly
npm run validate:all
npm run format:check
npm run lint:md
npm run lint:links
npm run lint:site-links
sha256sum -c .archive/redundant-content/CHECKSUMS.sha256
git status --short
```

Warnings are evidence requiring review, not automatic retirement decisions.

## Approval Gates

### Gate 1: Documentation

This plan must be committed before scanner implementation.

### Gate 2: Inventory Completeness

The schema, scanner, tests, complete JSON inventory, generated report, and updated plan are committed together. This
commit must contain no archive payloads, source removals, candidate consolidations, or consumer migrations.

### Gate 3: Adversarial Review

Every `candidate` and `defer` finding is challenged for hidden dynamic consumers, distinct audiences, compatibility
promises, unique content, restoration completeness, and legal or security concerns.

### Gate 4: Human Approval

A named human records `approve`, `retain`, or `defer` for every candidate. Delegated or automated approval is not
permitted. Implementation stops here until approval is recorded.

### Gate 5: Archive Execution

Only approved candidates enter dependency-closed archive batches. Archive creation, consolidation, consumer updates,
source removal, and final reconciliation are separate from the scan itself.

## Archive Execution Contract

If candidates are approved later:

1. Group them by coherent restore unit, not extension.
2. Create deterministic dated tarballs with sorted members, fixed ownership, and fixed UTC modification time.
3. Record source commit, complete member list, SHA-256, byte size, and restoration instructions.
4. Rebuild each tarball independently and require byte equality.
5. Verify the archive before consolidating or removing active sources.
6. Update all consumers and run focused validation before committing each serial batch.
7. Keep active content independent from `.archive` payloads.

## Validation

The audit deliverable is complete only when:

```bash
npm run validate:all
npm run audit:quarterly
npm run format:check
npm run lint:md
npm run lint:links
npm run lint:site-links
git diff --check
```

Additional invariants:

- Sorted tracked paths and sorted inventory paths are byte-identical.
- Every path appears once and only once.
- The inventory validates against `retirement-scan.schema.json`.
- Stable fields are identical across repeated scans of the same commit.
- Every candidate has required evidence, replacement, dependencies, checks, risk, and review state.
- Existing archives pass checksum and member reconciliation.
- No candidate source is moved, removed, or rewritten before human approval.

## Rollback

The scan adds tooling and reports but does not alter candidate content. Revert the scan commits to remove the audit
framework. Any later archive execution must remain independently revertible by dependency-closed batch.

## Completion Criteria

- The documentation checkpoint is committed before implementation.
- Every tracked file is represented exactly once in the validated inventory.
- All candidate and defer findings complete adversarial review.
- The report clearly separates protected, retained, candidate, and deferred content.
- Retirement actions require explicit human approval.

## Scan Result

The baseline census classified every tracked file exactly once. Automated and adversarial review found no
retirement-ready files. Exact duplicates remain in the human review queue: archive-only duplicates are recommended for
retention, while active cross-skill reference duplicates are deferred pending a policy decision on whether portable
skills may depend on shared references outside their own folders.

On 2026-08-27, Jonathan Vella approved consolidation of every active duplicate group and accepted the cross-skill
portability trade-off. Frozen archive-only duplicate groups remain retained.

The approved copies were archived and removed after their consumers were migrated to canonical skill owners. Archive
checksums, source commit, complete member list, and canonical ownership are recorded in the JSON inventory.
