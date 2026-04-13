<!-- ref:repo-architecture-v1 -->

# Repo Architecture Reference

> For use by the `docs-writer` skill. Last verified: 2026-03-23.

## Workspace Root Structure

```text
azure-agentic-infraops/  (APEX)
├── .github/
││   ├── agents/              # Agent definitions + subagents
││   │   └── _subagents/      # Validation subagents (lint, what-if, review)
││   ├── skills/              # Skill definitions (see count-manifest.json)
││   │   └── azure-artifacts/templates/ # Artifact templates
││   ├── instructions/        # File-type instruction files
├── agent-output/{project}/  # Agent-generated artifacts (01-07)
├── docs/                    # User-facing documentation
│   ├── how-it-works/        # Architecture explanations
│   ├── migration/           # Migration guides
│   ├── prompt-guide/        # Agent & skill prompt examples
│   └── presenter/           # Presentation materials
├── tests/                   # Test checklists and exec plans
│   └── exec-plans/          # Execution plans and tech debt tracker
├── infra/bicep/             # Bicep module library
├── mcp/azure-pricing-mcp/   # Azure Pricing MCP server
├── scripts/                 # Validation and automation scripts
└── temp/                    # Scratch space (gitignored for outputs)
```

## Agent Inventory

See `.github/count-manifest.json` for canonical counts.

### Primary Agents

| Agent               | File                                | Model      | Step | Artifacts                       |
| ------------------- | ----------------------------------- | ---------- | ---- | ------------------------------- |
| Orchestrator        | `01-orchestrator.agent.md`          | Opus 4.6   | All  | Orchestration                   |
| Orchestrator (Fast) | `01-orchestrator-fastpath.agent.md` | Opus 4.6   | All  | Fast-path orchestration         |
| Requirements        | `02-requirements.agent.md`          | Opus 4.6   | 1    | `01-requirements.md`            |
| Architect           | `03-architect.agent.md`             | Opus 4.6   | 2    | `02-architecture-assessment.md` |
| Design              | `04-design.agent.md`                | Sonnet 4.5 | 3    | `03-des-*.{drawio,py,png,md}`   |
| Governance          | `04g-governance.agent.md`           | Sonnet 4.5 | 3.5  | `04-governance-constraints.md`  |
| IaC Plan            | `05-iac-planner.agent.md`           | Opus 4.6   | 4    | `04-implementation-plan.md`     |
| Bicep Code          | `06b-bicep-codegen.agent.md`        | Sonnet 4.5 | 5b   | Bicep in `infra/bicep/`         |
| Bicep Deploy        | `07b-bicep-deploy.agent.md`         | Sonnet 4.5 | 6b   | `06-deployment-summary.md`      |
| Terraform Code      | `06t-terraform-codegen.agent.md`    | Sonnet 4.5 | 5t   | Terraform in `infra/terraform/` |
| Terraform Deploy    | `07t-terraform-deploy.agent.md`     | Sonnet 4.5 | 6t   | `06-deployment-summary.md`      |
| As-Built            | `08-as-built.agent.md`              | Sonnet 4.5 | 7    | `07-ab-*.md` docs suite         |
| Diagnose            | `09-diagnose.agent.md`              | Sonnet 4.5 | —    | Diagnostic reports              |
| Challenger          | `10-challenger.agent.md`            | Sonnet 4.5 | —    | Challenge findings              |
| Context Optimizer   | `11-context-optimizer.agent.md`     | Sonnet 4.5 | —    | Optimization reports            |
| E2E Orchestrator    | `e2e-orchestrator.agent.md`         | Opus 4.6   | All  | E2E evaluation loop             |

### Validation Subagents (in `_subagents/`)

| Subagent                      | File                                     | Purpose                             |
| ----------------------------- | ---------------------------------------- | ----------------------------------- |
| bicep-validate-subagent       | `bicep-validate-subagent.agent.md`       | Lint + AVM/security code review     |
| bicep-whatif-subagent         | `bicep-whatif-subagent.agent.md`         | Deployment preview (what-if)        |
| challenger-review-subagent    | `challenger-review-subagent.agent.md`    | Adversarial artifact review         |
| cost-estimate-subagent        | `cost-estimate-subagent.agent.md`        | Azure Pricing MCP queries           |
| governance-discovery-subagent | `governance-discovery-subagent.agent.md` | Azure Policy REST API discovery     |
| terraform-plan-subagent       | `terraform-plan-subagent.agent.md`       | Deployment preview (terraform plan) |
| terraform-validate-subagent   | `terraform-validate-subagent.agent.md`   | Lint + AVM-TF/security code review  |

### Shared Knowledge (via Skills)

All shared context previously in `_shared/` is now consolidated into skills:

| Skill             | Replaces                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `azure-defaults`  | `defaults.md`, `avm-pitfalls.md`, `research-patterns.md`, `service-lifecycle-validation.md` |
| `azure-artifacts` | `documentation-styling.md`, all template H2 structures                                      |

## Skill Catalog

See `.github/count-manifest.json` for canonical skill counts.
Each subdirectory under `.github/skills/` with a `SKILL.md` is one skill.

| Skill                         | Folder                         | Category            | Triggers                                  |
| ----------------------------- | ------------------------------ | ------------------- | ----------------------------------------- |
| `appinsights-instrumentation` | `appinsights-instrumentation/` | Observability       | "instrument app", "App Insights"          |
| `azure-adr`                   | `azure-adr/`                   | Document Creation   | "create ADR", "document decision"         |
| `azure-ai`                    | `azure-ai/`                    | AI Services         | "AI Search", "speech-to-text", "OCR"      |
| `azure-aigateway`             | `azure-aigateway/`             | AI Governance       | "AI gateway", "semantic caching"          |
| `azure-artifacts`             | `azure-artifacts/`             | Artifact Generation | "generate documentation"                  |
| `azure-bicep-patterns`        | `azure-bicep-patterns/`        | IaC Patterns        | "bicep pattern", "hub-spoke"              |
| `azure-cloud-migrate`         | `azure-cloud-migrate/`         | Migration           | "migrate to Azure", "cross-cloud"         |
| `azure-compliance`            | `azure-compliance/`            | Security            | "compliance scan", "security audit"       |
| `azure-compute`               | `azure-compute/`               | Compute             | "recommend VM", "VM sizing"               |
| `azure-cost-optimization`     | `azure-cost-optimization/`     | Cost                | "optimize costs", "reduce spending"       |
| `azure-defaults`              | `azure-defaults/`              | Azure Conventions   | "azure defaults", "naming"                |
| `azure-deploy`                | `azure-deploy/`                | Deployment          | "azd up", "deploy", "go live"             |
| `azure-diagnostics`           | `azure-diagnostics/`           | Troubleshooting     | "troubleshoot", "KQL", "health check"     |
| `excalidraw`                  | `excalidraw/`                  | Whiteboarding       | "whiteboard", "brainstorm", "sketch"      |
| `python-diagrams`             | `python-diagrams/`             | Document Creation   | "create chart", "WAF chart"               |
| `mermaid`                     | `mermaid/`                     | Document Creation   | "mermaid diagram", "flowchart"            |
| `azure-diagrams`              | `azure-diagrams/`              | Routing             | Routes to drawio/python-diagrams/mermaid  |
| `azure-hosted-copilot-sdk`    | `azure-hosted-copilot-sdk/`    | SDK                 | "copilot SDK", "copilot app"              |
| `azure-kusto`                 | `azure-kusto/`                 | Data & Analytics    | "KQL queries", "Azure Data Explorer"      |
| `azure-messaging`             | `azure-messaging/`             | Messaging           | "event hub", "service bus"                |
| `azure-prepare`               | `azure-prepare/`               | Deployment          | "create app", "prepare Azure"             |
| `azure-quotas`                | `azure-quotas/`                | Capacity            | "check quotas", "service limits"          |
| `azure-rbac`                  | `azure-rbac/`                  | Identity            | "RBAC role", "least privilege"            |
| `azure-resource-lookup`       | `azure-resource-lookup/`       | Discovery           | "list resources", "find VMs"              |
| `azure-resource-visualizer`   | `azure-resource-visualizer/`   | Visualization       | "visualize resources", "resource diagram" |
| `azure-storage`               | `azure-storage/`               | Storage             | "blob storage", "file shares"             |
| `azure-validate`              | `azure-validate/`              | Validation          | "validate app", "preflight checks"        |
| `context-optimizer`           | `context-optimizer/`           | Meta                | "context optimization", "token waste"     |
| `context-shredding`           | `context-shredding/`           | Meta                | "compress context", "context budget"      |
| `copilot-customization`       | `copilot-customization/`       | Meta                | "customization", "instructions", "agents" |
| `count-registry`              | `count-registry/`              | Meta                | "entity count", "how many agents"         |
| `docs-writer`                 | `docs-writer/`                 | Documentation       | "update docs", "check staleness"          |
| `entra-app-registration`      | `entra-app-registration/`      | Identity            | "app registration", "Entra ID"            |
| `github-operations`           | `github-operations/`           | Workflow            | "commit", "create issue", "create PR"     |
| `golden-principles`           | `golden-principles/`           | Meta                | "operating principles", "agent rules"     |
| `iac-common`                  | `iac-common/`                  | IaC Patterns        | "deploy patterns", "circuit breaker"      |
| `make-skill-template`         | `make-skill-template/`         | Meta                | "create skill"                            |
| `microsoft-code-reference`    | `microsoft-code-reference/`    | SDK Reference       | "Azure SDK", "code sample"                |
| `microsoft-docs`              | `microsoft-docs/`              | Documentation       | "Azure docs", "quickstart"                |
| `microsoft-foundry`           | `microsoft-foundry/`           | AI Platform         | "Foundry agent", "deploy agent"           |
| `microsoft-skill-creator`     | `microsoft-skill-creator/`     | Meta                | "create skill for Microsoft tech"         |
| `session-resume`              | `session-resume/`              | Workflow            | "resume session", "checkpoint"            |
| `terraform-patterns`          | `terraform-patterns/`          | IaC Patterns        | "terraform pattern", "AVM-TF", "HCL"      |
| `terraform-search-import`     | `terraform-search-import/`     | IaC Import          | "import resources", "terraform import"    |
| `terraform-test`              | `terraform-test/`              | IaC Testing         | "terraform test", ".tftest.hcl"           |
| `workflow-engine`             | `workflow-engine/`             | Workflow            | "workflow DAG", "step routing"            |

## Template Inventory

All in `.github/skills/azure-artifacts/templates/`. Naming: `{step}-{name}.template.md`.
See `.github/count-manifest.json` for canonical counts.

| Template                                  | Artifact             | Validation        |
| ----------------------------------------- | -------------------- | ----------------- |
| `00-session-state.template.json`          | Session State        | JSON schema       |
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
| `09-lessons-learned.template.md`          | Lessons Learned      | Relaxed           |
| `PROJECT-README.template.md`              | Project README       | —                 |

## Instruction File Map

See `.github/count-manifest.json` for canonical counts.

| Instruction                                    | Applies To (glob)                                               |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `agent-authoring.instructions.md`              | `**/*.agent.md, **/*.prompt.md`                                 |
| `agent-research-first.instructions.md`         | `**/*.agent.md`                                                 |
| `agent-skills.instructions.md`                 | `**/.github/skills/**/SKILL.md`                                 |
| `astro.instructions.md`                        | `site/**/*.astro, site/**/*.ts, site/**/*.mdx, site/**/*.md`    |
| `azure-artifacts.instructions.md`              | `**/agent-output/**/*.md`                                       |
| `iac-bicep-best-practices.instructions.md`     | `**/*.bicep`                                                    |
| `iac-terraform-best-practices.instructions.md` | `**/*.tf`                                                       |
| `iac-plan-best-practices.instructions.md`      | `**/04-implementation-plan.md`                                  |
| `code-quality.instructions.md`                 | `**/*.{js,mjs,cjs,ts,tsx,jsx,py,ps1,sh,bicep,tf}`               |
| `context-optimization.instructions.md`         | `.github/agents/**/*.agent.md, .github/skills/**/SKILL.md`      |
| `docs.instructions.md`                         | `site/src/content/docs/**/*.md, site/src/content/docs/**/*.mdx` |
| `docs-trigger.instructions.md`                 | `**/*.agent.md, **/SKILL.md, **/scripts/*.mjs`                  |
| `github-actions.instructions.md`               | `.github/workflows/*.yml`                                       |
| `governance-discovery.instructions.md`         | `**/04-governance-*.md`                                         |
| `instructions.instructions.md`                 | `**/*.instructions.md`                                          |
| `javascript.instructions.md`                   | `**/*.{js,mjs,cjs}`                                             |
| `json.instructions.md`                         | `**/*.{json,jsonc}`                                             |
| `lesson-collection.instructions.md`            | `**/*orchestrator*.agent.md`                                    |
| `markdown.instructions.md`                     | `**/*.md`                                                       |
| `no-hardcoded-counts.instructions.md`          | `**/*.md, **/*.json, **/*.mjs`                                  |
| `no-heredoc.instructions.md`                   | `**`                                                            |
| `powershell.instructions.md`                   | `**/*.ps1, **/*.psm1`                                           |
| `prompt.instructions.md`                       | `**/*.prompt.md`                                                |
| `python.instructions.md`                       | `**/*.py`                                                       |
| `shell.instructions.md`                        | `**/*.sh`                                                       |

## Artifact Flow (Multi-Step Workflow)

```text
Step 1          Step 2            Step 3         Step 4
Requirements → Architecture →  Design       → Planning
(01-*.md)     (02-*.md)       (03-des-*)     (04-*.md)
                                  │
                                  ├─ Diagrams (03-des-diagram.drawio)
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

| File                                    | Contains                                |
| --------------------------------------- | --------------------------------------- |
| `site/src/content/docs/`                | Published documentation pages           |
| `docs.instructions.md`                  | Site docs standards                     |
| `QUALITY_SCORE.md`                      | Project health grades (doc-gardening)   |
| `tests/exec-plans/tech-debt-tracker.md` | Tech debt inventory                     |
| `VERSION.md`                            | Canonical version number                |
| `CHANGELOG.md`                          | Release history                         |
| `README.md` (root)                      | Overview, project structure, tech stack |

## docs/ Folder Contents

| File                         | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `index.md`                   | Documentation hub / landing page                 |
| `quickstart.md`              | Getting started guide                            |
| `workflow.md`                | Detailed multi-step workflow reference           |
| `troubleshooting.md`         | Common issues and fixes                          |
| `dev-containers.md`          | Dev container setup                              |
| `faq.md`                     | Frequently asked questions                       |
| `e2e-testing.md`             | E2E testing guide                                |
| `cost-governance.md`         | Cost governance guide                            |
| `security-baseline.md`       | Security baseline reference                      |
| `session-debugging.md`       | Session debugging guide                          |
| `hooks.md`                   | Git hooks documentation                          |
| `validation-reference.md`    | Validation and linting reference                 |
| `GLOSSARY.md`                | Terms and definitions                            |
| `CHANGELOG.md`               | Documentation changelog                          |
| `CONTRIBUTING.md`            | Contribution guidelines                          |
| `architecture-explorer.html` | Interactive architecture explorer                |
| `assets/`                    | Static assets (images, etc.)                     |
| `how-it-works/`              | Architecture explanations                        |
| `migration/`                 | Migration guides                                 |
| `prompt-guide/`              | Agent & skill prompt examples and best practices |
| `presenter/`                 | Presentation materials                           |

## Skill Discovery & Auto-Invocation

Skills are discovered by VS Code Copilot via **description keyword matching**
in the SKILL.md frontmatter — not through `tools:` arrays in agent definitions.

### Agent-Referenced Skills

These skills are explicitly referenced in agent body text via mandatory
"Read skills FIRST" instructions:

| Skill               | Referenced By                                              |
| ------------------- | ---------------------------------------------------------- |
| `azure-defaults`    | all primary agents                                         |
| `azure-artifacts`   | requirements, architect, iac-planner, deploy, orchestrator |
| `drawio`            | design, architect, as-built agents                         |
| `python-diagrams`   | architect, as-built agents                                 |
| `azure-adr`         | design agent                                               |
| `github-operations` | orchestrator, iac-planner agents                           |

### General-Purpose Skills

Discovered purely by prompt keyword matching — no agent explicitly
references them:

- `docs-writer` — Triggered by "update docs", "check staleness" prompts
- `make-skill-template` — Triggered by "create skill", "new skill" prompts

### Instruction Files (Separate Mechanism)

Instruction files (`.github/instructions/*.instructions.md`) load automatically
via `.gitattributes` `applyTo` globs — this is a distinct mechanism from skill
discovery. Instructions are file-type-scoped rules, not invokable skills.
