<!-- ref:custom-agents-v1 -->

# Custom Agents Reference

> Source: https://code.visualstudio.com/docs/copilot/customization/custom-agents
> Last verified: 2026-03-08

Custom agents (`.agent.md`) configure the AI to adopt different personas tailored
to specific development roles. Each agent has its own behavior, tools, and instructions.

## Purpose

- Specialized AI personas (security reviewer, planner, architect)
- Scoped tool access (read-only for planning, full editing for implementation)
- Multi-step workflows via handoffs between agents
- Subagent orchestration for complex tasks

## File Locations

| Scope                 | Location                                               |
| --------------------- | ------------------------------------------------------ |
| Workspace             | `.github/agents/` folder (auto-detected)               |
| Workspace (subagents) | `.github/agents/_subagents/` (convention in this repo) |
| User profile          | Agent files in user profile directory                  |
| Claude compat         | `.claude/agents/*.md` (plain `.md` files)              |

> VS Code detects any `.md` files in `.github/agents/` as custom agents.

## Frontmatter Schema

```yaml
---
name: Planner
description: Generate an implementation plan for new features
argument-hint: Describe the feature you want to plan
tools:
  - fetch
  - githubRepo
  - search
  - usages
agents: ["Researcher", "Implementer"]
model: ["Claude Opus 4.5", "GPT-5.2"]
user-invocable: true
disable-model-invocation: false
target: vscode
handoffs:
  - label: Implement Plan
    agent: agent
    prompt: Implement the plan outlined above.
    send: false
    model: GPT-5.2 (copilot)
---
```

### Core Fields

| Field           | Required | Description                                                                                              |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `name`          | No       | Display name. Defaults to filename.                                                                      |
| `description`   | No       | Brief description, shown as placeholder in chat input.                                                   |
| `argument-hint` | No       | Hint text shown in chat input after agent is selected.                                                   |
| `tools`         | No       | List of tool/tool-set names. Supports `<server>/*` for MCP.                                              |
| `agents`        | No       | List of agent names available as subagents. Use `*` for all, `[]` for none. Requires `agent` in `tools`. |
| `model`         | No       | Single model name (string) or prioritized list (array). Falls back in order.                             |

### Visibility and Invocation Fields

| Field                      | Default | Description                                                             |
| -------------------------- | ------- | ----------------------------------------------------------------------- |
| `user-invocable`           | `true`  | Show in agents dropdown in chat. Set `false` for subagent-only agents.  |
| `disable-model-invocation` | `false` | Prevent auto-invocation as subagent. Set `true` for manual-only agents. |

> **Deprecated**: `infer` — previously controlled both visibility and subagent availability.
> Use `user-invocable` and `disable-model-invocation` independently instead.

### Handoff Fields

| Field               | Required | Description                                      |
| ------------------- | -------- | ------------------------------------------------ |
| `handoffs[].label`  | Yes      | Button text shown after chat response            |
| `handoffs[].agent`  | Yes      | Target agent identifier                          |
| `handoffs[].prompt` | No       | Prompt text sent to target agent                 |
| `handoffs[].send`   | No       | Auto-submit the prompt (default: `false`)        |
| `handoffs[].model`  | No       | Model for handoff. Format: `Model Name (vendor)` |

### Other Fields

| Field         | Description                                             |
| ------------- | ------------------------------------------------------- |
| `target`      | Environment: `vscode` or `github-copilot`               |
| `mcp-servers` | MCP server config JSON for GitHub Copilot coding agents |

## Body Format

Markdown instructions prepended to every user prompt when this agent is selected.

- Reference files via Markdown links
- Reference tools via `#tool:<tool-name>` syntax
- Reference skills via "Read `.github/skills/{name}/SKILL.md`"

## Subagent Orchestration

Control which agents can be called as subagents using the `agents` property:

```yaml
# Allow specific subagents
agents: ['Researcher', 'Implementer']

# Allow all agents as subagents
agents: ['*']

# Prevent all subagent use
agents: []
```

The coordinating agent must include `agent` in its `tools` list for subagent invocation.

## Handoff Workflows

Handoffs create guided sequential workflows between agents:

```text
Planning Agent → [Implement Plan] → Implementation Agent → [Review Code] → Review Agent
```

Each handoff appears as a button after the chat response completes. Users approve
each transition before proceeding.

## Claude Agent Format

Files in `.claude/agents/` use plain `.md` files with different frontmatter:

| Field             | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `name`            | Agent name (required)                                     |
| `description`     | What the agent does                                       |
| `tools`           | Comma-separated string (e.g., `"Read, Grep, Glob, Bash"`) |
| `disallowedTools` | Comma-separated string of blocked tools                   |

VS Code maps Claude tool names to VS Code equivalents.

## This Repo's Examples

| File                                             | Name                | Purpose                                     |
| ------------------------------------------------ | ------------------- | ------------------------------------------- |
| `01-orchestrator.agent.md`                       | 01-Orchestrator     | Master orchestrator for multi-step workflow |
| `06b-bicep-codegen.agent.md`                     | 06b-Bicep CodeGen   | Bicep IaC code generation                   |
| `09-diagnose.agent.md`                           | 09-Diagnose         | Azure resource diagnostics                  |
| `_subagents/challenger-review-subagent.agent.md` | 10-Challenger (sub) | Adversarial review                          |
| `_subagents/cost-estimate-subagent.agent.md`     | Cost Estimate (sub) | Azure pricing queries                       |

**Convention in this repo**: Filenames use kebab-case; `name` frontmatter uses display-friendly casing.
Subagents live in `_subagents/` and typically set `user-invocable: false`.

See `.github/agents/` for the full roster and `.github/count-manifest.json` for current counts.

## Common Mistakes

| Mistake                                               | Fix                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Missing `agent` in tools when using `agents` property | Add `agent` to `tools` list                                  |
| Using deprecated `infer` field                        | Replace with `user-invocable` and `disable-model-invocation` |
| Tool not available at runtime                         | Tools silently ignored; verify tool names                    |
| YAML block scalar for `description`                   | Use inline string: `description: "..."`                      |
| Agent body > 350 lines                                | Move content to skills or instruction files                  |
| Confusing filename with display name                  | Filename = kebab-case; `name` = display casing               |

## Enforcement Rules

For THIS REPO's conventions on writing agent files, see:
`.github/instructions/agent-authoring.instructions.md` (auto-loaded for `**/*.agent.md`).

## Verify Freshness

```text
microsoft_docs_fetch("https://code.visualstudio.com/docs/copilot/customization/custom-agents")
```

Check for: new frontmatter fields, handoff schema changes, new agent file locations,
changes to Claude compatibility format, or new subagent features.
