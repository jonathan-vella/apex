---
description: "Standards for user-facing documentation in the site/src/content/docs/ folder"
applyTo: "site/src/content/docs/**/*.md, site/src/content/docs/**/*.mdx"
---

# Documentation Standards

Instructions for creating and maintaining user-facing documentation in the `docs/` folder.

## Structure Requirements

### File Header

Every doc file must start with:

```markdown
# {Title}

> [Current Version](../../VERSION.md) | {One-line description}
```

Adjust the relative path depth based on folder nesting (`../../VERSION.md` from `docs/`,
`../../../VERSION.md` from `docs/subfolder/`).

### Single H1 Rule

Each file has exactly ONE H1 heading (the title). Use H2+ for all other sections.

### Link Style

- Use relative links for internal docs (example pattern: `Quickstart -> quickstart.md`)
- For root file references, increase `../` depth based on folder nesting (for example: `../VERSION.md`,
  `../../VERSION.md`)
- Use reference-style links for external URLs
- No broken links (validated in CI)

## Current Architecture

### Agents (see count-manifest.json for current counts)

| Agent                | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `orchestrator` | Master orchestrator with approval gates      |
| `requirements`       | Gather infrastructure requirements           |
| `architect`          | WAF assessment and architecture design       |
| `design`             | Architecture diagrams and ADRs               |
| `iac-planner`        | Unified IaC implementation planning          |
| `bicep-codegen`      | Bicep template generation                    |
| `bicep-deploy`       | Bicep Azure deployment execution             |
| `terraform-codegen`  | Terraform config generation                  |
| `terraform-deploy`   | Terraform Azure deployment execution         |
| `as-built`           | Step 7 workload documentation suite          |
| `diagnose`           | Post-deployment health diagnostics           |
| `challenger`         | Adversarial review of requirements and plans |
| `context-optimizer`  | Context window audit and token waste report  |

### Subagents (in `_subagents/`)

| Subagent                        | Parent           | Purpose                             |
| ------------------------------- | ---------------- | ----------------------------------- |
| `cost-estimate-subagent`        | Architect        | Azure Pricing MCP queries           |
| `governance-discovery-subagent` | IaC Planner      | Azure Policy REST API discovery     |
| `challenger-review-subagent`    | Orchestrator/Plans  | Adversarial artifact review         |
| `bicep-validate-subagent`       | Bicep Code       | Lint + AVM/security code review     |
| `bicep-whatif-subagent`         | Bicep Deploy     | Deployment preview                  |
| `terraform-validate-subagent`   | Terraform Code   | Lint + AVM-TF/security code review  |
| `terraform-plan-subagent`       | Terraform Deploy | Deployment preview (terraform plan) |

### Skills (see count-manifest.json for current counts)

| Skill                  | Category            | Purpose                                     |
| ---------------------- | ------------------- | ------------------------------------------- |
| `azure-adr`            | Document Creation   | Architecture Decision Records               |
| `azure-artifacts`      | Artifact Generation | Template H2s, styling, generation rules     |
| `azure-bicep-patterns` | IaC Patterns        | Reusable Bicep infrastructure patterns      |
| `azure-defaults`       | Azure Conventions   | Regions, naming, AVM, WAF, pricing, tags    |
| `drawio`               | Document Creation   | Draw.io architecture diagrams               |
| `python-diagrams`      | Document Creation   | WAF/cost/compliance charts (matplotlib)     |
| `mermaid`              | Document Creation   | Inline Mermaid diagrams for markdown        |
| `drawio`               | Document Creation   | Draw.io diagrams with Azure icon libraries  |
| `azure-diagnostics`    | Troubleshooting     | KQL templates, health checks, remediation   |
| `context-optimizer`    | Agent Optimization  | Context window audit, token waste reduction |
| `docs-writer`          | Documentation       | Repo-aware docs maintenance                 |
| `github-operations`    | Workflow Automation | Branch naming, commits, PRs, CLI, Actions   |
| `golden-principles`    | Agent Conventions   | 10 operating invariants for all agents      |
| `make-skill-template`  | Meta                | Skill creation helper                       |
| `terraform-patterns`   | IaC Patterns        | Reusable Terraform infrastructure patterns  |

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

| Principle                  | Application                                |
| -------------------------- | ------------------------------------------ |
| **DRY**                    | Single source of truth per topic           |
| **Current state**          | No historical context in main docs         |
| **Action-oriented**        | Every section answers "how do I...?"       |
| **Minimal**                | If it doesn't help users today, remove it  |
| **Prompt guide for depth** | Point to `docs/prompt-guide/` for examples |

## Validation

Documentation is validated in CI (warn-only):

- No references to removed agents
- Version numbers match `VERSION.md` (repo root)
- No broken internal links
- Markdown lint passes
