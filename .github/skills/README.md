# Skills

This directory contains Agent Skills for GitHub Copilot. Skills are reusable,
domain-specific knowledge modules that activate automatically based on prompt keywords.

## Available Skills

### Category 1: Azure Conventions

| Skill            | Description                                         | Triggers                                   |
| ---------------- | --------------------------------------------------- | ------------------------------------------ |
| `azure-defaults` | Azure conventions, naming, AVM, WAF, pricing, tags  | "azure defaults", "naming", "AVM"          |
| `azure-artifacts` | Template H2 structures, styling, generation rules  | "generate documentation", "create runbook" |

### Category 2: Document Creation

| Skill            | Description                                           | Triggers                                 |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- |
| `azure-diagrams` | Generate Azure architecture diagrams (PNG via Python) | "create diagram", "architecture diagram" |
| `azure-adr`      | Create Architecture Decision Records with WAF mapping | "create ADR", "document decision"        |

### Category 3: Workflow & Tool Integration

| Skill                 | Description                                         | Triggers                                        |
| --------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `github-operations`   | GitHub issues, PRs, CLI, Actions, releases          | "create issue", "create PR", "gh command"       |
| `git-commit`          | Create conventional commit messages                 | "commit", "git commit"                          |
| `docs-writer`         | Repo-aware documentation maintenance                | "update docs", "check staleness"                |
| `make-skill-template` | Create new skills from template                     | "create skill", "new skill"                     |

## Usage

### Automatic Activation

Skills activate when your prompt matches their trigger keywords:

```text
"Create an architecture diagram for the ecommerce project"
→ azure-diagrams skill activates
```

### Explicit Invocation

Reference the skill by name for explicit activation:

```text
"Use the azure-adr skill to document our database decision"
```

### Via Agent Handoff

Agents can invoke skills through self-referencing handoffs:

```text
Architect agent → "▶ Generate Architecture Diagram" button
→ Uses azure-diagrams skill
```

## Skill vs Agent

| Aspect          | Agents                          | Skills                            |
| --------------- | ------------------------------- | --------------------------------- |
| **Invocation**  | `Ctrl+Shift+A` manual selection | Automatic or explicit             |
| **Scope**       | Workflow steps with handoffs    | Focused, single-purpose tasks     |
| **State**       | Conversational context          | Stateless                         |
| **When to use** | Multi-step processes            | Specific document/output creation |

## Creating New Skills

Use the `make-skill-template` skill or follow the structure in
[agent-skills.instructions.md](../instructions/agent-skills.instructions.md).

```text
"Create a new skill for generating cost reports"
→ make-skill-template skill guides you through creation
```
