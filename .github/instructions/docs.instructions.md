---
description: "Standards for user-facing documentation in the site/src/content/docs/ folder"
applyTo: "site/src/content/docs/**/*.md, site/src/content/docs/**/*.mdx"
---

# Documentation Standards

Instructions for creating and maintaining user-facing documentation in the `site/src/content/docs/` folder.

## Structure Requirements

### File Header

Every doc file must start with:

```markdown
# {Title}

> [Current Version](../../VERSION.md) | {One-line description}
```

Adjust the relative path depth based on folder nesting (`../../../VERSION.md` from
`site/src/content/docs/`, `../../../../VERSION.md` from a subfolder).

### Single H1 Rule

Each file has exactly ONE H1 heading (the title). Use H2+ for all other sections.

### Link Style

- Use relative links for internal docs (example pattern: `Quickstart -> quickstart.md`)
- For root file references, increase `../` depth based on folder nesting (for example: `../VERSION.md`,
  `../../VERSION.md`)
- Use reference-style links for external URLs
- No broken links (validated in CI)

## Current Architecture

See `.github/count-manifest.json` for current agent, subagent, and skill counts.
See `.github/agent-registry.json` for the agent role → file mapping.
See `.github/skill-affinity.json` for the skill catalog.

## Prohibited References

Do NOT reference these removed agents/skills:

- `diagram.agent.md` → Use `drawio` or `python-diagrams` skill
- `adr.agent.md` → Use `azure-adr` skill
- `docs.agent.md` → Use `azure-artifacts` skill or `as-built` agent
- `azure-workload-docs` skill → Use `azure-artifacts` skill
- `azure-deployment-preflight` skill → Merged into deploy agent
- `orchestration-helper` skill → Deleted (absorbed into orchestrator)
- `github-issues` / `github-pull-requests` skills → Use `github-operations`
- `gh-cli` skill → Merged into `github-operations`
- `_shared/` directory → Use `azure-defaults` + `azure-artifacts` skills
- `microsoft-docs` skill → Now bundled with `ms-azuretools.vscode-azure-github-copilot` extension
- `microsoft-code-reference` skill → Now bundled with `ms-azuretools.vscode-azure-github-copilot` extension
- `microsoft-skill-creator` skill → Now bundled with `ms-azuretools.vscode-azure-github-copilot` extension

## Content Principles

| Principle                  | Application                                             |
| -------------------------- | ------------------------------------------------------- |
| **DRY**                    | Single source of truth per topic                        |
| **Current state**          | No historical context in main docs                      |
| **Action-oriented**        | Every section answers "how do I...?"                    |
| **Minimal**                | If it doesn't help users today, remove it               |
| **Prompt guide for depth** | Point to the prompt guide section in the published site |

## Validation

Documentation is validated in CI (warn-only):

- No references to removed agents
- Version numbers match `VERSION.md` (repo root)
- No broken internal links
- Markdown lint passes
