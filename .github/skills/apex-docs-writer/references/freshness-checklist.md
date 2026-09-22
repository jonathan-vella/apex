<!-- ref:freshness-checklist-v1 -->

# Freshness Checklist

> For use by the `apex-docs-writer` skill. Defines audit targets and auto-fix
> rules for detecting stale documentation.

## How to Run a Freshness Audit

1. Read `VERSION.md` to get the canonical version number.
2. Walk through each audit target below.
3. For each issue found, note: file path, line, issue, suggested fix.
4. Present all issues in a summary table.
5. Apply only authorized fixes. Gardening findings and peer review are report-only;
	Astro review's `--apply-fixes` permits only its documented allow-list.

## Audit Targets

### 1. Version Number Sync

**Source of truth**: `VERSION.md` → `Current Version: X.Y.Z`

**Files to check**:

| File                                        | What to look for                   |
| ------------------------------------------- | ---------------------------------- |
| `site/src/content/docs/**/*.{md,mdx}` | Version claims; no repository-style version banner |
| `README.md` | Version claims or links to the canonical version source |

**Auto-fix**: Replace old version string with current from `VERSION.md`.

### 2. Agent Count and Table

**Source of truth**: List `.github/agents/*.agent.md` files
(exclude `_subagents/` directory).

**Expected count**: computed dynamically from `tools/registry/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**:

| File                                        | What to verify                   |
| ------------------------------------------- | -------------------------------- |
| `site/src/content/docs/concepts/how-it-works/agents.md` | Names and roles match agent frontmatter |

**Authorized fix**: Add missing agents and remove deleted entries. Use descriptive
headings and the count manifest, not numeric entity counts in prose.

### 3. Skill Count and Table

**Source of truth**: List `.github/skills/*/` directories
(exclude `README.md` file).

**Expected count**: computed dynamically from `tools/registry/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**:

| File                                        | What to verify                   |
| ------------------------------------------- | -------------------------------- |
| `.github/skills/README.md` | Current ownership and invocation guidance |
| `site/src/content/docs/reference/prompts/skills-subagents.md` | Current names and procedures |
| `site/src/content/docs/concepts/how-it-works/skills-and-instructions.md` | Domains and harness boundaries |

**Authorized fix**: Update representative catalog entries and links without hard-coded
counts. Preserve canonical names, invocation flags, and source model assignments.

### 4. Prompt Guide Currency

**Source of truth**: Local adapters under `.github/prompts/` and `tools/apex-prompts/`,
plus the owning `.github/skills/*/SKILL.md` and referenced procedures.

**Files to check**:

| File                                             | What to verify                          |
| ------------------------------------------------ | --------------------------------------- |
| `site/src/content/docs/reference/prompts/*.md` | Agent and skill tables match filesystem |

**Authorized fix**: Update tables to match current agent/skill inventory. Keep Local
adapters distinct from manual Host entries. Host recovery uses an explicit `resume`
operation in `apex-host-workflow-start`; skill loading does not change the caller's
model/tools or bypass reviews and approvals. Static checks do not prove runtime support.

### 5. Prohibited References

**Rule**: Removed agents must not be referenced in live docs.

**Banned patterns**:

- `diagram.agent.md`
- `adr.agent.md`
- `docs.agent.md`
- `docs/guides/`
- `docs/reference/`
- `docs/getting-started.md`

**Files to check**: All `site/src/content/docs/**/*.md`, `README.md`, `CONTRIBUTING.md`.

**Auto-fix**: Replace with the correct skill reference
(see `references/doc-standards.md` → Prohibited References table).

### 6. Deprecated Path Links

**Rule**: No live doc should link to removed directories.

**Check**: Grep all in-scope markdown files for links to non-existent paths.

**Auto-fix**: Remove the link or replace with the current equivalent.

### 7. Instruction File Table Sync

**Source of truth**: List `.github/instructions/*.instructions.md` files.

**Expected count**: computed dynamically from `tools/registry/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**: The published skills-and-instructions page and
`references/repo-architecture.md`; inspect exact `applyTo` values in source.

**Auto-fix**: Update table entries.

### 8. Template Inventory Sync

**Source of truth**: List `.github/skills/apex-azure-artifacts/templates/*.template.md` files.

**Expected count**: computed dynamically from `tools/registry/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**: Only relevant if documentation references
template counts.

**Auto-fix**: Update count reference.

### 9. Project Health Files

**Source of truth**: Filesystem agent/skill counts + CI validation results.

**Files to check**:

| File                                          | What to verify                                      |
| --------------------------------------------- | --------------------------------------------------- |
| `QUALITY_SCORE.md`                            | Grades reflect current state; change log up to date |
| `tools/tests/exec-plans/tech-debt-tracker.md` | Active items still relevant; resolved items moved   |

**Auto-fix**: Update grades and log entries in `QUALITY_SCORE.md`. Mark resolved debt items
as resolved with the current date.

## Summary Table Template

When reporting audit results, use this format:

```markdown
| #   | File                 | Line | Issue                                      | Fix            |
| --- | -------------------- | ---- | ------------------------------------------ | -------------- |
| 1   | docs.instructions.md | 34   | Missing `design` and `orchestrator` agents | Add table rows |
```

## Reference Ownership Checks

For a moved procedure, verify the owning skill's Reference Index, Local adapter,
relative links (including reference-style links), canary marker, and Git ignore status.
Docs maintenance belongs here; authoring assessments belong to `apex-agent-authoring`.
Keep log/runtime references in `apex-context-management` and workflow entry in `apex-workflow-engine`.
Preserve reference-only history and review/fix permissions when updating links.

Use `node --test tools/tests/scripts/test_skill_ownership.mjs` for the ownership regressions.
Regenerate the Explorer graph after source metadata or inventory changes; its schema
is independent of artifact schemas. Record actual check results, not inherited audit claims.
