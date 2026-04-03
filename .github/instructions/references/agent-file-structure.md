<!-- ref:agent-file-structure-v1 -->

# Agent File Structure — Complete Reference

Extracted from [VS Code Custom Agents docs](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
(2026-03-09). Core rules and project-specific conventions live in
`agent-authoring.instructions.md`.

## Frontmatter Fields

All fields are optional. The file must use `.agent.md` extension.

| Field                      | Type               | Default      | Description                                                                               |
| -------------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------- |
| `name`                     | string             | file name    | Human-friendly display name                                                               |
| `description`              | string             | —            | Brief description; shown as placeholder text in chat input                                |
| `argument-hint`            | string             | —            | Hint text in chat input to guide users                                                    |
| `tools`                    | string[]           | —            | Tool or tool-set names available to this agent. Use `<server>/*` for all MCP server tools |
| `agents`                   | string[]           | —            | Agent names available as subagents. `*` = all, `[]` = none. Requires `agent` in `tools`   |
| `model`                    | string \| string[] | model picker | Single model name or prioritized list; first available is used                            |
| `user-invocable`           | boolean            | `true`       | Controls visibility in agents dropdown                                                    |
| `disable-model-invocation` | boolean            | `false`      | Prevents invocation as a subagent by other agents                                         |
| `target`                   | string             | —            | Target environment: `vscode` or `github-copilot`                                          |
| `mcp-servers`              | object[]           | —            | MCP server configs (only for `target: github-copilot`)                                    |
| `handoffs`                 | object[]           | —            | Suggested next actions/prompts for transitioning between agents                           |
| `hooks`                    | object             | —            | (Preview) Hook commands scoped to this agent; requires `chat.useCustomAgentHooks`         |
| `infer`                    | boolean            | —            | **Deprecated.** Use `user-invocable` + `disable-model-invocation` instead                 |

## Handoff Entry Fields

| Field    | Type    | Default | Description                                                              |
| -------- | ------- | ------- | ------------------------------------------------------------------------ |
| `label`  | string  | —       | Display text on the handoff button                                       |
| `agent`  | string  | —       | Target agent identifier (matches `name` from target agent's frontmatter) |
| `prompt` | string  | —       | Prompt text to send to the target agent                                  |
| `send`   | boolean | `false` | Auto-submit the prompt when user clicks the handoff button               |
| `model`  | string  | —       | Override model for this handoff. Format: `Model Name (vendor)`           |

## File Locations

| Scope                     | Path                                                            |
| ------------------------- | --------------------------------------------------------------- |
| Workspace                 | `.github/agents/`                                               |
| Workspace (Claude format) | `.claude/agents/`                                               |
| User profile              | `~/.copilot/agents` or agents folder of current VS Code profile |
| Custom                    | Configured via `chat.agentFilesLocations` setting               |

VS Code detects any `.md` files in `.github/agents/` as custom agents.

## Body

- Plain Markdown, prepended to every user chat prompt.
- Reference other files via Markdown links.
- Reference tools with `#tool:<tool-name>` syntax.
- If a tool in the `tools` list is unavailable at runtime, it is silently ignored.

## Key Behaviors

- **Model fallback**: When `model` is an array, each model is tried in order until one is available.
- **Tool precedence**: When `tools` is defined in both an agent and a prompt file, the prompt file's tools take precedence.
- **Subagent access**: Agents listed in `agents` can be invoked as subagents. The `agent` tool must be in `tools`.
