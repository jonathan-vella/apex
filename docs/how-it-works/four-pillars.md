---
toc_depth: 3
---

# :material-pillar: Core Concepts

The system's knowledge architecture is built on four distinct layers, each serving
a specific purpose in the agent's context window.

## :material-robot-outline: 1. Agents

**What they are**: Agent definitions (`.agent.md` files) define a specialised AI persona
with a specific role, allowed tools, handoff targets, and a body of instructions.

**Where they live**: `.github/agents/` (top-level) and `.github/agents/_subagents/`

**How they work**: Each agent file contains YAML frontmatter (name, description, model,
tools, handoffs) and a markdown body with the agent's operating instructions. When a user
invokes an agent in VS Code Copilot Chat, the entire body becomes part of the system prompt.

**Key constraint**: Agent bodies are limited to 350 lines to preserve context window space.
Heavy knowledge is externalised into skills and loaded on demand.

!!! info "Context Budget"

    Every token counts. Agent bodies stay under 350 lines; deep knowledge lives in
    skills and is loaded progressively only when needed.

## :material-book-open-variant: 2. Skills

**What they are**: Reusable domain knowledge packages that agents load when they need
specialised context.

**Where they live**: `.github/skills/{name}/SKILL.md` with optional `references/` and
`templates/` subdirectories.

**How they work**: An agent's body contains explicit `Read .github/skills/{name}/SKILL.md`
directives. The `SKILL.md` file provides a compact overview (under 500 lines), and heavy
reference material is stored in subdirectories, loaded only when the agent's task demands it.

**Key constraint**: Skills implement progressive disclosure — agents start with the overview
and drill into `references/` only when needed.

## :material-file-document-outline: 3. Instructions

**What they are**: Enforcement rules that apply automatically based on file type. Unlike
skills (which must be explicitly read), instructions are injected into context whenever
a matching file is opened or edited.

**Where they live**: `.github/instructions/{name}.instructions.md`

**How they work**: Each instruction file has YAML frontmatter with a `description` and
an `applyTo` glob pattern. When an agent works with a file matching the pattern, the
instruction is automatically loaded. For example, `bicep-code-best-practices.instructions.md`
applies to `**/*.bicep` and enforces AVM-first patterns, security baselines, and unique
suffix conventions.

**Key constraint**: Instruction files are limited to 150 lines and use narrow glob patterns.
`applyTo: "**"` is reserved for truly universal rules only.

## :material-database-cog-outline: 4. Configuration Registries

**What they are**: Machine-readable JSON files that provide runtime configuration for
the agent system.

**Where they live**: `.github/` root and within skills.

| Registry       | Path                                                           | Purpose                                   |
| -------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Agent Registry | `.github/agent-registry.json`                                  | Agent role → file, model, required skills |
| Skill Affinity | `.github/skill-affinity.json`                                  | Agent → skill weights (primary/secondary) |
| Workflow Graph | `.github/skills/workflow-engine/templates/workflow-graph.json` | 8-step DAG with nodes, edges, conditions  |

## AGENTS.md — The Table of Contents

Following the Harness Engineering principle of "map, not manual," the root `AGENTS.md`
serves as the entry point for all agents. At approximately 250 lines, it provides:

- **Setup commands**: How to clone, install dependencies, and open the dev container
- **Build and validation commands**: The complete `npm run` command reference
- **Code style conventions**: CAF naming prefixes, required tags, default regions, AVM-first rules
- **Security baseline**: Non-negotiable security requirements for all generated infrastructure
- **Testing procedures**: How to validate before committing
- **Commit conventions**: Conventional commit format with scopes
- **Project structure**: Directory layout overview
- **Workflow summary**: The 8-step table

`AGENTS.md` does not contain deep architectural guidance, Azure service details, or
template structures. Those are delegated to skills.

## copilot-instructions.md — The VS Code Bridge

The `.github/copilot-instructions.md` file is VS Code Copilot's orchestration layer.
It provides:

- **Quick start**: How to enable subagents and invoke the Conductor
- **8-step workflow table**: Quick reference for which agent handles which step
- **Skills catalog**: Table mapping skill names to their purposes
- **Chat triggers**: Rules for handling `gh` commands via GitHub operations
- **Key files**: Table mapping critical paths to their purposes
- **Conventions**: Pointers to skill files for detailed Azure and Terraform conventions

This file is shorter than `AGENTS.md` and focused on VS Code-specific orchestration
concerns rather than repository-wide conventions.

## :material-tools: Tools and MCP Servers

Agents do not call cloud APIs or execute commands directly. Instead, they invoke
**tools** — structured interfaces provided by the Model Context Protocol (MCP)
and the VS Code runtime. Tools give agents real-time access to external systems:

- **MCP tools**: JSON-RPC endpoints that wrap cloud APIs. Each MCP server provides
  a set of typed tools (e.g. `azure_price_search`, `azure_cost_estimate`) that agents
  discover and call at runtime. The server handles authentication, caching, pagination,
  and response formatting.
- **VS Code tools**: Built-in capabilities like file reads/writes, terminal commands,
  search, and subagent invocation.
- **Handoffs**: Agents delegate to the next step by writing artifact files to
  `agent-output/{project}/`. The next agent reads those files as input — there is no
  direct message passing between agents.

This project integrates four MCP servers:

| Server            | Purpose                            | Transport          |
| ----------------- | ---------------------------------- | ------------------ |
| **GitHub MCP**    | Issues, PRs, code search, branches | HTTP (Copilot API) |
| **Azure MCP**     | RBAC-aware Azure Resource Manager  | VS Code extension  |
| **Azure Pricing** | Cost estimation (13 tools)         | stdio (Python)     |
| **Terraform MCP** | Provider/module registry lookups   | stdio (Go)         |

[:octicons-arrow-right-24: MCP Integration details](mcp-integration.md)

---

!!! tip "Further Reading"

    - [Agent Architecture](agents.md) — 16 top-level agents, 11 subagents, the Challenger pattern
    - [Skills & Instructions](skills-and-instructions.md) — progressive loading, glob-based enforcement
    - [Workflow Engine & Quality](workflow-engine.md) — DAG model, approval gates, validators
    - [MCP Integration](mcp-integration.md) — four MCP servers and their tool catalogs
