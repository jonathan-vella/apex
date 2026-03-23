<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# docs-writer (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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
- `tests/exec-plans/tech-debt-tracker.md` — tech debt inventory
- `README.md` — repo root README
- `CONTRIBUTING.md` — contribution guidelines
- `CHANGELOG.md` — release history
- `QUALITY_SCORE.md` — project health grades
- `.github/instructions/docs.instructions.md` — site docs standards

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

| Reference                           | When to Load                          |
| ----------------------------------- | ------------------------------------- |
| `references/doc-standards.md`       | When checking documentation standards |
| `references/freshness-checklist.md` | When running freshness audits         |
| `references/repo-architecture.md`   | When analyzing repo structure         |
