<!-- ref:agent-file-structure-v2 -->

# Agent File Structure

Use this reference for frontmatter and handoff field details. Core enforceable
rules remain in `../../../instructions/agent-authoring.instructions.md`.

## Frontmatter Fields

| Field | Type | Default | Purpose |
| --- | --- | --- | --- |
| `name` | string | file name | Human-friendly display name |
| `description` | string | none | Discovery and routing summary |
| `argument-hint` | string | none | Chat input hint |
| `tools` | string[] | runtime default | Available tool or tool-set names |
| `agents` | string[] | runtime default | Callable subagents; `*` means all, `[]` none |
| `model` | string or string[] | model picker | Model or prioritized model list |
| `user-invocable` | boolean | `true` | Dropdown visibility |
| `disable-model-invocation` | boolean | `false` | Blocks model-driven subagent invocation |
| `target` | string | none | `vscode` or `github-copilot` |
| `mcp-servers` | object[] | none | GitHub Copilot target MCP configuration |
| `handoffs` | object[] | none | Suggested transitions to another agent |
| `hooks` | object | none | Preview agent-scoped hooks |

The deprecated `infer` field must not be used.

## Handoff Fields

| Field | Type | Purpose |
| --- | --- | --- |
| `label` | string | Button label |
| `agent` | string | Exact target agent name |
| `prompt` | string | Input and output instructions |
| `send` | boolean | Auto-submit handoff prompt |
| `showContinueOn` | boolean | Continue control visibility |
| `model` | string | Intentional target-model override only |

## Locations And Behavior

- Workspace agents: `.github/agents/`
- Subagents: `.github/agents/_subagents/`
- Body content is prepended to each agent turn.
- Tool references use `#tool:<tool-name>`.
- Model arrays are attempted in order.
- Prompt-file tools override agent tools when both are declared.
- Subagents receive only the delegation prompt, not parent conversation history.

Official reference:
[VS Code Custom Agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents).
