<a id="top"></a>

# Agentic InfraOps Documentation

> Azure infrastructure engineered by AI agents and skills | [Current Version](../VERSION.md)

Transform Azure infrastructure requirements into deploy-ready IaC code (Bicep or Terraform)
using coordinated AI agents and reusable skills, aligned with Azure Well-Architected
Framework (WAF) and Azure Verified Modules (AVM).

## What's New: Dual IaC Track + Challenger Agent

The project now supports **two parallel IaC tracks** — Bicep and Terraform — sharing
common requirements, architecture, and design steps (1-3) before diverging into
track-specific planning, code generation, and deployment (steps 4-6).

- **Dual IaC Track**: Choose Bicep or Terraform at requirements time; the Conductor routes automatically
- **3 Terraform Agents**: `terraform-planner`, `terraform-codegen`, `terraform-deploy`
- **3 Terraform Subagents**: `terraform-lint`, `terraform-review`, `terraform-plan` (preview)
- **Challenger Agent**: Adversarial reviewer that challenges requirements, architecture, and plans
- **5 MCP Servers**: Azure, Pricing, Terraform, GitHub, Microsoft Learn
- **Skills GA**: 20 skills with enhanced discovery (including `terraform-patterns`,
  `context-optimizer`, `golden-principles`, `workflow-engine`, `context-shredding`)

See the [conductor agent](../.github/agents/01-conductor.agent.md) for orchestration details.

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Quick Links

| Resource                              | Description                   |
| ------------------------------------- | ----------------------------- |
| [Quickstart](quickstart.md)           | Get running in 10 minutes     |
| [Workflow](workflow.md)               | 7-step agent + skill workflow |
| [Dev Containers](dev-containers.md)   | Docker setup and alternatives |
| [Prompt Guide](prompt-guide/)         | Agent & skill prompt examples |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions   |
| [Glossary](GLOSSARY.md)               | Terms and definitions         |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Agents (15 + 9 Subagents)

Agents are interactive AI assistants for specific workflow phases. Invoke via `Ctrl+Shift+A`.

### Conductor (Master Orchestrator)

| Agent                   | Persona    | Purpose                                                    |
| ----------------------- | ---------- | ---------------------------------------------------------- |
| `InfraOps Conductor`    | 🎼 Maestro | Orchestrates all 7 steps with mandatory approval gates     |
| `Conductor (Fast Path)` | 🎼 Express | Streamlined 5-step path for simple projects (≤3 resources) |

### Primary Agents (user-invocable)

Steps 1-3 and 7 are shared. Steps 4-6 have Bicep and Terraform variants.

| Agent               | Persona       | Phase | Purpose                            |
| ------------------- | ------------- | ----- | ---------------------------------- |
| `requirements`      | 📜 Scribe     | 1     | Gather infrastructure requirements |
| `architect`         | 🏛️ Oracle     | 2     | WAF assessment and design          |
| `design`            | 🎨 Artisan    | 3     | Diagrams and ADRs                  |
| `bicep-planner`     | 📐 Strategist | 4b    | Bicep implementation planning      |
| `terraform-planner` | 📐 Strategist | 4t    | Terraform implementation planning  |
| `bicep-codegen`     | ⚒️ Forge      | 5b    | Bicep template generation          |
| `terraform-codegen` | ⚒️ Forge      | 5t    | Terraform config generation        |
| `bicep-deploy`      | 🚀 Envoy      | 6b    | Bicep deployment                   |
| `terraform-deploy`  | 🚀 Envoy      | 6t    | Terraform deployment               |
| `as-built`          | 📚 Archivist  | 7     | As-built documentation suite       |

### Standalone Agents

| Agent               | Persona       | Purpose                                        |
| ------------------- | ------------- | ---------------------------------------------- |
| `challenger`        | ⚔️ Challenger | Adversarial review of requirements and plans   |
| `diagnose`          | 🔍 Sentinel   | Post-deployment diagnostics                    |
| `context-optimizer` | 🔬 Optimizer  | Context window audit and token waste reduction |

### Validation Subagents (Conductor-Invoked)

**Shared:**

| Subagent                        | Purpose                         | Returns                     |
| ------------------------------- | ------------------------------- | --------------------------- |
| `cost-estimate-subagent`        | Azure Pricing MCP queries       | Cost breakdown              |
| `governance-discovery-subagent` | Azure Policy REST API discovery | Governance constraints JSON |
| `challenger-review-subagent`    | Adversarial artifact review     | Challenge findings JSON     |

**Bicep track:**

| Subagent                | Purpose                               | Returns                        |
| ----------------------- | ------------------------------------- | ------------------------------ |
| `bicep-lint-subagent`   | Bicep syntax validation               | PASS/FAIL with diagnostics     |
| `bicep-whatif-subagent` | Deployment preview (what-if analysis) | Change summary, violations     |
| `bicep-review-subagent` | Code review against AVM standards     | APPROVED/NEEDS_REVISION/FAILED |

**Terraform track:**

| Subagent                    | Purpose                                    | Returns                        |
| --------------------------- | ------------------------------------------ | ------------------------------ |
| `terraform-lint-subagent`   | Terraform syntax validation (validate/fmt) | PASS/FAIL with diagnostics     |
| `terraform-plan-subagent`   | Deployment preview (terraform plan)        | Change summary, destroy flags  |
| `terraform-review-subagent` | Code review against AVM-TF standards       | APPROVED/NEEDS_REVISION/FAILED |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Skills (20)

Skills are reusable capabilities that agents invoke or that activate automatically based on prompts.

### Azure Conventions (Category 1)

| Skill               | Purpose                                              | Triggers                                    |
| ------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `azure-defaults`    | Azure conventions, naming, AVM, WAF, pricing         | "azure defaults", "naming", "AVM"           |
| `azure-artifacts`   | Template H2 structures, styling, generation          | "generate documentation", "create runbook"  |
| `golden-principles` | 10 invariants governing agent behaviour in this repo | "golden principles", "operating principles" |

### Document Creation (Category 2)

| Skill            | Purpose                       | Triggers                                   |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `azure-diagrams` | Python architecture diagrams  | "create diagram", "visualize architecture" |
| `azure-adr`      | Architecture Decision Records | "create ADR", "document decision"          |

### Infrastructure Patterns (Category 3)

| Skill                  | Purpose                                    | Triggers                                         |
| ---------------------- | ------------------------------------------ | ------------------------------------------------ |
| `azure-bicep-patterns` | Reusable Bicep infrastructure patterns     | "bicep pattern", "hub-spoke", "private endpoint" |
| `terraform-patterns`   | Reusable Terraform infrastructure patterns | "terraform pattern", "AVM-TF", "HCL"             |
| `iac-common`           | Shared IaC patterns for deploy + review    | "deploy pattern", "CLI auth", "known issues"     |

### Workflow & Tool Integration (Category 4)

| Skill                 | Purpose                                    | Triggers                                      |
| --------------------- | ------------------------------------------ | --------------------------------------------- |
| `github-operations`   | GitHub issues, PRs, CLI, Actions, releases | "create issue", "create PR", "gh command"     |
| `git-commit`          | Commit message conventions                 | "commit", "conventional commit"               |
| `docs-writer`         | Repo-aware docs maintenance                | "audit docs", "fix counts", "freshness check" |
| `make-skill-template` | Create new skills                          | "create skill", "scaffold skill"              |
| `session-resume`      | Session state tracking and resume protocol | "resume", "session state", "checkpoint"       |
| `workflow-engine`     | Workflow DAG for the 7-step agent pipeline | "workflow graph", "step routing", "DAG"       |

### Troubleshooting (Category 5)

| Skill                   | Purpose                      | Triggers                          |
| ----------------------- | ---------------------------- | --------------------------------- |
| `azure-troubleshooting` | KQL templates, health checks | "troubleshoot", "diagnose", "KQL" |

### Agent Optimization (Category 7)

| Skill               | Purpose                                     | Triggers                                              |
| ------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `context-optimizer` | Context window audit, token waste reduction | "optimize context", "audit tokens", "profile latency" |
| `context-shredding` | Runtime context compression (3 tiers)       | "compress context", "context budget", "shred"         |

### Microsoft Docs Integration (Category 6)

| Skill                      | Purpose                               | Triggers                                     |
| -------------------------- | ------------------------------------- | -------------------------------------------- |
| `microsoft-docs`           | Query official Microsoft docs         | "microsoft docs", "azure docs", "learn"      |
| `microsoft-code-reference` | SDK method verification, code samples | "SDK", "API reference", "code sample"        |
| `microsoft-skill-creator`  | Create skills for Microsoft tech      | "create microsoft skill", "technology skill" |

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## 7-Step Workflow (with Conductor)

```text
Requirements → Architecture → Design → Planning → Implementation → Deploy → Documentation
     ↓             ↓           ↓          ↓             ↓           ↓           ↓
   Agent        Agent       Skills     Agent         Agent       Agent       Skills
```

See [workflow.md](workflow.md) for detailed step-by-step guide.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Prompt Guide

Learn how to interact with every agent and skill through ready-to-use
prompt examples in `docs/prompt-guide/`:

| Section                 | Content                              |
| ----------------------- | ------------------------------------ |
| 7-Step Workflow Prompts | Step-by-step examples for each agent |
| Standalone Agents       | Conductor and Diagnose usage         |
| Skill Reference         | Independent skill invocation         |
| Tips & Patterns         | Advanced prompting techniques        |

See [prompt-guide/](prompt-guide/) for the full guide.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Project Structure

```text
azure-agentic-infraops/
├── .github/
│   ├── agents/           # 15 agent definitions + 9 subagents
│   │   └── _subagents/   # Validation subagents (Bicep + Terraform)
│   ├── skills/           # 20 skill definitions
│   └── instructions/     # File-type rules (26 instruction files)
├── agent-output/         # Generated artifacts per project
├── infra/
│   ├── bicep/            # Bicep templates by project
│   └── terraform/        # Terraform configurations by project
├── mcp/azure-pricing-mcp/  # Custom Azure Pricing MCP server
├── docs/prompt-guide/    # Prompt examples for agents & skills
└── docs/                 # This documentation
```

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Project Health

| Resource                                                           | Purpose                                         |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| [QUALITY_SCORE.md](../QUALITY_SCORE.md)                            | Per-domain grades updated by doc-gardening      |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md) | Running inventory of known gaps and debt        |
| [exec-plans/](exec-plans/)                                         | Multi-step execution plans and decision history |

Run the doc-gardening prompt (`.github/prompts/doc-gardening.prompt.md`) to refresh grades.

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" alt="section divider" width="100%">
<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
