# Agentic InfraOps Documentation

> Azure infrastructure engineered by AI agents and skills | [Current Version](../VERSION.md)

Transform Azure infrastructure requirements into deploy-ready Bicep code using coordinated
AI agents and reusable skills, aligned with Azure Well-Architected Framework (WAF) and
Azure Verified Modules (AVM).

## What's New: VS Code 1.109 Agent Orchestration

This project now implements the **Conductor pattern** from VS Code 1.109:

- **InfraOps Conductor**: Master orchestrator with mandatory human approval gates
- **Validation Subagents**: TDD-style Bicep validation (lint → what-if → review)
- **New Frontmatter**: `user-invokable`, `agents` list, model fallbacks
- **Skills GA**: Skills are now generally available with enhanced discovery

See [orchestration-helper skill](../.github/skills/orchestration-helper/SKILL.md) for details.

## Quick Links

| Resource                              | Description                   |
| ------------------------------------- | ----------------------------- |
| [Quickstart](quickstart.md)           | Get running in 10 minutes     |
| [Workflow](workflow.md)               | 7-step agent + skill workflow |
| [Dev Containers](dev-containers.md)   | Docker setup and alternatives |
| [Copilot Tips](copilot-tips.md)       | Best practices for prompting  |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions   |
| [Glossary](GLOSSARY.md)               | Terms and definitions         |
| [Scenarios](../scenarios/)            | Hands-on learning             |

---

## Agents (7 + 3 Subagents)

Agents are interactive AI assistants for specific workflow phases. Invoke via `Ctrl+Shift+A`.

### Conductor (Master Orchestrator)

| Agent | Persona | Purpose |
|-------|---------|---------|
| `InfraOps Conductor` | 🎼 Maestro | Orchestrates all 7 steps with mandatory approval gates |

### Primary Agents (User-Invokable)

| Agent | Persona | Phase | Purpose |
|-------|---------|-------|---------|
| `requirements` | 📜 Scribe | 1 | Gather infrastructure requirements |
| `architect` | 🏛️ Oracle | 2 | WAF assessment and design |
| `design` | 🎨 Artisan | 3 | Diagrams and ADRs |
| `bicep-plan` | 📐 Strategist | 4 | Implementation planning |
| `bicep-code` | ⚒️ Forge | 5 | Bicep template generation |
| `deploy` | 🚀 Envoy | 6 | Azure deployment |
| `diagnose` | 🔍 Sentinel | — | Post-deployment diagnostics |

### Validation Subagents (Conductor-Invoked)

| Subagent               | Purpose                                | Returns                    |
| ---------------------- | -------------------------------------- | -------------------------- |
| `bicep-lint-subagent`   | Bicep syntax validation                | PASS/FAIL with diagnostics |
| `bicep-whatif-subagent` | Deployment preview (what-if analysis)  | Change summary, violations |
| `bicep-review-subagent` | Code review against AVM standards      | APPROVED/NEEDS_REVISION/FAILED |

---

## Skills (10)

Skills are reusable capabilities that agents invoke or that activate automatically based on prompts.

### Document Creation (Category 1)

| Skill            | Purpose                       | Triggers                                   |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `azure-diagrams` | Python architecture diagrams  | "create diagram", "visualize architecture" |
| `azure-adr`      | Architecture Decision Records | "create ADR", "document decision"          |

### Workflow Automation (Category 2)

| Skill                        | Purpose                          | Triggers                                   |
| ---------------------------- | -------------------------------- | ------------------------------------------ |
| `azure-workload-docs`        | 7 documentation types (07-\*.md) | "generate documentation", "create runbook" |
| `azure-deployment-preflight` | Pre-deployment validation        | "validate deployment", "preflight check"   |
| `github-issues`              | GitHub issue management          | "create issue", "file bug"                 |
| `github-pull-requests`       | Pull request management          | "create PR", "merge pull request"          |

### Tool Integration (Category 3)

| Skill                 | Purpose                         | Triggers                                      |
| --------------------- | ------------------------------- | --------------------------------------------- |
| `gh-cli`              | GitHub CLI reference            | "gh command", "github cli"                    |
| `git-commit`          | Commit message conventions      | "commit", "conventional commit"               |
| `make-skill-template` | Create new skills               | "create skill", "scaffold skill"              |
| `orchestration-helper`| Conductor pattern documentation | "how does conductor work", "agent orchestration" |

---

## 7-Step Workflow (with Conductor)

```
Requirements → Architecture → Design → Planning → Implementation → Deploy → Documentation
     ↓             ↓           ↓          ↓             ↓           ↓           ↓
   Agent        Agent       Skills     Agent         Agent       Agent       Skills
```

See [workflow.md](workflow.md) for detailed step-by-step guide.

---

## Scenarios

Practice with hands-on scenarios in `scenarios/`:

| Scenario                     | Focus                     | Time   |
| ---------------------------- | ------------------------- | ------ |
| S01-bicep-baseline           | Hub-spoke network         | 30 min |
| S02-agentic-workflow         | Full 7-step flow          | 60 min |
| S03-documentation-generation | Workload docs             | 30 min |
| S04-service-validation       | Deployment preflight      | 20 min |
| S05-troubleshooting          | Diagnose agent            | 20 min |
| S07-diagrams-as-code         | Architecture diagrams     | 30 min |
| S08-coding-agent             | GitHub Copilot agent      | 45 min |
| S09-skill-migration          | Agent to skill conversion | 30 min |

---

## Project Structure

```
azure-agentic-infraops/
├── .github/
│   ├── agents/           # 6 agent definitions
│   ├── skills/           # 9 skill definitions
│   ├── instructions/     # File-type rules
│   └── templates/        # Output templates
├── agent-output/         # Generated artifacts
├── infra/bicep/          # Bicep templates
├── scenarios/            # Hands-on learning
└── docs/                 # This documentation
```

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)
