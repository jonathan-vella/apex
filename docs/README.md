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

See the [conductor agent](../.github/agents/infraops-conductor.agent.md) for orchestration details.

## Quick Links

| Resource                              | Description                   |
| ------------------------------------- | ----------------------------- |
| [Quickstart](quickstart.md)           | Get running in 10 minutes     |
| [Workflow](workflow.md)               | 7-step agent + skill workflow |
| [Dev Containers](dev-containers.md)   | Docker setup and alternatives |
| [Prompt Guide](prompt-guide/)        | Agent & skill prompt examples |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions   |
| [Glossary](GLOSSARY.md)               | Terms and definitions         |

---

## Agents (8 + 3 Subagents)

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

## Skills (8)

Skills are reusable capabilities that agents invoke or that activate automatically based on prompts.

### Azure Conventions (Category 1)

| Skill            | Purpose                                      | Triggers                                      |
| ---------------- | -------------------------------------------- | --------------------------------------------- |
| `azure-defaults` | Azure conventions, naming, AVM, WAF, pricing | "azure defaults", "naming", "AVM"              |
| `azure-artifacts` | Template H2 structures, styling, generation | "generate documentation", "create runbook"     |

### Document Creation (Category 2)

| Skill            | Purpose                       | Triggers                                   |
| ---------------- | ----------------------------- | ------------------------------------------ |
| `azure-diagrams` | Python architecture diagrams  | "create diagram", "visualize architecture" |
| `azure-adr`      | Architecture Decision Records | "create ADR", "document decision"          |

### Workflow & Tool Integration (Category 3)

| Skill                 | Purpose                                       | Triggers                                      |
| --------------------- | --------------------------------------------- | --------------------------------------------- |
| `github-operations`   | GitHub issues, PRs, CLI, Actions, releases    | "create issue", "create PR", "gh command"     |
| `git-commit`          | Commit message conventions                    | "commit", "conventional commit"               |
| `docs-writer`         | Repo-aware docs maintenance                   | "audit docs", "fix counts", "freshness check" |
| `make-skill-template` | Create new skills                             | "create skill", "scaffold skill"              |

---

## 7-Step Workflow (with Conductor)

```
Requirements → Architecture → Design → Planning → Implementation → Deploy → Documentation
     ↓             ↓           ↓          ↓             ↓           ↓           ↓
   Agent        Agent       Skills     Agent         Agent       Agent       Skills
```

See [workflow.md](workflow.md) for detailed step-by-step guide.

---

## Prompt Guide

Learn how to interact with every agent and skill through ready-to-use
prompt examples in `docs/prompt-guide/`:

| Section | Content |
| --- | --- |
| 7-Step Workflow Prompts | Step-by-step examples for each agent |
| Standalone Agents | Conductor and Diagnose usage |
| Skill Reference | Independent skill invocation |
| Tips & Patterns | Advanced prompting techniques |

See [prompt-guide/](prompt-guide/) for the full guide.

---

## Project Structure

```
azure-agentic-infraops/
├── .github/
│   ├── agents/           # 8 agent definitions + 3 subagents
│   ├── skills/           # 8 skill definitions
│   └── instructions/     # File-type rules
├── agent-output/         # Generated artifacts
├── infra/bicep/          # Bicep templates
├── docs/prompt-guide/    # Prompt examples for agents & skills
└── docs/                 # This documentation
```

---

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/jonathan-vella/azure-agentic-infraops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jonathan-vella/azure-agentic-infraops/discussions)
- **Troubleshooting**: [troubleshooting.md](troubleshooting.md)
