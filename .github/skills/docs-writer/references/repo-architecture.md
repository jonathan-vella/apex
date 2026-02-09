# Repo Architecture Reference

> For use by the `docs-writer` skill. Last verified: 2026-02-09.

## Workspace Root Structure

```text
azure-agentic-infraops/
├── .github/
│   ├── agents/              # 8 agent definitions + 3 subagents
│   │   ├── _shared/         # Shared context (defaults, styling, patterns)
│   │   └── _subagents/      # Validation subagents (lint, what-if, review)
│   ├── skills/              # 11 skill definitions (incl. docs-writer)
│   ├── instructions/        # 16 file-type instruction files
│   └── templates/           # 16 artifact templates + README
├── agent-output/{project}/  # Agent-generated artifacts (01-07)
├── docs/                    # User-facing documentation
│   ├── _superseded/         # Archived content (do not link)
│   ├── presenter/           # Presentation materials
│   └── testing/             # Test checklists
├── infra/bicep/             # Bicep module library
├── mcp/azure-pricing-mcp/   # Azure Pricing MCP server
├── scenarios/               # 9 demo scenarios (S01-S09)
├── scripts/                 # Validation and automation scripts
└── temp/                    # Scratch space (gitignored for outputs)
```

## Agent Inventory (8 Primary + 3 Subagents)

### Primary Agents

| Agent | File | Model | Step | Artifacts |
| --- | --- | --- | --- | --- |
| InfraOps Conductor | `infraops-conductor.agent.md` | Opus 4.6 | All | Orchestration |
| Requirements | `requirements.agent.md` | Opus 4.6 | 1 | `01-requirements.md` |
| Architect | `architect.agent.md` | Opus 4.6 | 2 | `02-architecture-assessment.md` |
| Design | `design.agent.md` | Sonnet 4.5 | 3 | `03-des-*.{py,png,md}` |
| Bicep Plan | `bicep-plan.agent.md` | Opus 4.6 | 4 | `04-implementation-plan.md` |
| Bicep Code | `bicep-code.agent.md` | Sonnet 4.5 | 5 | Bicep in `infra/bicep/` |
| Deploy | `deploy.agent.md` | Sonnet 4.5 | 6 | `06-deployment-summary.md` |
| Diagnose | `diagnose.agent.md` | Sonnet 4.5 | — | Diagnostic reports |

### Validation Subagents (in `_subagents/`)

| Subagent | File | Purpose |
| --- | --- | --- |
| bicep-lint-subagent | `bicep-lint-subagent.agent.md` | Syntax validation |
| bicep-whatif-subagent | `bicep-whatif-subagent.agent.md` | Deployment preview |
| bicep-review-subagent | `bicep-review-subagent.agent.md` | AVM code review |

### Shared Context (in `_shared/`)

| File | Purpose |
| --- | --- |
| `defaults.md` | Regions, tags, CAF naming, AVM standards, security |
| `documentation-styling.md` | Formatting conventions for agent output |
| `avm-pitfalls.md` | Common Azure Verified Module issues |
| `research-patterns.md` | How agents research before implementing |
| `service-lifecycle-validation.md` | Azure service retirement checks |

## Skill Catalog (11 Skills)

| Skill | Folder | Category | Triggers |
| --- | --- | --- | --- |
| `azure-adr` | `azure-adr/` | Document Creation | "create ADR", "document decision" |
| `azure-deployment-preflight` | `azure-deployment-preflight/` | Workflow | "validate deployment" |
| `azure-diagrams` | `azure-diagrams/` | Document Creation | "create diagram" |
| `azure-workload-docs` | `azure-workload-docs/` | Workflow | "generate documentation" |
| `docs-writer` | `docs-writer/` | Documentation | "update the docs" |
| `gh-cli` | `gh-cli/` | Tool Integration | "gh command" |
| `git-commit` | `git-commit/` | Tool Integration | "commit" |
| `github-issues` | `github-issues/` | Workflow | "create issue" |
| `github-pull-requests` | `github-pull-requests/` | Workflow | "create PR" |
| `make-skill-template` | `make-skill-template/` | Meta | "create skill" |
| `orchestration-helper` | `orchestration-helper/` | Meta | "how does conductor work" |

## Scenario Index (9 Scenarios)

| ID | Folder | Focus | Difficulty |
| --- | --- | --- | --- |
| S01 | `S01-bicep-baseline/` | Hub-spoke network (Bicep) | 🟢 Beginner |
| S02 | `S02-agentic-workflow/` | Full 7-step agentic flow | 🟡 Intermediate |
| S03 | `S03-documentation-generation/` | Workload documentation | 🟢 Beginner |
| S04 | `S04-service-validation/` | Deployment preflight | 🟢 Beginner |
| S05 | `S05-troubleshooting/` | Diagnose agent | 🟢 Beginner |
| S06 | `S06-sbom-generator/` | SBOM generation | 🟡 Intermediate |
| S07 | `S07-diagrams-as-code/` | Architecture diagrams | 🟡 Intermediate |
| S08 | `S08-coding-agent/` | GitHub Copilot coding agent | 🔴 Advanced |
| S09 | `S09-orchestration-test/` | Conductor orchestration | 🟡 Intermediate |

## Template Inventory (16 Templates)

All in `.github/templates/`. Naming: `{step}-{name}.template.md`.

| Template | Artifact | Validation |
| --- | --- | --- |
| `01-requirements.template.md` | Requirements | Standard (strict) |
| `02-architecture-assessment.template.md` | WAF Assessment | Standard (strict) |
| `03-des-cost-estimate.template.md` | Design Cost Estimate | Cost validator |
| `04-governance-constraints.template.md` | Governance | Standard (strict) |
| `04-implementation-plan.template.md` | Implementation Plan | Standard (strict) |
| `04-preflight-check.template.md` | Preflight Check | Standard (strict) |
| `05-implementation-reference.template.md` | Impl Reference | Relaxed |
| `06-deployment-summary.template.md` | Deploy Summary | Standard (strict) |
| `07-ab-cost-estimate.template.md` | As-Built Cost | Cost validator |
| `07-backup-dr-plan.template.md` | Backup/DR Plan | Relaxed |
| `07-compliance-matrix.template.md` | Compliance Matrix | Relaxed |
| `07-design-document.template.md` | Design Document | Relaxed |
| `07-documentation-index.template.md` | Doc Index | Relaxed |
| `07-operations-runbook.template.md` | Ops Runbook | Relaxed |
| `07-resource-inventory.template.md` | Resource Inventory | Relaxed |
| `PROJECT-README.template.md` | Project README | — |

## Instruction File Map (16 Files)

| Instruction | Applies To (glob) |
| --- | --- |
| `agent-research-first.instructions.md` | `**/*.agent.md` |
| `agent-skills.instructions.md` | `**/.github/skills/**/SKILL.md` |
| `agents-definitions.instructions.md` | `**/*.agent.md` |
| `artifact-generation.instructions.md` | `**/agent-output/**/*.md` |
| `artifact-h2-reference.instructions.md` | `**/agent-output/**/*.md` |
| `bicep-code-best-practices.instructions.md` | `**/*.bicep` |
| `copilot-thought-logging.instructions.md` | `**` |
| `cost-estimate.instructions.md` | `**/03-des-cost-estimate.md`, etc. |
| `docs.instructions.md` | `docs/**/*.md` |
| `github-actions.instructions.md` | `.github/workflows/*.yml` |
| `governance-discovery.instructions.md` | `**/04-governance-*.md` |
| `instructions.instructions.md` | `**/*.instructions.md` |
| `markdown.instructions.md` | `**/*.md` |
| `powershell.instructions.md` | `**/*.ps1`, `**/*.psm1` |
| `prompt.instructions.md` | `**/*.prompt.md` |
| `workload-documentation.instructions.md` | `**/agent-output/**/07-*.md` |

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
updating when agents, skills, or scenarios change:

| File | Contains |
| --- | --- |
| `docs/README.md` | Agent tables, skill tables, scenario table, structure tree |
| `docs.instructions.md` | Agent count/table, skill count/table |
| `scenarios/README.md` | Scenario index table |
| `VERSION.md` | Canonical version number |
| `CHANGELOG.md` | Release history |
| `README.md` (root) | Overview, project structure, tech stack |

## docs/ Folder Contents

| File | Purpose |
| --- | --- |
| `README.md` | Documentation hub with quick links |
| `quickstart.md` | 10-minute getting started guide |
| `workflow.md` | Detailed 7-step workflow reference |
| `copilot-tips.md` | Prompting best practices |
| `troubleshooting.md` | Common issues and fixes |
| `dev-containers.md` | Dev container setup |
| `terraform-roadmap.md` | Future Terraform support plans |
| `GLOSSARY.md` | Terms and definitions |
| `_superseded/` | Archived docs (do not link from live docs) |
| `presenter/` | Presentation materials (pptx, ROI, infographics) |
| `testing/` | Test checklists |

## Skill Discovery & Auto-Invocation

Skills are discovered by VS Code Copilot via **description keyword matching**
in the SKILL.md frontmatter — not through `tools:` arrays in agent definitions.

### Agent-Referenced Skills

These skills are explicitly mentioned in agent body text and invoked by name:

| Skill | Referenced By |
| --- | --- |
| `azure-diagrams` | design, architect agents |
| `azure-adr` | design agent |
| `azure-workload-docs` | deploy agent, conductor |
| `azure-deployment-preflight` | deploy agent |
| `orchestration-helper` | conductor agent |

### General-Purpose Skills

Discovered purely by prompt keyword matching — no agent explicitly
references them:

- `github-issues` — Triggered by "create issue", "file bug" prompts
- `github-pull-requests` — Triggered by "create PR", "pull request" prompts
- `gh-cli` — Triggered by "gh command", "GitHub CLI" prompts
- `git-commit` — Triggered by "commit", "git commit" prompts
- `docs-writer` — Triggered by "update docs", "check staleness" prompts
- `make-skill-template` — Triggered by "create skill", "new skill" prompts

### Instruction Files (Separate Mechanism)

Instruction files (`.github/instructions/*.instructions.md`) load automatically
via `.gitattributes` `applyTo` globs — this is a distinct mechanism from skill
discovery. Instructions are file-type-scoped rules, not invokable skills.
