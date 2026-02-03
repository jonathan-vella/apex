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

> Version 8.0.0 | {One-line description}
```

### Single H1 Rule

Each file has exactly ONE H1 heading (the title). Use H2+ for all other sections.

### Link Style

- Use relative links for internal docs: `[Quickstart](quickstart.md)`
- Use reference-style links for external URLs
- No broken links (validated in CI)

## Current Architecture (as of 2026-02-03)

### Agents (6 total)

| Agent | Purpose |
|-------|---------|
| `requirements` | Gather infrastructure requirements |
| `architect` | WAF assessment and architecture design |
| `bicep-plan` | Implementation planning and governance |
| `bicep-code` | Bicep template generation |
| `deploy` | Azure deployment execution |
| `diagnose` | Post-deployment health diagnostics |

### Skills (10 total)

| Skill | Category | Purpose |
|-------|----------|---------|
| `azure-adr` | Document Creation | Architecture Decision Records |
| `azure-diagrams` | Document Creation | Python architecture diagrams |
| `azure-workload-docs` | Workflow Automation | 7 documentation types |
| `azure-deployment-preflight` | Workflow Automation | Pre-deployment validation |
| `github-issues` | Workflow Automation | Issue management |
| `github-pull-requests` | Workflow Automation | PR management |
| `gh-cli` | Tool Integration | GitHub CLI reference |
| `git-commit` | Tool Integration | Commit conventions |
| `make-skill-template` | Meta | Skill creation helper |

## Prohibited References

Do NOT reference these removed agents (they are now skills):

- ❌ `diagram.agent.md` → Use `azure-diagrams` skill
- ❌ `adr.agent.md` → Use `azure-adr` skill
- ❌ `docs.agent.md` → Use `azure-workload-docs` skill

## Content Principles

| Principle | Application |
|-----------|-------------|
| **DRY** | Single source of truth per topic |
| **Current state** | No historical context in main docs |
| **Action-oriented** | Every section answers "how do I...?" |
| **Minimal** | If it doesn't help users today, remove it |
| **Scenarios for depth** | Point to `scenarios/` for hands-on |

## Validation

Documentation is validated in CI (warn-only):

- No references to removed agents
- Version numbers match VERSION.md
- No broken internal links
- Markdown lint passes
