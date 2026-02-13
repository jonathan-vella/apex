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
azure-agentic-infraops repository. You understand how agents, skills,
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

- `docs/` — user-facing docs (quickstart, workflow, troubleshooting, etc.)
- `docs/prompt-guide/` — agent & skill prompt examples
- `README.md` — repo root README
- `CONTRIBUTING.md` — contribution guidelines
- `CHANGELOG.md` — release history
- `.github/instructions/docs.instructions.md` — architecture tables

### Out of Scope (Has Own Validators)

| Path                                        | Governed By                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| `agent-output/**/*.md`                      | `artifact-h2-reference.instructions.md` + validators |
| `.github/agents/*.agent.md`                 | `agents-definitions.instructions.md`                 |
| `.github/skills/azure-artifacts/templates/` | Read-only reference (do not modify)                  |
| `**/*.bicep`                                | `bicep-code-best-practices.instructions.md`          |

## Step-by-Step Workflows

### Workflow 1: Update Existing Documentation

1. **Identify target files**: Determine which files in `docs/` need updates.
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
   - New agent → update `docs/README.md` agent tables,
     `.github/instructions/docs.instructions.md` agent count/table
   - New skill → update `docs/README.md` skill tables,
     `.github/instructions/docs.instructions.md` skill count/table
3. **Match existing patterns**: Study adjacent entries in each table
   to match column format, emoji conventions, and description style.
4. **Update counts**: Increment totals in section headings
   (e.g., "## Skills (10)" → "## Skills (11)").
5. **Cross-reference check**: Search for other files mentioning the old
   count and update them too.

### Workflow 3: Freshness Audit (Staleness Check)

1. **Load checklist**: Read `references/freshness-checklist.md`.
2. **Scan each audit target**:
   - Version numbers match `VERSION.md`
   - Agent/skill counts match filesystem
   - Tables list all entities present in filesystem
   - No references to removed/renamed agents
3. **Report findings**: Present a table of issues found with:
   - File path, line number, issue description, suggested fix
4. **Auto-fix**: For each issue, propose the exact edit and apply it
   after user confirmation (or immediately if user said "fix all").

### Workflow 4: Explain the Repo Architecture

1. **Load architecture**: Read `references/repo-architecture.md`.
2. **Answer questions**: Use the reference to explain how components
   connect — agents, skills, instructions, templates, artifacts,
   and the 7-step workflow.
3. **Cite sources**: Point to specific files when answering.
4. **Stay current**: If the reference seems outdated vs. filesystem,
   note the discrepancy and offer to update the reference.

### Workflow 5: Generate Changelog Entry

1. **Find last version tag**: Run `git tag --sort=-v:refname | head -1`.
2. **Get commits since tag**: Run
   `git log --oneline {tag}..HEAD --no-merges`.
3. **Classify by type**: Map conventional commit prefixes to
   Keep a Changelog sections:
   - `feat:` → `### Added`
   - `fix:` → `### Fixed`
   - `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`,
     `ci:`, `chore:` → `### Changed`
   - `feat!:` or `BREAKING CHANGE:` → `### ⚠️ Breaking Changes`
4. **Format entry**: Match the style in `CHANGELOG.md`:

   ```markdown
   ## [{next-version}] - {YYYY-MM-DD}

   ### Added

   - Description of feature ([commit-hash])

   ### Changed

   - Description of change ([commit-hash])

   ### Fixed

   - Description of fix ([commit-hash])
   ```

5. **Determine version bump**:
   - Breaking change → major
   - `feat:` → minor
   - `fix:` only → patch
6. **Present to user**: Show the formatted entry for review before
   inserting into `CHANGELOG.md`.

### Workflow 6: Proofread Documentation

A three-layer review: language quality, tone/terminology, and
technical accuracy.

1. **Select scope**: Ask user which files to review, or default to
   all files in `docs/`.
2. **Layer 1 — Language quality**:
   - Run `npm run lint:prose` (Vale) for automated prose checks.
   - Manually scan for: grammar errors, spelling mistakes, passive
     voice, awkward phrasing, overly long sentences (>30 words).
3. **Layer 2 — Tone and terminology**:
   - Verify consistent terminology against `docs/GLOSSARY.md`.
   - Check tone is active and action-oriented (not academic/passive).
   - Flag jargon not defined in the glossary.
   - Ensure agent/skill names use exact casing from their frontmatter
     (`name:` field) — e.g., "Bicep Code" not "bicep code agent".
4. **Layer 3 — Technical accuracy**:
   - Load `references/repo-architecture.md` for ground truth.
   - Verify agent/skill counts, names, and descriptions match
     the actual filesystem.
   - Confirm workflow step numbers and artifact filenames are correct.
   - Check that capability claims are truthful (e.g., if a doc says
     "supports 8 skills", verify 8 skill folders exist).
   - Cross-check version numbers against `VERSION.md`.
5. **Report findings**: Present a table per file:

   ```markdown
   | #   | Line | Layer       | Issue                      | Suggestion       |
   | --- | ---- | ----------- | -------------------------- | ---------------- |
   | 1   | 12   | Language    | Passive voice              | Rewrite actively |
   | 2   | 34   | Terminology | "IaC tool" not in glossary | Use "Bicep"      |
   | 3   | 56   | Accuracy    | Says 6 agents, actual is 8 | Update count     |
   ```

6. **Apply fixes**: After user review, apply corrections. For
   language/tone fixes, show before/after for each change.
   For accuracy fixes, apply directly (same as freshness audit).

### Workflow 7: Process Freshness Issues

**Trigger**: "Fix the docs freshness issue" or auto-created GitHub
issue with `docs-freshness` label

1. Read the issue body for the findings table
2. For each finding, apply the appropriate fix from the freshness
   checklist
3. Run `npm run lint:docs-freshness` to verify 0 findings remain
4. Summarize changes made

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
