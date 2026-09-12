<!-- ref:repo-architecture-v1 -->

# Repo Architecture Reference

> For use by the `apex-docs-writer` skill. Model and harness guidance updated: 2026-09-11.
> Agent frontmatter owns assignments; inventories below are documentation, not runtime overrides.

## Workspace Root Structure

```text
apex/  (APEX)
├── .github/
││   ├── agents/              # Agent definitions + subagents
││   │   └── _subagents/      # Validation subagents (lint, what-if, review)
││   ├── skills/              # Skill definitions (see count-manifest.json)
││   │   └── apex-azure-artifacts/templates/ # Artifact templates
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
├── tools/
│   ├── apex-recall/        # Progressive session recall CLI
│   ├── registry/           # Agent registry + count manifest
│   ├── schemas/            # JSON schemas
│   └── scripts/            # Validation and maintenance scripts
├── scripts/                 # Validation and automation scripts
└── temp/                    # Scratch space (gitignored for outputs)
```

## Agent Inventory

See `tools/registry/count-manifest.json` for canonical counts.

### Primary Agents

| Agent             | File                             | Model                     | Step | Artifacts                       |
| ----------------- | -------------------------------- | ------------------------- | ---- | ------------------------------- |
| Orchestrator      | `01-orchestrator.agent.md`       | MAI-Code-1.1-Flash        | All  | Orchestration                   |
| Requirements      | `02-requirements.agent.md`       | gpt-5.6-sol               | 1    | `01-requirements.md`            |
| Architect         | `03-architect.agent.md`          | gpt-5.6-sol               | 2    | `02-architecture-assessment.md` |
| Design            | `04-design.agent.md`             | GPT-5.6-Terra             | 3    | `03-des-*.{py,png,svg,md}`      |
| Governance        | `04g-governance.agent.md`        | GPT-5.6-Luna              | 3.5  | `04-governance-constraints.md`  |
| IaC Plan          | `05-iac-planner.agent.md`        | gpt-5.6-sol               | 4    | `04-implementation-plan.md`     |
| Bicep Code        | `06b-bicep-codegen.agent.md`     | GPT-5.6-Terra             | 5b   | Bicep in `infra/bicep/`         |
| Bicep Deploy      | `07b-bicep-deploy.agent.md`      | GPT-5.6-Luna              | 6b   | `06-deployment-summary.md`      |
| Terraform Code    | `06t-terraform-codegen.agent.md` | GPT-5.6-Terra             | 5t   | Terraform in `infra/terraform/` |
| Terraform Deploy  | `07t-terraform-deploy.agent.md`  | GPT-5.6-Luna              | 6t   | `06-deployment-summary.md`      |
| As-Built          | `08-as-built.agent.md`           | GPT-5.6-Terra             | 7    | `07-ab-*.md` docs suite         |
| Diagnose          | `09-diagnose.agent.md`           | GPT-5.6-Terra             | —    | Diagnostic reports              |
| Challenger        | `10-challenger.agent.md`         | GPT-5.6-Terra             | —    | Challenge findings              |
| Context Optimizer | `11-context-optimizer.agent.md`  | gpt-5.6-sol               | —    | Optimization reports            |

All production main agents, including `10-Challenger`, use `disable-model-invocation: true`.
Use human handoffs; an unavailable reviewer is not permission for a nested wrapper fallback.
The E2E launch subsystem is retired. Preserve production lessons and historical artifacts/schema compatibility.

### Validation Subagents (in `_subagents/`)

| Subagent                    | File                                   | Purpose                             |
| --------------------------- | -------------------------------------- | ----------------------------------- |
| bicep-validate-subagent     | `bicep-validate-subagent.agent.md`     | Lint + AVM/security code review     |
| bicep-whatif-subagent       | `bicep-whatif-subagent.agent.md`       | Deployment preview (what-if)        |
| challenger-review-subagent  | `challenger-review-subagent.agent.md`  | Adversarial artifact review         |
| cost-estimate-subagent      | `cost-estimate-subagent.agent.md`      | ARM MCP pricing queries             |
| policy-precheck-subagent    | `policy-precheck-subagent.agent.md`    | Live deployment policy precheck     |
| terraform-plan-subagent     | `terraform-plan-subagent.agent.md`     | Deployment preview (terraform plan) |
| terraform-validate-subagent | `terraform-validate-subagent.agent.md` | Lint + AVM-TF/security code review  |

The review worker uses `GPT-5.6-Terra`; the other workers use `GPT-5.6-Luna`.
Sol, Terra, and Luna labels are not evidence of runtime cost-tier eligibility,
availability, or API support. Check actual harness capability; never infer a fallback model.

### Shared Knowledge (via Skills)

All shared context previously in `_shared/` is now consolidated into skills:

| Skill             | Replaces                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `apex-azure-defaults`  | `defaults.md`, `avm-pitfalls.md`, `research-patterns.md`, `service-lifecycle-validation.md` |
| `apex-azure-artifacts` | `documentation-styling.md`, all template H2 structures                                      |

## Skill Catalog

See `tools/registry/count-manifest.json` for canonical skill counts.
Each subdirectory under `.github/skills/` with a `SKILL.md` is one skill.

| Skill                         | Folder                         | Category            | Triggers                                   |
| ----------------------------- | ------------------------------ | ------------------- | ------------------------------------------ |
| `appinsights-instrumentation` | `appinsights-instrumentation/` | Observability       | "instrument app", "App Insights"           |
| `apex-azure-adr`                   | `apex-azure-adr/`                   | Document Creation   | "create ADR", "document decision"          |
| `azure-ai`                    | `azure-ai/`                    | AI Services         | "AI Search", "speech-to-text", "OCR"       |
| `apex-azure-artifacts`             | `apex-azure-artifacts/`             | Artifact Generation | "generate documentation"                   |
| `apex-azure-bicep-patterns`        | `apex-azure-bicep-patterns/`        | IaC Patterns        | "bicep pattern", "hub-spoke"               |
| `apex-azure-cloud-migrate`         | `apex-azure-cloud-migrate/`         | Migration           | "migrate to Azure", "cross-cloud"          |
| `apex-azure-compliance`            | `apex-azure-compliance/`            | Security            | "compliance scan", "security audit"        |
| `apex-azure-compute`               | `apex-azure-compute/`               | Compute             | "recommend VM", "VM sizing"                |
| `apex-azure-cost-optimization`     | `apex-azure-cost-optimization/`     | Cost                | "optimize costs", "reduce spending"        |
| `apex-azure-defaults`              | `apex-azure-defaults/`              | Azure Conventions   | "azure defaults", "naming"                 |
| `apex-azure-deploy`                | `apex-azure-deploy/`                | Deployment          | "azd up", "deploy", "go live"              |
| `apex-azure-diagnostics`           | `apex-azure-diagnostics/`           | Troubleshooting     | "troubleshoot", "KQL", "health check"      |
| `apex-python-diagrams`             | `apex-python-diagrams/`             | Document Creation   | "create chart", "WAF chart"                |
| `apex-mermaid`                     | `apex-mermaid/`                     | Document Creation   | "mermaid diagram", "flowchart"             |
| `apex-azure-kusto`                 | `apex-azure-kusto/`                 | Data & Analytics    | "KQL queries", "Azure Data Explorer"       |
| `apex-azure-prepare`               | `apex-azure-prepare/`               | Deployment          | "create app", "prepare Azure"              |
| `apex-azure-quotas`                | `apex-azure-quotas/`                | Capacity            | "check quotas", "service limits"           |
| `apex-azure-rbac`                  | `apex-azure-rbac/`                  | Identity            | "RBAC role", "least privilege"             |
| `apex-azure-resources`             | `apex-azure-resources/`             | Discovery           | "list resources", "resource diagram"       |
| `apex-azure-storage`               | `apex-azure-storage/`               | Storage             | "blob storage", "file shares"              |
| `apex-azure-validate`              | `apex-azure-validate/`              | Validation          | "validate app", "preflight checks"         |
| `apex-context-management`          | `apex-context-management/`          | Meta                | "context optimization", "compress context" |
| `apex-docs-writer`                 | `apex-docs-writer/`                 | Documentation       | "update docs", "check staleness"           |
| `apex-entra-app-registration`      | `apex-entra-app-registration/`      | Identity            | "app registration", "Entra ID"             |
| `apex-github-operations`           | `apex-github-operations/`           | Workflow            | "commit", "create issue", "create PR"      |
| `apex-golden-principles`           | `apex-golden-principles/`           | Meta                | "operating principles", "agent rules"      |
| `apex-iac-common`                  | `apex-iac-common/`                  | IaC Patterns        | "deploy patterns", "circuit breaker"       |
| `apex-microsoft-docs`              | `apex-microsoft-docs/`              | Documentation       | "Azure docs", "quickstart"                 |
| `apex-terraform-patterns`          | `apex-terraform-patterns/`          | IaC Patterns        | "terraform pattern", "AVM-TF", "HCL"       |
| `apex-terraform-search-import`     | `apex-terraform-search-import/`     | IaC Import          | "import resources", "terraform import"     |
| `apex-terraform-test`              | `apex-terraform-test/`              | IaC Testing         | "terraform test", ".tftest.hcl"            |
| `apex-workflow-engine`             | `apex-workflow-engine/`             | Workflow            | "workflow DAG", "step routing"             |

## Template Inventory

All in `.github/skills/apex-azure-artifacts/templates/`. Naming: `{step}-{name}.template.md`.
See `tools/registry/count-manifest.json` for canonical counts.

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

See `tools/registry/count-manifest.json` for canonical counts.

| Instruction                                    | Applies To (glob)                                               |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `agent-authoring.instructions.md`              | `**/*.agent.md, **/*.prompt.md`                                 |
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
                                  ├─ Diagrams (03-des-diagram.{py,png,svg})
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

| File                                          | Contains                                |
| --------------------------------------------- | --------------------------------------- |
| `site/src/content/docs/`                      | Published documentation pages           |
| `docs.instructions.md`                        | Site docs standards                     |
| `QUALITY_SCORE.md`                            | Project health grades (doc-gardening)   |
| `tools/tests/exec-plans/tech-debt-tracker.md` | Tech debt inventory                     |
| `VERSION.md`                                  | Canonical version number                |
| `CHANGELOG.md`                                | Release history                         |
| `README.md` (root)                            | Overview, project structure, tech stack |

## docs/ Folder Contents

| File                         | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `index.md`                   | Documentation hub / landing page                 |
| `quickstart.md`              | Getting started guide                            |
| `workflow.md`                | Detailed multi-step workflow reference           |
| `troubleshooting.md`         | Common issues and fixes                          |
| `dev-containers.md`          | Dev container setup                              |
| `faq.md`                     | Frequently asked questions                       |
| `e2e-testing.md`             | Workflow validation and E2E retirement notice    |
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

Skills are discovered from SKILL.md metadata and loaded on demand, not through
`tools:` arrays in agent definitions. Local prompt files are adapters; Agent Host
uses shared skills, which inherit the caller's model/tools rather than binding an
agent or granting permissions. Select the owning main agent before consequential work.
Legacy location/discovery settings are not a security boundary. Verify Local and
Agent Host discovery and routing separately; source checks do not certify runtime behavior.

### Agent-Referenced Skills

These skills are explicitly referenced in agent body text via mandatory
"Read skills FIRST" instructions:

| Skill               | Referenced By                                              |
| ------------------- | ---------------------------------------------------------- |
| `apex-azure-defaults`    | all primary agents                                         |
| `apex-azure-artifacts`   | requirements, architect, iac-planner, deploy, orchestrator |
| `apex-python-diagrams`   | architect, design, iac-planner, as-built agents             |
| `apex-azure-adr`         | design agent                                               |
| `apex-github-operations` | orchestrator, iac-planner agents                           |

### General-Purpose Skills

Discovered purely by prompt keyword matching — no agent explicitly
references them:

- `apex-docs-writer` — Triggered by "update docs", "check staleness" prompts
- `sensei` — Triggered by "run sensei", "improve skill", "fix frontmatter" prompts

### Instruction Files (Separate Mechanism)

Instruction files (`.github/instructions/*.instructions.md`) use frontmatter
`applyTo` globs, not `.gitattributes`. Authoring matches do not prove runtime
attachment: keep essential role, security, approval, output, and stop rules in
main agent bodies and explicitly load missing required guidance. Instructions
are file-type-scoped rules, not invokable skills; vendor-authoring references
are on-demand authoring/audit material, not automatic production reads.
