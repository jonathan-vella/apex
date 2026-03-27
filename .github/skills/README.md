# Skills

This directory contains Agent Skills for GitHub Copilot. Skills are reusable,
domain-specific knowledge modules that activate automatically based on prompt keywords.

## Available Skills

> The tables below show representative skills by category. For the complete
> catalog, list all `SKILL.md` files: `find .github/skills -name SKILL.md`.
> See `.github/count-manifest.json` for current counts.

### Category 1: Azure Conventions

| Skill                  | Description                                          | Triggers                                         |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `azure-defaults`       | Azure conventions, naming, AVM, WAF, pricing, tags   | "azure defaults", "naming", "AVM"                |
| `azure-artifacts`      | Template H2 structures, styling, generation rules    | "generate documentation", "create runbook"       |
| `azure-bicep-patterns` | Reusable Bicep patterns (hub-spoke, PE, diagnostics) | "bicep pattern", "private endpoint", "hub-spoke" |
| `azure-diagnostics`    | KQL templates, health checks, remediation playbooks  | "diagnose", "troubleshoot", "health check"       |

### Category 2: Document Creation

| Skill             | Description                                              | Triggers                                  |
| ----------------- | -------------------------------------------------------- | ----------------------------------------- |
| `excalidraw`      | Hand-drawn whiteboarding, brainstorming, wireframes      | "whiteboard", "brainstorm", "sketch"      |
| `python-diagrams` | WAF/cost/compliance charts and Python diagrams           | "WAF chart", "cost chart", "create chart" |
| `mermaid`         | Inline Mermaid diagrams for markdown                     | "mermaid diagram", "flowchart"            |
| `drawio`          | Draw.io diagrams with Azure icon libraries               | "draw.io diagram"                         |
| `azure-adr`       | Create Architecture Decision Records with WAF mapping    | "create ADR", "document decision"         |

### Category 3: Workflow & Tool Integration

| Skill                 | Description                               | Triggers                            |
| --------------------- | ----------------------------------------- | ----------------------------------- |
| `github-operations`   | Branch naming, commits, PRs, CLI, Actions | "commit", "create PR", "gh command" |
| `docs-writer`         | Repo-aware documentation maintenance      | "update docs", "check staleness"    |
| `make-skill-template` | Create new skills from template           | "create skill", "new skill"         |

## Usage

### Automatic Activation

Skills activate when your prompt matches their trigger keywords:

```text
"Create an architecture diagram for the ecommerce project"
→ drawio skill activates
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
→ Uses drawio skill
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
