<!-- ref:freshness-checklist-v1 -->

# Freshness Checklist

> For use by the `docs-writer` skill. Defines audit targets and auto-fix
> rules for detecting stale documentation.

## How to Run a Freshness Audit

1. Read `VERSION.md` to get the canonical version number.
2. Walk through each audit target below.
3. For each issue found, note: file path, line, issue, suggested fix.
4. Present all issues in a summary table.
5. Apply fixes after user confirmation (or immediately if told "fix all").

## Audit Targets

### 1. Version Number Sync

**Source of truth**: `VERSION.md` → `Current Version: X.Y.Z`

**Files to check**:

| File                                        | What to look for                   |
| ------------------------------------------- | ---------------------------------- |
| `docs/*.md`                                 | `> Version X.Y.Z` in header line   |
| `.github/instructions/docs.instructions.md` | Version in header template example |

**Auto-fix**: Replace old version string with current from `VERSION.md`.

### 2. Agent Count and Table

**Source of truth**: List `.github/agents/*.agent.md` files
(exclude `_subagents/` directory).

**Expected count**: computed dynamically from `.github/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**:

| File                                        | What to verify                   |
| ------------------------------------------- | -------------------------------- |
| `.github/instructions/docs.instructions.md` | `### Agents (N total)` and table |

**Auto-fix**: Update count in heading. Add missing agents to table
matching the existing column format. Remove entries for agents that
no longer exist.

### 3. Skill Count and Table

**Source of truth**: List `.github/skills/*/` directories
(exclude `README.md` file).

**Expected count**: computed dynamically from `.github/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**:

| File                                        | What to verify                   |
| ------------------------------------------- | -------------------------------- |
| `.github/instructions/docs.instructions.md` | `### Skills (N total)` and table |

**Auto-fix**: Update count in heading. Add missing skills to the
appropriate category table. Remove entries for deleted skills.

### 4. Prompt Guide Currency

**Source of truth**: `site/src/content/docs/guides/prompt-guide/` pages.

**Files to check**:

| File                                             | What to verify                          |
| ------------------------------------------------ | --------------------------------------- |
| `site/src/content/docs/guides/prompt-guide/*.md` | Agent and skill tables match filesystem |

**Auto-fix**: Update tables to match current agent/skill inventory.

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

**Expected count** (as of 2026-02-26): computed dynamically from `.github/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**: Only relevant if the root
`README.md` lists instruction files.

**Auto-fix**: Update table entries.

### 8. Template Inventory Sync

**Source of truth**: List `.github/skills/azure-artifacts/templates/*.template.md` files.

**Expected count** (as of 2026-02-09): computed dynamically from `.github/count-manifest.json`
(run `validate:no-hardcoded-counts` to verify)

**Files to check**: Only relevant if documentation references
template counts.

**Auto-fix**: Update count reference.

### 9. Project Health Files

**Source of truth**: Filesystem agent/skill counts + CI validation results.

**Files to check**:

| File                                    | What to verify                                      |
| --------------------------------------- | --------------------------------------------------- |
| `QUALITY_SCORE.md`                      | Grades reflect current state; change log up to date |
| `tests/exec-plans/tech-debt-tracker.md` | Active items still relevant; resolved items moved   |

**Auto-fix**: Update grades and log entries in `QUALITY_SCORE.md`. Mark resolved debt items
as resolved with the current date.

## Summary Table Template

When reporting audit results, use this format:

```markdown
| #   | File                 | Line | Issue                                      | Fix            |
| --- | -------------------- | ---- | ------------------------------------------ | -------------- |
| 1   | docs.instructions.md | 34   | Missing `design` and `orchestrator` agents | Add table rows |
```

## Known Issues

No known issues. Last audit: 2026-03-23.

All 21 discrepancies identified during the initial audit have been
resolved (Tasks A–D). Fixes included:

- Version headers migrated to `[Current Version](../VERSION.md)` links
- Agent counts corrected to 8, skill counts to 8
- Orchestrator model corrected to Claude Opus 4.6, approval gates to 5
- MCP path fixed, broken link removed
- Glossary cross-references fixed, keyboard shortcut corrected, new terms added
- Scenarios directory removed; replaced by prompt-guide section in published site
