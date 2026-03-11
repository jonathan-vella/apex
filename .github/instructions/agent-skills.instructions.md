---
description: "Guidelines for creating high-quality Agent Skills for GitHub Copilot"
applyTo: "**/.github/skills/**/SKILL.md, **/.claude/skills/**/SKILL.md"
---

# Agent Skills File Guidelines

Agent Skills are folders of instructions, scripts, and resources that Copilot
loads on demand. They follow the [Agent Skills open standard](https://agentskills.io/)
and work across VS Code, Copilot CLI, and Copilot coding agent.

For the complete official reference, see
[VS Code Agent Skills docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills).

## Required SKILL.md Frontmatter

```yaml
---
name: webapp-testing
description: "Toolkit for testing local web apps using Playwright. Use when asked to verify frontend functionality, debug UI behavior, or capture screenshots."
---
```

| Field                      | Required | Constraints                                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `name`                     | Yes      | Lowercase, hyphens for spaces, max 64 chars. **Must match parent directory name.** |
| `description`              | Yes      | State **WHAT** it does, **WHEN** to use it, and **KEYWORDS**; max 1024 chars       |
| `argument-hint`            | No       | Hint text shown in chat input when invoked as a `/` slash command                  |
| `user-invocable`           | No       | Boolean, default `true`. Set `false` to hide from `/` menu                         |
| `disable-model-invocation` | No       | Boolean, default `false`. Set `true` to require manual `/` invocation only         |
| `license`                  | No       | Reference to `LICENSE.txt` or SPDX identifier                                      |

**Name matching rule**: The `name` field MUST match its parent directory.
If the directory is `.github/skills/webapp-testing/`, the name must be
`webapp-testing`. Mismatched names prevent the skill from loading.

**Description is the discovery key**: Copilot reads ONLY `name` +
`description` to decide whether to load a skill. A vague description
means the skill never activates.

**NEVER use YAML block scalars** (`>`, `>-`, `|`, `|-`) for description.
Use a single-line `description: "..."` inline string.
Block scalars break VS Code prompts-diagnostics-provider.

## Slash Command Visibility

Skills are available as `/` slash commands alongside prompt files.
Use `user-invocable` and `disable-model-invocation` to control access:

| Configuration                    | In `/` menu | Auto-loaded by model | Use case               |
| -------------------------------- | ----------- | -------------------- | ---------------------- |
| Default (both omitted)           | Yes         | Yes                  | General-purpose skills |
| `user-invocable: false`          | No          | Yes                  | Background knowledge   |
| `disable-model-invocation: true` | Yes         | No                   | On-demand only         |
| Both set                         | No          | No                   | Disabled               |

## Skill Locations

| Scope        | Path                                                           |
| ------------ | -------------------------------------------------------------- |
| Workspace    | `.github/skills/`, `.claude/skills/`, `.agents/skills/`        |
| User profile | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` |
| Custom       | Configured via `chat.agentSkillsLocations` setting             |

## Body Sections

| Section                     | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `# Title`                   | Brief overview of what this skill enables           |
| `## When to Use This Skill` | List of scenarios (reinforces description triggers) |
| `## Prerequisites`          | Required tools, dependencies, environment setup     |
| `## Step-by-Step Workflows` | Numbered steps for common tasks                     |
| `## Troubleshooting`        | Common issues and solutions table                   |
| `## References`             | Links to bundled docs or external resources         |

## Directory Structure

```text
.github/skills/<skill-name>/
├── SKILL.md              # Required: Main instructions (≤500 lines)
├── LICENSE.txt            # Recommended: License terms
├── scripts/              # Executable automation (loaded when executed)
├── references/           # Documentation (loaded when referenced by SKILL.md)
├── assets/               # Static files used AS-IS in output (not loaded into context)
└── templates/            # Starter code the AI agent MODIFIES and builds upon
```

**Assets vs Templates**: If the AI reads and builds upon it → `templates/`.
If the file is used as-is in output → `assets/`.

## Progressive Loading

| Level           | What Loads                    | When                              |
| --------------- | ----------------------------- | --------------------------------- |
| 1. Discovery    | `name` and `description` only | Always (lightweight metadata)     |
| 2. Instructions | Full `SKILL.md` body          | When request matches description  |
| 3. Resources    | Scripts, examples, docs       | Only when Copilot references them |

## Writing Rules

- Imperative mood: "Run", "Create", "Configure"
- Include exact commands with parameters
- Keep SKILL.md body ≤500 lines; split large workflows into `references/`
- Use relative paths for all resource references (e.g., `[script](./run-tests.js)`)
- Use `#tool:<tool-name>` to reference agent tools in body text
- No hardcoded credentials or secrets
- Include `--help` documentation and error handling in scripts

## Validation Checklist

- [ ] Valid frontmatter with `name` and `description`
- [ ] `name` is lowercase with hyphens, ≤64 characters, matches directory name
- [ ] `description` states WHAT, WHEN, and KEYWORDS
- [ ] Body ≤500 lines; large content in `references/`
- [ ] Scripts include help docs and error handling
- [ ] No hardcoded credentials

## Resources

- [Agent Skills Specification](https://agentskills.io/)
- [VS Code Agent Skills Docs](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [Reference skills repository](https://github.com/anthropics/skills)
