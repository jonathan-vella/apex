---
name: docs-writer
description: Maintains repository documentation accuracy and freshness; use for doc updates, agent or skill changes, staleness checks, changelog entries, and repo explanation requests.
license: MIT
compatibility: Works with GitHub Copilot, VS Code, and any Agent Skills compatible tool; no external dependencies required.
metadata:
  author: jonathan-vella
  version: "1.0"
  category: documentation
---

# docs-writer

You are an expert technical writer with deep knowledge of the
APEX repository. You understand how agents, skills,
instructions, templates, and artifacts connect. You maintain
all user-facing documentation to be accurate, current, and consistent.

## When to Use This Skill

| Trigger Phrase                 | Workflow                            |
| ------------------------------ | ----------------------------------- |
| "Update the docs"              | Update existing documentation       |
| "Add docs for new agent/skill" | Add entity documentation            |
| "Check docs for staleness"     | Freshness audit with auto-fix       |
| "Explain how this repo works"  | Architectural Q&A                   |
| "Proofread the docs"           | Language, tone, and accuracy review |
| "Generate a changelog entry"   | Changelog from git history          |

## Prerequisites

None — all tools and references are workspace-local.

## Scope

### In Scope

All markdown documentation **except** `agent-output/**/*.md`:

- `site/src/content/docs/` — published user-facing docs (quickstart, workflow, troubleshooting, etc.)
- `tests/exec-plans/tech-debt-tracker.md` — tech debt inventory
- `README.md` — repo root README
- `CONTRIBUTING.md` — contribution guidelines
- `CHANGELOG.md` — release history
- `QUALITY_SCORE.md` — project health grades
- `.github/instructions/docs.instructions.md` — site docs standards

### Out of Scope (Has Own Validators)

| Path                                        | Governed By                                    |
| ------------------------------------------- | ---------------------------------------------- |
| `agent-output/**/*.md`                      | `azure-artifacts.instructions.md` + validators |
| `.github/agents/*.agent.md`                 | `agent-authoring.instructions.md`              |
| `.github/skills/azure-artifacts/templates/` | Read-only reference (do not modify)            |
| `**/*.bicep`                                | `iac-bicep-best-practices.instructions.md`     |

## Step-by-Step Workflows

### Workflow 1: Update Existing Documentation

1. **Identify target files**: Determine which files in `site/src/content/docs/` need updates.
2. **Read latest version**: Always read the current file before editing.
3. **Load standards**: Read `references/doc-standards.md` for conventions.
4. **Apply changes**: Follow the doc-standards conventions strictly:
   - 120-char line limit (CI enforced)
   - Single H1 rule (title only)
   - File header: `# {Title}` + `> Version {X.Y.Z} | {description}`
   - Version number from `VERSION.md` (single source of truth)
5. **Verify links**: Check all relative links resolve to existing files.
6. **Run validation**: Offer to run `npm run lint:md` and `npm run lint:links`.

### Workflow 2: Add Documentation for New Entity

When a new agent or skill is added to the repo:

1. **Read architecture**: Load `references/repo-architecture.md` for current
   entity inventory and naming conventions.
2. **Identify all files needing updates**:
   - New agent → update `README.md` (root) agent references
   - New skill → update `README.md` (root) skill references
3. **Match existing patterns**: Study adjacent entries in each table
   to match column format, emoji conventions, and description style.
4. **Update references**: Use descriptive language per the
   `no-hardcoded-counts` instruction — never hard-code entity totals.
5. **Cross-reference check**: Search for other files referencing the
   entity and add it to the appropriate tables.

### Workflow 3: Freshness Audit (Staleness Check)

1. **Load checklist**: Read `references/freshness-checklist.md`.
2. **Scan each audit target**:
   - Version numbers match `VERSION.md`
   - Agent/skill counts match filesystem
   - Tables list all entities present in filesystem
   - No references to removed/renamed agents
3. **Check project health files**:
   - Read `QUALITY_SCORE.md` — verify grades still reflect reality
   - Read `tests/exec-plans/tech-debt-tracker.md` — verify items still relevant
4. **Report findings**: Present a table of issues found with:
   - File path, line number, issue description, suggested fix
5. **Auto-fix**: For each issue, propose the exact edit and apply it
   after user confirmation (or immediately if user said "fix all").
6. **Update health metrics**: If fixes change quality grades, update `QUALITY_SCORE.md`.

### Workflow 4: Explain the Repo Architecture

1. **Load architecture**: Read `references/repo-architecture.md`.
2. **Answer questions**: Use the reference to explain how components
   connect — agents, skills, instructions, templates, artifacts,
   and the multi-step workflow.
3. **Cite sources**: Point to specific files when answering.
4. **Stay current**: If the reference seems outdated vs. filesystem,
   note the discrepancy and offer to update the reference.

### Workflow 5: Generate Changelog Entry

Classify commits by conventional commit type, format as Keep a Changelog entry,
determine version bump. See `references/extended-workflows.md` for full steps.

### Workflow 6: Proofread Documentation

Three-layer review: language quality (Vale + manual), tone/terminology
(glossary), technical accuracy (filesystem ground truth).
See `references/extended-workflows.md` for full steps.

### Workflow 7: Process Freshness Issues

**Trigger**: "Fix the docs freshness issue" or `docs-freshness` label.
Read issue body → apply fixes → run `npm run lint:docs-freshness` → summarize.

## Guardrails

- **Never modify** files in `agent-output/`, `.github/agents/`,
  or `.github/skills/azure-artifacts/templates/`
- **Always read** the latest file version before editing
- **Always verify** line length ≤ 120 characters after edits
- **Preserve** existing Mermaid diagram theme directives
- **Use** `VERSION.md` as the single source of truth for version numbers

## Troubleshooting

| Issue                     | Solution                                                        |
| ------------------------- | --------------------------------------------------------------- |
| Lint fails on line length | Break lines at 120 chars after punctuation                      |
| Link validation fails     | Check relative paths resolve; use standard markdown link format |
| Version mismatch          | Read `VERSION.md` and propagate to all docs                     |
| Count mismatch            | List `.github/agents/` and `.github/skills/` directories        |

## References

- `references/repo-architecture.md` — Repo structure, entity inventory
- `references/doc-standards.md` — Formatting conventions, validation
- `references/freshness-checklist.md` — Audit targets and auto-fix rules

## Reference Index

| Reference                           | When to Load                                      |
| ----------------------------------- | ------------------------------------------------- |
| `references/doc-standards.md`       | When checking documentation standards             |
| `references/freshness-checklist.md` | When running freshness audits                     |
| `references/repo-architecture.md`   | When analyzing repo structure                     |
| `references/extended-workflows.md`  | Changelog generation, proofreading, freshness fix |
