<!-- ref:prompt-files-v1 -->
# Prompt Files Reference

> Source: https://code.visualstudio.com/docs/copilot/customization/prompt-files
> Last verified: 2026-03-08

Prompt files (`.prompt.md`) are reusable task commands invoked manually in chat
via `/name`. Unlike instructions that apply automatically, prompts are explicit actions.

## Purpose

- Simplify prompting for common tasks (scaffold components, run tests, prepare PRs)
- Override default behavior of a custom agent
- Encode task-specific context and guidelines as standalone files
- Create team-shared workflows

## File Locations

| Scope        | Default Location                             |
| ------------ | -------------------------------------------- |
| Workspace    | `.github/prompts/` folder                    |
| User profile | `prompts/` folder of current VS Code profile |

**Setting**: `chat.promptFilesLocations` controls additional search paths.

## Frontmatter Schema

```yaml
---
description: "Generate a new React form component"
name: "create-form"
argument-hint: "Describe the form fields and validation rules"
agent: "agent"
model: GPT-4o
tools: ["githubRepo", "search/codebase"]
---
```

| Field           | Required | Description                                                                                                                        |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `description`   | No       | Short description of the prompt                                                                                                    |
| `name`          | No       | Name used after typing `/` in chat. Defaults to filename.                                                                          |
| `argument-hint` | No       | Hint text shown in chat input to guide users                                                                                       |
| `agent`         | No       | Agent to run the prompt: `ask`, `agent`, `plan`, or a custom agent name. Default: current agent (or `agent` if `tools` specified). |
| `model`         | No       | Language model to use. Defaults to model picker selection.                                                                         |
| `tools`         | No       | List of tool/tool-set names available for this prompt. Supports MCP server wildcards: `<server>/*`.                                |

## Body Format

Markdown with task-specific instructions. Supports:

### File References

Use Markdown links with relative paths:

```markdown
Follow the patterns in [design-system/Form.md](../docs/design-system/Form.md)
```

### Tool References

Use `#tool:<tool-name>` syntax:

```markdown
Search for templates in #tool:githubRepo contoso/react-templates.
```

### Variables

| Type         | Syntax                                                                       | Description                     |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------- |
| Workspace    | `${workspaceFolder}`, `${workspaceFolderBasename}`                           | Workspace path/name             |
| File context | `${file}`, `${fileBasename}`, `${fileDirname}`, `${fileBasenameNoExtension}` | Active editor file info         |
| Selection    | `${selection}`, `${selectedText}`                                            | Editor selection                |
| Input        | `${input:varName}`, `${input:varName:placeholder}`                           | User-provided values at runtime |

### Example Using Variables

```markdown
---
description: "Generate unit tests for the current file"
agent: "agent"
tools: ["search", "read", "edit"]
---

Generate unit tests for [${fileBasename}](${file}).

- Place the test file in: ${fileDirname}
- Name: ${fileBasenameNoExtension}.test.ts
- Framework: ${input:framework:jest or vitest}
```

## Tool List Priority

When a prompt references a custom agent via the `agent` field:

1. Tools specified in the prompt file (highest priority)
2. Tools from the referenced custom agent
3. Default tools for the selected agent (lowest priority)

## Invocation Methods

| Method                                | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| Type `/name` in chat                  | Quick invocation with optional extra context    |
| Command Palette: **Chat: Run Prompt** | Select from Quick Pick list                     |
| Open file → play button               | Run from editor title area (useful for testing) |

**Setting**: `chat.promptFilesRecommendations` shows prompts as suggested actions when starting a new chat.

## Generate a Prompt with AI

- Type `/create-prompt` in chat and describe the task
- Extract from conversation: "turn this into a reusable prompt" or "save this workflow as a prompt"

## This Repo's Examples

| File                                                      | Purpose                                     |
| --------------------------------------------------------- | ------------------------------------------- |
| `agent-output/copilot-customization-skill-plan.prompt.md` | Plans the copilot-customization skill build |

## Common Mistakes

| Mistake                                  | Fix                                                      |
| ---------------------------------------- | -------------------------------------------------------- |
| Forgetting `tools` list                  | Prompt runs without tools; add needed tools explicitly   |
| Wrong agent name in `agent` field        | Use exact agent name from `.agent.md` frontmatter        |
| Using `${input:var}` without placeholder | Add placeholder text: `${input:var:describe your input}` |
| Not testing variables before sharing     | Open the file in editor → press play button to test      |

## Enforcement Rules

For THIS REPO's conventions on writing prompt files, see:
`.github/instructions/prompt.instructions.md` (auto-loaded for `**/*.prompt.md`).

## Verify Freshness

```text
microsoft_docs_fetch("https://code.visualstudio.com/docs/copilot/customization/prompt-files")
```

Check for: new frontmatter fields, new variable types, changes to tool list priority,
new invocation methods, or new settings.
