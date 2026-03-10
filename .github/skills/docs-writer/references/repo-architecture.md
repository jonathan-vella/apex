<!-- ref:repo-architecture-v1 -->

# Repo Architecture Reference

> For use by the `docs-writer` skill. Last verified: 2026-02-26.

## Workspace Root Structure

```text
azure-agentic-infraops/
├── .github/
││   ├── agents/              # 13 agent definitions + 9 subagents
││   │   └── _subagents/      # Validation subagents (lint, what-if, review)
││   ├── skills/              # 14 skill definitions (incl. docs-writer)
││   │   └── azure-artifacts/templates/ # 16 artifact templates
││   ├── instructions/        # 25 file-type instruction files
├── agent-output/{project}/  # Agent-generated artifacts (01-07)
├── docs/                    # User-facing documentation
│   ├── exec-plans/          # Execution plans and tech debt tracker
│   ├── prompt-guide/        # Agent & skill prompt examples
│   ├── presenter/           # Presentation materials
│   └── testing/             # Test checklists
├── infra/bicep/             # Bicep module library
├── mcp/azure-pricing-mcp/   # Azure Pricing MCP server
├── scripts/                 # Validation and automation scripts
└── temp/                    # Scratch space (gitignored for outputs)
```

## Agent Inventory (13 Primary + 9 Subagents)

### Primary Agents

| Agent              | File                             | Model      | Step | Artifacts                       |
| ------------------ | -------------------------------- | ---------- | ---- | ------------------------------- |
| InfraOps Conductor | `01-conductor.agent.md`          | Opus 4.6   | All  | Orchestration                   |
| Requirements       | `02-requirements.agent.md`       | Opus 4.6   | 1    | `01-requirements.md`            |
| Architect          | `03-architect.agent.md`          | Opus 4.6   | 2    | `02-architecture-assessment.md` |
| Design             | `04-design.agent.md`             | Sonnet 4.5 | 3    | `03-des-*.{py,png,md}`          |
| Bicep Plan         | `05b-bicep-planner.agent.md`     | Opus 4.6   | 4b   | `04-implementation-plan.md`     |
| Bicep Code         | `06b-bicep-codegen.agent.md`     | Sonnet 4.5 | 5b   | Bicep in `infra/bicep/`         |
| Bicep Deploy       | `07b-bicep-deploy.agent.md`      | Sonnet 4.5 | 6b   | `06-deployment-summary.md`      |
| Terraform Plan     | `05t-terraform-planner.agent.md` | Opus 4.6   | 4t   | `04-implementation-plan.md`     |
| Terraform Code     | `06t-terraform-codegen.agent.md` | Sonnet 4.5 | 5t   | Terraform in `infra/terraform/` |
| Terraform Deploy   | `07t-terraform-deploy.agent.md`  | Sonnet 4.5 | 6t   | `06-deployment-summary.md`      |
| As-Built           | `08-as-built.agent.md`           | Sonnet 4.5 | 7    | `07-ab-*.md` docs suite         |
| Diagnose           | `09-diagnose.agent.md`           | Sonnet 4.5 | —    | Diagnostic reports              |
| Challenger         | `10-challenger.agent.md`         | Sonnet 4.5 | —    | Challenge findings              |

### Validation Subagents (in `_subagents/`)

| Subagent                      | File                                     | Purpose                     |
| ----------------------------- | ---------------------------------------- | --------------------------- |
| cost-estimate-subagent        | `cost-estimate-subagent.agent.md`        | Azure Pricing MCP queries   |
| governance-discovery-subagent | `governance-discovery-subagent.agent.md` | Azure Policy discovery      |
| challenger-review-subagent    | `challenger-review-subagent.agent.md`    | Adversarial artifact review |
| bicep-lint-subagent           | `bicep-lint-subagent.agent.md`           | Syntax validation           |
| bicep-whatif-subagent         | `bicep-whatif-subagent.agent.md`         | Deployment preview          |
| bicep-review-subagent         | `bicep-review-subagent.agent.md`         | AVM code review             |
| terraform-lint-subagent       | `terraform-lint-subagent.agent.md`       | Syntax validation           |
| terraform-review-subagent     | `terraform-review-subagent.agent.md`     | AVM-TF code review          |
| terraform-plan-subagent       | `terraform-plan-subagent.agent.md`       | Deployment preview          |

### Shared Knowledge (via Skills)

All shared context previously in `_shared/` is now consolidated into skills:

| Skill             | Replaces                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `azure-defaults`  | `defaults.md`, `avm-pitfalls.md`, `research-patterns.md`, `service-lifecycle-validation.md` |
| `azure-artifacts` | `documentation-styling.md`, all template H2 structures                                      |

## Skill Catalog (14 Skills)

| Skill                   | Folder                   | Category            | Triggers                                  |
| ----------------------- | ------------------------ | ------------------- | ----------------------------------------- |
| `azure-adr`             | `azure-adr/`             | Document Creation   | "create ADR", "document decision"         |
| `azure-artifacts`       | `azure-artifacts/`       | Artifact Generation | "generate documentation"                  |
| `azure-bicep-patterns`  | `azure-bicep-patterns/`  | IaC Patterns        | "bicep pattern", "hub-spoke"              |
| `azure-defaults`        | `azure-defaults/`        | Azure Conventions   | "azure defaults", "naming"                |
| `azure-diagrams`        | `azure-diagrams/`        | Document Creation   | "create diagram"                          |
| `azure-troubleshooting` | `azure-troubleshooting/` | Troubleshooting     | "troubleshoot", "KQL", "health check"     |
| `docs-writer`           | `docs-writer/`           | Documentation       | "update the docs"                         |
| `git-commit`            | `git-commit/`            | Tool Integration    | "commit"                                  |
| `github-operations`     | `github-operations/`     | Workflow            | "create issue", "create PR", "gh command" |
| `make-skill-template`   | `make-skill-template/`   | Meta                | "create skill"                            |
| `terraform-patterns`    | `terraform-patterns/`    | IaC Patterns        | "terraform pattern", "AVM-TF", "HCL"      |

## Template Inventory (16 Templates)

All in `.github/skills/azure-artifacts/templates/`. Naming: `{step}-{name}.template.md`.

| Template                                  | Artifact             | Validation        |
| ----------------------------------------- | -------------------- | ----------------- |
| `01-requirements.template.md`             | Requirements         | Standard (strict) |
| `02-architecture-assessment.template.md`  | WAF Assessment       | Standard (strict) |
| `03-des-cost-estimate.template.md`        | Design Cost Estimate | Cost validator    |
| `04-governance-constraints.template.md`   | Governance           | Standard (strict) |
| `04-implementation-plan.template.md`      | Implementation Plan  | Standard (strict) |
| `04-preflight-check.template.md`          | Preflight Check      | Standard (strict) |
| `05-implementation-reference.template.md` | Impl Reference       | Relaxed           |
| `06-deployment-summary.template.md`       | Deploy Summary       | Standard (strict) |
| `07-ab-cost-estimate.template.md`         | As-Built Cost        | Cost validator    |
| `07-backup-dr-plan.template.md`           | Backup/DR Plan       | Relaxed           |
| `07-compliance-matrix.template.md`        | Compliance Matrix    | Relaxed           |
| `07-design-document.template.md`          | Design Document      | Relaxed           |
| `07-documentation-index.template.md`      | Doc Index            | Relaxed           |
| `07-operations-runbook.template.md`       | Ops Runbook          | Relaxed           |
| `07-resource-inventory.template.md`       | Resource Inventory   | Relaxed           |
| `PROJECT-README.template.md`              | Project README       | —                 |

## Instruction File Map (25 Files)

| Instruction                                     | Applies To (glob)                                 |
| ----------------------------------------------- | ------------------------------------------------- |
| `agent-research-first.instructions.md`          | `**/*.agent.md`                                   |
| `agent-skills.instructions.md`                  | `**/.github/skills/**/SKILL.md`                   |
| `agent-definitions.instructions.md`             | `**/*.agent.md`                                   |
| `azure-artifacts.instructions.md`               | `**/agent-output/**/*.md`                         |
| `bicep-code-best-practices.instructions.md`     | `**/*.bicep`                                      |
| `bicep-policy-compliance.instructions.md`       | `**/*.bicep, **/*.agent.md`                       |
| `code-commenting.instructions.md`               | `**`                                              |
| `code-review.instructions.md`                   | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}` |
| `cost-estimate.instructions.md`                 | `**/03-des-cost-estimate.md`, etc.                |
| `docs.instructions.md`                          | `docs/**/*.md`                                    |
| `docs-trigger.instructions.md`                  | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}` |
| `github-actions.instructions.md`                | `.github/workflows/*.yml`                         |
| `governance-discovery.instructions.md`          | `**/04-governance-*.md`                           |
| `instructions.instructions.md`                  | `**/*.instructions.md`                            |
| `javascript.instructions.md`                    | `**/*.{js,mjs,cjs}`                               |
| `json.instructions.md`                          | `**/*.{json,jsonc}`                               |
| `markdown.instructions.md`                      | `**/*.md`                                         |
| `no-heredoc.instructions.md`                    | `**`                                              |
| `powershell.instructions.md`                    | `**/*.ps1`, `**/*.psm1`                           |
| `prompt.instructions.md`                        | `**/*.prompt.md`                                  |
| `python.instructions.md`                        | `**/*.py`                                         |
| `shell.instructions.md`                         | `**/*.sh`                                         |
| `terraform-code-best-practices.instructions.md` | `**/*.tf`                                         |
| `terraform-policy-compliance.instructions.md`   | `**/*.tf, **/*.agent.md`                          |
| `workload-documentation.instructions.md`        | `**/agent-output/**/07-*.md`                      |

## Artifact Flow (7-Step Workflow)

```text
Step 1          Step 2            Step 3         Step 4
Requirements → Architecture →  Design       → Planning
(01-*.md)     (02-*.md)       (03-des-*)     (04-*.md)
                                  │
                                  ├─ Diagrams (03-des-diagram.py/png)
                                  ├─ ADRs (03-des-adr-*.md)
                                  └─ Cost Estimate (03-des-cost-estimate.md)

Step 5            Step 6          Step 7
Implementation → Deploy       → Documentation
(infra/bicep/)  (06-*.md)      (07-*.md × 7 types)
(05-*.md)
```

## Key Files for Documentation Maintenance

These files contain counts, tables, or version references that need
updating when agents or skills change:

| File                                   | Contains                                   |
| -------------------------------------- | ------------------------------------------ |
| `docs/README.md`                       | Agent tables, skill tables, structure tree |
| `docs.instructions.md`                 | Agent count/table, skill count/table       |
| `docs/prompt-guide/README.md`          | Agent & skill prompt examples              |
| `QUALITY_SCORE.md`                     | Project health grades (doc-gardening)      |
| `docs/exec-plans/tech-debt-tracker.md` | Tech debt inventory                        |
| `VERSION.md`                           | Canonical version number                   |
| `CHANGELOG.md`                         | Release history                            |
| `README.md` (root)                     | Overview, project structure, tech stack    |

## docs/ Folder Contents

| File                       | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `README.md`                | Documentation hub with quick links               |
| `quickstart.md`            | 10-minute getting started guide                  |
| `workflow.md`              | Detailed 7-step workflow reference               |
| `troubleshooting.md`       | Common issues and fixes                          |
| `dev-containers.md`        | Dev container setup                              |
| `terraform-roadmap.md`     | Future Terraform support plans                   |
| `GLOSSARY.md`              | Terms and definitions                            |
| `branch-ruleset-config.md` | Branch protection ruleset configuration          |
| `exec-plans/`              | Execution plans and tech-debt-tracker            |
| `prompt-guide/`            | Agent & skill prompt examples and best practices |
| `presenter/`               | Presentation materials (pptx, ROI, infographics) |
| `tf-tests/`                | Terraform test checklists and prompt fixtures    |

## Skill Discovery & Auto-Invocation

Skills are discovered by VS Code Copilot via **description keyword matching**
in the SKILL.md frontmatter — not through `tools:` arrays in agent definitions.

### Agent-Referenced Skills

These skills are explicitly referenced in agent body text via mandatory
"Read skills FIRST" instructions:

| Skill               | Referenced By                                          |
| ------------------- | ------------------------------------------------------ |
| `azure-defaults`    | all 13 primary agents                                  |
| `azure-artifacts`   | requirements, architect, bicep-plan, deploy, conductor |
| `azure-diagrams`    | design, architect agents                               |
| `azure-adr`         | design agent                                           |
| `github-operations` | conductor, bicep-plan agents                           |

### General-Purpose Skills

Discovered purely by prompt keyword matching — no agent explicitly
references them:

- `git-commit` — Triggered by "commit", "git commit" prompts
- `docs-writer` — Triggered by "update docs", "check staleness" prompts
- `make-skill-template` — Triggered by "create skill", "new skill" prompts

### Instruction Files (Separate Mechanism)

Instruction files (`.github/instructions/*.instructions.md`) load automatically
via `.gitattributes` `applyTo` globs — this is a distinct mechanism from skill
discovery. Instructions are file-type-scoped rules, not invokable skills.
