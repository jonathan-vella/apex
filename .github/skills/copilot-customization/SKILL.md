---
name: copilot-customization
description: "Authoritative reference for VS Code Copilot customization mechanisms: instructions, prompt files, custom agents, agent skills, MCP servers, hooks, and plugins. Use when deciding which customization type to use, creating new .instructions.md/.prompt.md/.agent.md/SKILL.md/mcp.json files from scratch, or debugging why a customization is not loading. DO NOT USE FOR: routine file edits where the format is already known."
license: MIT
---

# Copilot Customization

Quick-reference for the full VS Code GitHub Copilot customization surface.
Deep-dive content lives in `references/` — load on demand, not all at once.

---

## When to Use This Skill

- Deciding which customization mechanism fits a new requirement
- Creating a new customization file from scratch (need the frontmatter schema)
- Debugging why an instruction/skill/agent/prompt is not loading
- Reviewing a customization file for spec compliance
- Comparing mechanisms (instructions vs skills vs agents vs prompts)

**Do NOT load this skill** for routine edits to existing files where you already know the format.
For enforcement rules, use the instruction files directly (they auto-load via `applyTo` globs).

## Quick Decision Tree

```text
I want to...
├── Define coding standards for ALL files
│   → .github/copilot-instructions.md (always-on)
│
├── Define rules for SPECIFIC file types (by glob)
│   → .instructions.md with applyTo (auto-loaded when files match)
│
├── Store reference content agents read ON DEMAND (not always-on)
│   → SKILL.md with references/ directory
│
├── Create a reusable task I invoke manually with /name
│   → .prompt.md (slash command)
│
├── Create a specialized AI persona with its own tools
│   → .agent.md (custom agent)
│
├── Connect to external tools, APIs, or databases
│   → mcp.json (MCP server)
│
├── Run code at agent lifecycle points (block tools, auto-format)
│   → hooks/*.json (Preview — verify with live docs)
│
└── Bundle multiple customizations for distribution
    → agent plugin (Preview — verify with live docs)
```

## The 7 Customization Mechanisms

| #   | Mechanism               | File Type          | Loading           | Scope            | Portability                |
| --- | ----------------------- | ------------------ | ----------------- | ---------------- | -------------------------- |
| 1   | **Custom Instructions** | `.instructions.md` | Auto (glob match) | Workspace / User | VS Code                    |
| 2   | **Prompt Files**        | `.prompt.md`       | Manual (`/name`)  | Workspace / User | VS Code                    |
| 3   | **Custom Agents**       | `.agent.md`        | Manual (picker)   | Workspace / User | VS Code + GitHub           |
| 4   | **Agent Skills**        | `SKILL.md`         | Auto (on-demand)  | Workspace / User | Cross-agent standard       |
| 5   | **MCP Servers**         | `mcp.json`         | Auto (on start)   | Workspace / User | MCP standard               |
| 6   | **Hooks**               | `*.json`           | Auto (on event)   | Workspace / User | VS Code + Claude (Preview) |
| 7   | **Agent Plugins**       | marketplace        | Auto (on install) | User             | VS Code + CLI (Preview)    |

## Comparison: Instructions vs Skills vs Agents vs Prompts

| Dimension                  | Instructions           | Skills                         | Agents                 | Prompts                |
| -------------------------- | ---------------------- | ------------------------------ | ---------------------- | ---------------------- |
| **Purpose**                | Coding rules/standards | Specialized capabilities       | AI personas with tools | Reusable task commands |
| **Contains tools?**        | No                     | No (references only)           | Yes (tool list)        | Yes (tool list)        |
| **Always loaded?**         | Yes (via glob)         | No (on-demand)                 | No (manual select)     | No (manual `/invoke`)  |
| **Can include scripts?**   | No                     | Yes (`scripts/`)               | No                     | No                     |
| **Can include resources?** | No                     | Yes (`references/`, `assets/`) | No                     | No                     |
| **Context cost**           | ~300-600 tok (est.)    | ~500-2000 tok (est.)           | ~500-1500 tok (est.)   | ~200-500 tok (est.)    |
| **Portability**            | VS Code only           | Open standard                  | VS Code + GitHub       | VS Code only           |

> Token estimates are approximate. Run the `context-optimizer` skill for measured profiling.

## How They Interact

1. **Tool list priority**: Prompt tools > Agent tools > Default agent tools
2. **Instruction combining**: Multiple instruction files are merged (no guaranteed order)
3. **Skill progressive loading**: Discovery (name+description) → Instructions (SKILL.md body) → Resources (references/)
4. **Agent + Skill**: Agents can reference skills via "Read `.github/skills/{name}/SKILL.md`"
5. **MCP tools**: Available to agents and prompts via their `tools` list

## Existing Enforcement Rules

These instruction files auto-load for matching files. This skill references but does NOT duplicate them:

| Instruction File                       | Glob                            | Enforces                                 |
| -------------------------------------- | ------------------------------- | ---------------------------------------- |
| `agent-authoring.instructions.md`      | `**/*.agent.md, **/*.prompt.md` | Agent authoring standards                |
| `agent-skills.instructions.md`         | `**/.github/skills/**/SKILL.md` | Skill frontmatter, body limits           |
| `instructions.instructions.md`         | `**/*.instructions.md`          | Instruction file format, `applyTo` rules |
| `agent-research-first.instructions.md` | Agents, output, skills          | Research-before-implementation mandate   |
| `context-optimization.instructions.md` | Agents, skills, instructions    | Context budget, hand-off rules           |

## Reference Index

Load only the reference file relevant to your current task:

| Reference                                                   | When to Load                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| [custom-instructions.md](references/custom-instructions.md) | Creating/debugging `.instructions.md` or `copilot-instructions.md` |
| [prompt-files.md](references/prompt-files.md)               | Creating/debugging `.prompt.md` files                              |
| [custom-agents.md](references/custom-agents.md)             | Creating/debugging `.agent.md` files                               |
| [agent-skills.md](references/agent-skills.md)               | Creating/debugging `SKILL.md` files                                |
| [mcp-servers.md](references/mcp-servers.md)                 | Configuring `mcp.json` or MCP servers                              |
| [hooks.md](references/hooks.md)                             | Working with agent hooks (Preview)                                 |
| [agent-plugins.md](references/agent-plugins.md)             | Working with agent plugins (Preview)                               |

> **Do NOT load all references.** Most tasks need only 1-2 reference files.
> Decision tree questions and mechanism comparisons can be answered from this SKILL.md alone.

## Freshness

Content sourced from official VS Code docs (2026-03-08). Each reference file includes
a "Verify Freshness" section with the URL to check for updates.
Freshness checks are part of the Quarterly Context Audit in `AGENTS.md`.
