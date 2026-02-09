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

| File | What to look for |
| --- | --- |
| `docs/*.md` | `> Version X.Y.Z` in header line |
| `.github/instructions/docs.instructions.md` | Version in header template example |
| `scenarios/README.md` | Any version reference |

**Auto-fix**: Replace old version string with current from `VERSION.md`.

### 2. Agent Count and Table

**Source of truth**: List `.github/agents/*.agent.md` files
(exclude `_subagents/` directory).

**Expected count** (as of 2026-02-09): **8 agents**

**Files to check**:

| File | What to verify |
| --- | --- |
| `docs/README.md` | `## Agents (N + 3 Subagents)` heading and table rows |
| `.github/instructions/docs.instructions.md` | `### Agents (N total)` and table |
| `docs/README.md` project structure | `# N agent definitions` comment |

**Auto-fix**: Update count in heading. Add missing agents to table
matching the existing column format. Remove entries for agents that
no longer exist.

### 3. Skill Count and Table

**Source of truth**: List `.github/skills/*/` directories
(exclude `README.md` file).

**Expected count** (as of 2026-02-09): **11 skills**

**Files to check**:

| File | What to verify |
| --- | --- |
| `docs/README.md` | `## Skills (N)` heading and table rows |
| `.github/instructions/docs.instructions.md` | `### Skills (N total)` and table |
| `docs/README.md` project structure | `# N skill definitions` comment |

**Auto-fix**: Update count in heading. Add missing skills to the
appropriate category table. Remove entries for deleted skills.

### 4. Scenario Index

**Source of truth**: List `scenarios/S*/` directories.

**Expected count** (as of 2026-02-09): **9 scenarios** (S01–S09)

**Files to check**:

| File | What to verify |
| --- | --- |
| `scenarios/README.md` | Table lists all S* folders |
| `docs/README.md` | Scenario table lists all S* folders |

**Auto-fix**: Add missing scenarios to tables. Flag scenarios in
tables that no longer have folders.

### 5. Prohibited References

**Rule**: Removed agents must not be referenced in live docs.

**Banned patterns**:

- `diagram.agent.md`
- `adr.agent.md`
- `docs.agent.md`
- `docs/guides/`
- `docs/reference/`
- `docs/getting-started.md`

**Files to check**: All `docs/**/*.md`, `README.md`, `CONTRIBUTING.md`.

**Auto-fix**: Replace with the correct skill reference
(see `references/doc-standards.md` → Prohibited References table).

### 6. Deprecated Path Links

**Rule**: No live doc should link to removed directories.

**Check**: Grep all in-scope markdown files for links to non-existent paths.

**Auto-fix**: Remove the link or replace with the current equivalent.

### 7. Instruction File Table Sync

**Source of truth**: List `.github/instructions/*.instructions.md` files.

**Expected count** (as of 2026-02-09): **16 instruction files**

**Files to check**: Only relevant if `docs/README.md` or the root
`README.md` lists instruction files.

**Auto-fix**: Update count and table entries.

### 8. Template Inventory Sync

**Source of truth**: List `.github/skills/azure-artifacts/templates/*.template.md` files.

**Expected count** (as of 2026-02-09): **16 templates**

**Files to check**: Only relevant if documentation references
template counts.

**Auto-fix**: Update count reference.

## Summary Table Template

When reporting audit results, use this format:

```markdown
| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| 1 | docs/README.md | 42 | Agent count says 6, actual is 8 | Update heading |
| 2 | docs.instructions.md | 34 | Missing `design` and `conductor` agents | Add table rows |
```

## Known Issues

No known issues. Last audit: 2026-02-09.

All 21 discrepancies identified during the initial audit have been
resolved (Tasks A–D). Fixes included:

- Version headers migrated to `[Current Version](../VERSION.md)` links
- Agent counts corrected to 8, skill counts to 11, scenario counts to 9
- Conductor model corrected to Claude Opus 4.6, approval gates to 5
- MCP path fixed, broken link removed, S09 added to scenario table
- Glossary cross-references fixed, keyboard shortcut corrected, new terms added
