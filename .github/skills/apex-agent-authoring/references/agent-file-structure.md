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
| `disable-model-invocation` | boolean | `false` | Invocation configuration; not proof of enforced human or credential isolation |
| `target` | string | none | `vscode` or `github-copilot` |
| `mcp-servers` | object[] | none | GitHub Copilot target MCP configuration |
| `handoffs` | object[] | none | Historical/other-runtime UI transition metadata; omitted from active APEX agents |
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
- Body content supplies the selected role; keep runtime-critical interaction/scope/stop rules in it.
- Tool references use `#tool:<tool-name>`.
- Model arrays are attempted in order.
- Validate every label exactly against the catalog; add no automatic fallbacks.
- Nonempty `agents` needs the `agent` tool. `agents: []` needs no delegation tool.
- Leaf workers have no nested delegation, user-question, or parent-todo tools.
- Directly selected main agents include actual native `ask_user`; delegated mains return the form to the parent.
- Do not require handoff buttons, nonce exchanges or custom worker-execution envelopes.
- Archived prompt metadata is historical, not execution authority.
- Subagents receive only the delegation prompt, not parent conversation history.

Local prompt adapters are archived. Shared procedures belong in skills, but skills
inherit caller model/tools and cannot silently select the owning agent. Stop for
human selection when an essential transition or tool is unavailable. Discovery,
model eligibility and tool binding require live SDK acceptance inside VS Code.
Documented `handoffs[].model` platform qualifiers (for example `(copilot)`) are
allowed; ordinary model labels remain exact catalog keys.

Official references:
[VS Code Custom Agents](https://code.visualstudio.com/docs/agent-customization/custom-agents),
[GitHub configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration) and
[Choose an agent harness](https://code.visualstudio.com/docs/agents/run/agent-harnesses).
The GitHub reference explicitly scopes ignored handoff metadata to cloud agents; that is not proof
of all VS Code behavior. The current APEX design follows the owner-observed Copilot client result.
