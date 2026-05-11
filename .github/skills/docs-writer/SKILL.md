---
name: docs-writer
description: '**WORKFLOW SKILL** — Maintains repository documentation accuracy and freshness across the docs site, agent files, and changelog. WHEN: "update docs", "doc gardening", "staleness check", "changelog entry", "repo explanation", "agent change docs", "skill change docs". USE FOR: post-merge doc updates, agent/skill freshness audits, changelog drafting, README/CONTRIBUTING gardening. DO NOT USE FOR: agent definitions themselves (edit `.agent.md` directly), authoring skill SKILL.md content (out of scope), site theme/build (out of scope).'
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
- `tools/tests/exec-plans/tech-debt-tracker.md` — tech debt inventory
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

## Rules

- **Out of scope, always** — `agent-output/**/*.md` (governed by `azure-artifacts.instructions.md`), `.github/agents/*.agent.md` (governed by `agent-authoring.instructions.md`), `**/*.bicep` (governed by `iac-bicep-best-practices.instructions.md`), `azure-artifacts/templates/` (read-only)
- **Single H1 rule** — the title is the only H1; everything else is H2 or deeper
- **120-char line limit** — CI enforces this on docs and instruction files
- **Version source of truth** is `VERSION.md`; never hard-code version numbers in prose
- **No hard-coded counts** — use descriptive language for entity counts (per `no-hardcoded-counts.instructions.md`); `count-manifest.json` is the source of truth
- **Verify links** — all relative links must resolve to existing files; run `npm run lint:links` before committing
- **Run validators** — `npm run lint:md` for style, `npm run lint:links` for link integrity
- **Match adjacent patterns** when adding entries to existing tables (column format, emoji, description style)

## Step-by-Step Workflows

The skill exposes seven workflows. Full per-step procedure for all seven lives in
[`references/extended-workflows.md`](references/extended-workflows.md); the SKILL.md keeps a
one-line summary so the agent knows which one to load.

|   # | Workflow                          | Trigger                             | Reference                                                                                                                   |
| --: | --------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
|   1 | Update Existing Documentation     | "Update the docs for X"             | [`extended-workflows.md`](references/extended-workflows.md)                                                                 |
|   2 | Add Documentation for New Entity  | New agent/skill added to the repo   | [`extended-workflows.md`](references/extended-workflows.md)                                                                 |
|   3 | Freshness Audit (Staleness Check) | "Audit docs for staleness"          | [`freshness-checklist.md`](references/freshness-checklist.md) + [`extended-workflows.md`](references/extended-workflows.md) |
|   4 | Explain the Repo Architecture     | "How do agents connect to skills?"  | [`repo-architecture.md`](references/repo-architecture.md) + [`extended-workflows.md`](references/extended-workflows.md)     |
|   5 | Generate Changelog Entry          | Pre-release / `chore: changelog`    | [`extended-workflows.md`](references/extended-workflows.md)                                                                 |
|   6 | Proofread Documentation           | "Proofread docs/X.md"               | [`extended-workflows.md`](references/extended-workflows.md)                                                                 |
|   7 | Process Freshness Issues          | `docs-freshness` GitHub issue label | [`extended-workflows.md`](references/extended-workflows.md)                                                                 |

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
