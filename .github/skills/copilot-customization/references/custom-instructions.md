<!-- ref:custom-instructions-v1 -->

# Custom Instructions Reference

> Source: https://code.visualstudio.com/docs/copilot/customization/custom-instructions
> Last verified: 2026-03-08

Custom instructions define coding guidelines and rules that automatically influence
how Copilot generates code. They are applied to chat requests without manual invocation.

## Purpose

- Project-wide coding style and naming conventions
- Technology stack declarations and preferred libraries
- Architectural patterns to follow or avoid
- Security requirements and error handling approaches
- Documentation standards

**Not for**: Inline suggestions (instructions are not used for tab-completion).

## Types of Instruction Files

### Always-On Instructions

Automatically included in every chat request:

| File                              | Description                                 |
| --------------------------------- | ------------------------------------------- |
| `.github/copilot-instructions.md` | Single workspace-level file, always applied |
| `AGENTS.md`                       | Root or subfolder-level, always applied     |
| `CLAUDE.md`                       | Compatibility with Claude Code tools        |
| Organization-level instructions   | Defined at GitHub organization level        |

### File-Based Instructions (`.instructions.md`)

Conditionally applied when files match a glob pattern or description matches the task:

| Scope        | Default Location                             |
| ------------ | -------------------------------------------- |
| Workspace    | `.github/instructions/` folder               |
| User profile | `prompts/` folder of current VS Code profile |

**Setting**: `chat.instructionsFilesLocations` controls additional search paths.

Claude Code compatibility: `.claude/rules/` (workspace) and `~/.claude/rules/` (user) also detected.

## Frontmatter Schema

```yaml
---
name: "Python Standards" # Optional — display name (defaults to filename)
description: "Coding conventions" # Optional — shown on hover in Chat view
applyTo: "**/*.py" # Optional — glob for auto-application
---
```

| Field         | Required | Constraints                                                                                                                                       |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | No       | Display name shown in UI. Defaults to filename. _Note: not used in this repo's instruction files._                                                |
| `description` | No       | Short description shown on hover. 1-500 chars.                                                                                                    |
| `applyTo`     | No       | Glob pattern relative to workspace root. Use `**` for all files. If omitted, instructions are not applied automatically (manual attachment only). |

> **CRITICAL**: `description` MUST be a single-line inline string.
> YAML block scalars (`>`, `>-`, `|`, `|-`) break VS Code prompts-diagnostics-provider
> and silently disable discovery.

## Body Format

Markdown format after the frontmatter. Can reference:

- **Files**: Use Markdown links with relative paths
- **Tools**: Use `#tool:<tool-name>` syntax (e.g., `#tool:githubRepo`)

## Instruction Priority

When multiple instruction files exist, VS Code combines them. No specific order is guaranteed.

Recommendation from VS Code docs:

- Start with a single `.github/copilot-instructions.md` for project-wide standards
- Add `.instructions.md` files for file-type-specific rules
- Use `AGENTS.md` for multi-agent workspaces

## This Repo's Examples

| File                                       | Glob                            | Purpose                             |
| ------------------------------------------ | ------------------------------- | ----------------------------------- |
| `agent-authoring.instructions.md`          | `**/*.agent.md, **/*.prompt.md` | Agent authoring standards           |
| `iac-bicep-best-practices.instructions.md` | `**/*.bicep`                    | Bicep IaC best practices            |
| `python.instructions.md`                   | `**/*.py`                       | Python conventions                  |
| `markdown.instructions.md`                 | `**/*.md`                       | Markdown formatting                 |
| `no-heredoc.instructions.md`               | `**`                            | Prevent terminal heredoc corruption |
| `context-optimization.instructions.md`     | Agents, skills, instructions    | Context window limits               |

See `.github/instructions/` for the full set and `.github/count-manifest.json` for current counts.

## Common Mistakes

| Mistake                                                 | Fix                                                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Using YAML block scalar (`>` or `\|`) for `description` | Use `description: "inline string"`                                                      |
| `applyTo: "**"` on large files                          | Narrow the glob (e.g., `**/*.py`) — `**` loads for every file                           |
| Instruction file > 150 lines                            | Split into a skill with `references/` directory                                         |
| Duplicating content across instruction files            | Extract to a single instruction with appropriate glob                                   |
| Putting enforcement rules in a skill                    | Use instruction files for rules (auto-loaded); skills for reference content (on-demand) |

## Enforcement Rules

For THIS REPO's conventions on writing instruction files, see:
`.github/instructions/instructions.instructions.md` (auto-loaded for `**/*.instructions.md`).

This reference covers the VS Code specification; the instruction file covers repo-specific rules.

## Verify Freshness

Check VS Code docs for upstream changes to custom instructions:
`https://code.visualstudio.com/docs/copilot/customization/custom-instructions`

Check for: new frontmatter fields, new file locations, changes to instruction priority,
new settings, or new instruction file types.
