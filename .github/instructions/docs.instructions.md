---
description: "Standards for user-facing documentation in the docs/ folder"
applyTo: "docs/**/*.md"
---

# Documentation Standards

Instructions for creating and maintaining user-facing documentation in the `docs/` folder.

## Structure Requirements

### File Header

Every doc file must start with:

```markdown
# {Title}

> [Current Version](../VERSION.md) | {One-line description}
```

### Single H1 Rule

Each file has exactly ONE H1 heading (the title). Use H2+ for all other sections.

### Link Style

- Use relative links for internal docs: `[Quickstart](quickstart.md)`
- Use reference-style links for external URLs
- No broken links (validated in CI)

## Current Architecture (as of 2026-02-03)

### Agents (8 total)

| Agent | Purpose |
|-------|---------|
| `infraops-conductor` | Master orchestrator with approval gates |
| `requirements` | Gather infrastructure requirements |
| `architect` | WAF assessment and architecture design |
| `design` | Architecture diagrams and ADRs |
| `bicep-plan` | Implementation planning and governance |
| `bicep-code` | Bicep template generation |
| `deploy` | Azure deployment execution |
| `diagnose` | Post-deployment health diagnostics |

### Skills (8 total)

| Skill | Category | Purpose |
|-------|----------|---------|
| `azure-adr` | Document Creation | Architecture Decision Records |
| `azure-artifacts` | Artifact Generation | Template H2s, styling, generation rules |
| `azure-defaults` | Azure Conventions | Regions, naming, AVM, WAF, pricing, tags |
| `azure-diagrams` | Document Creation | Python architecture diagrams |
| `github-operations` | Workflow Automation | GitHub issues, PRs, CLI, Actions, releases |
| `git-commit` | Tool Integration | Commit conventions |
| `docs-writer` | Documentation | Repo-aware docs maintenance |
| `make-skill-template` | Meta | Skill creation helper |

## Prohibited References

Do NOT reference these removed agents/skills:

- ❌ `diagram.agent.md` → Use `azure-diagrams` skill
- ❌ `adr.agent.md` → Use `azure-adr` skill
- ❌ `docs.agent.md` → Use `azure-artifacts` skill
- ❌ `azure-workload-docs` skill → Use `azure-artifacts` skill
- ❌ `azure-deployment-preflight` skill → Merged into deploy agent
- ❌ `orchestration-helper` skill → Deleted (absorbed into conductor)
- ❌ `github-issues` / `github-pull-requests` skills → Use `github-operations`
- ❌ `gh-cli` skill → Merged into `github-operations`
- ❌ `_shared/` directory → Use `azure-defaults` + `azure-artifacts` skills

## Content Principles

| Principle | Application |
|-----------|-------------|
| **DRY** | Single source of truth per topic |
| **Current state** | No historical context in main docs |
| **Action-oriented** | Every section answers "how do I...?" |
| **Minimal** | If it doesn't help users today, remove it |
| **Prompt guide for depth** | Point to `docs/prompt-guide/` for examples |

## Validation

Documentation is validated in CI (warn-only):

- No references to removed agents
- Version numbers match VERSION.md
- No broken internal links
- Markdown lint passes
