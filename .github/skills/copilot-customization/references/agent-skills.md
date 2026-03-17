<!-- ref:agent-skills-v1 -->

# Agent Skills Reference

> Source: https://code.visualstudio.com/docs/copilot/customization/agent-skills
> Last verified: 2026-03-08

Agent Skills are folders of instructions, scripts, and resources that Copilot loads
when relevant. Skills are an open standard (https://agentskills.io) that works across
VS Code, Copilot CLI, and GitHub Copilot coding agent.

## Purpose

- Specialize Copilot for domain-specific tasks without repeating context
- Bundle instructions with scripts, examples, and resources
- Progressive loading — only relevant content enters the context window
- Portable across multiple AI agents (not VS Code-specific)

## Skills vs Instructions

| Dimension       | Skills                              | Instructions                      |
| --------------- | ----------------------------------- | --------------------------------- |
| **Loading**     | On-demand (when relevant)           | Always (via glob match)           |
| **Content**     | Instructions + scripts + resources  | Instructions only                 |
| **Portability** | Open standard (cross-agent)         | VS Code-specific                  |
| **Use for**     | Specialized capabilities, workflows | Coding standards, file-type rules |

## File Locations

| Type            | Location                                                       |
| --------------- | -------------------------------------------------------------- |
| Project skills  | `.github/skills/`, `.claude/skills/`, `.agents/skills/`        |
| Personal skills | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` |

**Setting**: `chat.agentSkillsLocations` controls additional search paths.

## Directory Structure

```text
.github/skills/<skill-name>/
├── SKILL.md              # Required — main instructions (≤500 lines)
├── LICENSE.txt            # Optional — license terms
├── scripts/              # Executable automation (loaded when executed)
├── references/           # Documentation (loaded when referenced by SKILL.md)
├── assets/               # Static files used AS-IS (not loaded into context)
└── templates/            # Starter code the agent MODIFIES and builds upon
```

**Key distinction**: `assets/` = used as-is in output; `templates/` = agent reads and modifies.

## Frontmatter Schema

```yaml
---
name: webapp-testing
description: "Guide for testing web applications using Playwright. Use when asked to create or run browser-based tests, debug UI behavior, or capture screenshots."
license: MIT
---
```

| Field         | Required | Constraints                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `name`        | **Yes**  | Lowercase, hyphens for spaces. Must match parent directory name. Max 64 chars. |
| `description` | **Yes**  | WHAT it does + WHEN to use it + trigger KEYWORDS. Max 1024 chars.              |
| `license`     | No       | License name or reference to bundled `LICENSE.txt`.                            |

> **CRITICAL**: `description` is the PRIMARY mechanism for automatic skill discovery.
> Copilot reads ONLY `name` + `description` to decide whether to load a skill.
>
> **NEVER use YAML block scalars** (`>`, `>-`, `|`, `|-`) for `description`.
> Block scalars break VS Code prompts-diagnostics-provider and silently disable discovery.

### Description Best Practice

Include three elements in a single-line inline string:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios)
3. **Keywords** users might mention

```yaml
# Good — single-line with WHAT + WHEN + keywords
description: "Azure infrastructure defaults: regions, tags, naming (CAF), AVM-first policy. USE FOR: any agent generating Azure resources. DO NOT USE FOR: artifact templates."

# Bad — block scalar breaks discovery
description: >
  Azure infrastructure defaults...

# Bad — too vague for routing
description: "Azure helpers"
```

## Progressive Loading (3 Levels)

| Level           | What Loads                  | When                              |
| --------------- | --------------------------- | --------------------------------- |
| 1. Discovery    | `name` + `description` only | Always (lightweight metadata)     |
| 2. Instructions | Full SKILL.md body          | When request matches description  |
| 3. Resources    | Scripts, references, assets | Only when Copilot references them |

This ensures minimal context cost unless the skill is actually needed.

## Slash Command Behavior

Skills appear as `/skill-name` commands in chat alongside prompt files.

Control access with these frontmatter fields (on SKILL.md, as of VS Code docs):

| Configuration                    | `/` menu | Auto-loaded by Copilot | Use case                    |
| -------------------------------- | -------- | ---------------------- | --------------------------- |
| Default (omit both)              | Yes      | Yes                    | General-purpose skills      |
| `user-invocable: false`          | No       | Yes                    | Background knowledge skills |
| `disable-model-invocation: true` | Yes      | No                     | Manual-only skills          |

> **Note**: `user-invocable` and `disable-model-invocation` appear in VS Code docs
> for skills. However, NO skill in this repo currently uses them. If needed, verify
> current support via the freshness query below.

## Generate a Skill with AI

- Type `/create-skill` in chat and describe the capability
- Extract from conversation: "create a skill from how we just debugged that"

## This Repo's Examples

| Skill                  | Purpose                                        | Has `references/`? |
| ---------------------- | ---------------------------------------------- | ------------------ |
| `azure-defaults`       | Azure regions, tags, naming, security baseline | Yes                |
| `azure-bicep-patterns` | Reusable Bicep patterns (hub-spoke, PE)        | Yes                |
| `make-skill-template`  | Meta-skill for scaffolding new skills          | No                 |
| `github-operations`    | Branch naming, commits, PRs, CLI, Actions      | Yes                |

See `.github/skills/` for the full catalog and `.github/count-manifest.json` for current counts.

## Common Mistakes

| Mistake                             | Fix                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------- |
| YAML block scalar for `description` | Use `description: "inline string"`                                          |
| `name` doesn't match folder name    | Must be identical (e.g., folder `azure-defaults/` → `name: azure-defaults`) |
| SKILL.md body > 500 lines           | Move content to `references/` directory                                     |
| Putting scripts in `references/`    | Scripts go in `scripts/`; `references/` is for documentation                |
| Vague description                   | Include WHAT, WHEN, and trigger keywords                                    |
| Loading all skills upfront          | Use skill-affinity.json to control which agents load which skills           |

## Enforcement Rules

For THIS REPO's conventions on writing skill files, see:
`.github/instructions/agent-skills.instructions.md` (auto-loaded for `**/.github/skills/**/SKILL.md`).

## Verify Freshness

```text
microsoft_docs_fetch("https://code.visualstudio.com/docs/copilot/customization/agent-skills")
```

Check for: new frontmatter fields, new skill locations, changes to progressive loading,
new slash command behavior, or new generation commands.
