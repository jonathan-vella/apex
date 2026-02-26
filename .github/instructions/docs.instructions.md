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

## Current Architecture (as of 2026-02-26)

### Agents (13 top-level + 9 subagents)

| Agent                | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `infraops-conductor` | Master orchestrator with approval gates      |
| `requirements`       | Gather infrastructure requirements           |
| `architect`          | WAF assessment and architecture design       |
| `design`             | Architecture diagrams and ADRs               |
| `bicep-planner`      | Bicep implementation planning and governance |
| `bicep-codegen`      | Bicep template generation                    |
| `bicep-deploy`       | Bicep Azure deployment execution             |
| `terraform-planner`  | Terraform implementation planning            |
| `terraform-codegen`  | Terraform config generation                  |
| `terraform-deploy`   | Terraform Azure deployment execution         |
| `as-built`           | Step 7 workload documentation suite          |
| `diagnose`           | Post-deployment health diagnostics           |
| `challenger`         | Adversarial review of requirements and plans |

### Subagents (in `_subagents/`)

| Subagent                        | Parent           | Purpose                             |
| ------------------------------- | ---------------- | ----------------------------------- |
| `cost-estimate-subagent`        | Architect        | Azure Pricing MCP queries           |
| `governance-discovery-subagent` | IaC Planners     | Azure Policy REST API discovery     |
| `challenger-review-subagent`    | Conductor/Plans  | Adversarial artifact review         |
| `bicep-lint-subagent`           | Bicep Code       | Syntax validation                   |
| `bicep-review-subagent`         | Bicep Code       | AVM/security code review            |
| `bicep-whatif-subagent`         | Bicep Deploy     | Deployment preview                  |
| `terraform-lint-subagent`       | Terraform Code   | Syntax validation (validate/fmt)    |
| `terraform-review-subagent`     | Terraform Code   | AVM-TF code review                  |
| `terraform-plan-subagent`       | Terraform Deploy | Deployment preview (terraform plan) |

### Skills (14 total)

| Skill                      | Category            | Purpose                                    |
| -------------------------- | ------------------- | ------------------------------------------ |
| `azure-adr`                | Document Creation   | Architecture Decision Records              |
| `azure-artifacts`          | Artifact Generation | Template H2s, styling, generation rules    |
| `azure-bicep-patterns`     | IaC Patterns        | Reusable Bicep infrastructure patterns     |
| `azure-defaults`           | Azure Conventions   | Regions, naming, AVM, WAF, pricing, tags   |
| `azure-diagrams`           | Document Creation   | Python architecture diagrams               |
| `azure-troubleshooting`    | Troubleshooting     | KQL templates, health checks, remediation  |
| `docs-writer`              | Documentation       | Repo-aware docs maintenance                |
| `git-commit`               | Tool Integration    | Commit conventions                         |
| `github-operations`        | Workflow Automation | GitHub issues, PRs, CLI, Actions, releases |
| `make-skill-template`      | Meta                | Skill creation helper                      |
| `microsoft-code-reference` | Docs Integration    | SDK method verification, code samples      |
| `microsoft-docs`           | Docs Integration    | Official Microsoft documentation queries   |
| `microsoft-skill-creator`  | Docs Integration    | Create skills for Microsoft technologies   |
| `terraform-patterns`       | IaC Patterns        | Reusable Terraform infrastructure patterns |

## Prohibited References

Do NOT reference these removed agents/skills:

- ❌ `diagram.agent.md` → Use `azure-diagrams` skill
- ❌ `adr.agent.md` → Use `azure-adr` skill
- ❌ `docs.agent.md` → Use `azure-artifacts` skill or `as-built` agent
- ❌ `azure-workload-docs` skill → Use `azure-artifacts` skill
- ❌ `azure-deployment-preflight` skill → Merged into deploy agent
- ❌ `orchestration-helper` skill → Deleted (absorbed into conductor)
- ❌ `github-issues` / `github-pull-requests` skills → Use `github-operations`
- ❌ `gh-cli` skill → Merged into `github-operations`
- ❌ `_shared/` directory → Use `azure-defaults` + `azure-artifacts` skills

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
