<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Copilot Customization (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

- Deciding which customization mechanism fits a new requirement
- Creating a new customization file from scratch (need the frontmatter schema)
- Debugging why an instruction/skill/agent/prompt is not loading
- Reviewing a customization file for spec compliance
- Comparing mechanisms (instructions vs skills vs agents vs prompts)

> _See SKILL.md for full content._

## Quick Decision Tree

```text
I want to...
├── Define coding standards for ALL files
│   → .github/copilot-instructions.md (always-on)
│
├── Define rules for SPECIFIC file types (by glob)

> _See SKILL.md for full content._

## The 7 Customization Mechanisms

| #   | Mechanism               | File Type          | Loading           | Scope            | Portability                |
| --- | ----------------------- | ------------------ | ----------------- | ---------------- | -------------------------- |
| 1   | **Custom Instructions** | `.instructions.md` | Auto (glob match) | Workspace / User | VS Code                    |
| 2   | **Prompt Files**        | `.prompt.md`       | Manual (`/name`)  | Workspace / User | VS Code                    |
| 3   | **Custom Agents**       | `.agent.md`        | Manual (picker)   | Workspace / User | VS Code + GitHub           |
| 4   | **Agent Skills**        | `SKILL.md`         | Auto (on-demand)  | Workspace / User | Cross-agent standard       |

> _See SKILL.md for full content._

## Comparison: Instructions vs Skills vs Agents vs Prompts

| Dimension                  | Instructions           | Skills                         | Agents                 | Prompts                |
| -------------------------- | ---------------------- | ------------------------------ | ---------------------- | ---------------------- |
| **Purpose**                | Coding rules/standards | Specialized capabilities       | AI personas with tools | Reusable task commands |
| **Contains tools?**        | No                     | No (references only)           | Yes (tool list)        | Yes (tool list)        |
| **Always loaded?**         | Yes (via glob)         | No (on-demand)                 | No (manual select)     | No (manual `/invoke`)  |
| **Can include scripts?**   | No                     | Yes (`scripts/`)               | No                     | No                     |

> _See SKILL.md for full content._

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
| `agent-authoring.instructions.md`      | `**/*.agent.md, **/*.prompt.md` | Agent authoring standards            |
| `agent-skills.instructions.md`         | `**/.github/skills/**/SKILL.md` | Skill frontmatter, body limits           |

> _See SKILL.md for full content._
```
