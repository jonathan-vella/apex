---
description: "Guidelines for creating high-quality prompt files for GitHub Copilot"
applyTo: "**/*.prompt.md"
---

# Copilot Prompt Files Guidelines

Repository rules for `.prompt.md` files. Structural and model rules shared with agents
live in [`agent-authoring.instructions.md`](agent-authoring.instructions.md) and
[`vendor-prompting.instructions.md`](vendor-prompting.instructions.md).

## Frontmatter Requirements

| Field           | Required    | Description                                                 |
| --------------- | ----------- | ----------------------------------------------------------- |
| `description`   | Recommended | Short description (single sentence, actionable outcome)     |
| `name`          | Optional    | Name shown after typing `/` in chat. Defaults to filename   |
| `agent`         | Recommended | Agent to use: `ask`, `edit`, `agent`, or custom agent       |
| `model`         | Optional    | Quoted string; custom-agent prompts inherit the target model |
| `tools`         | Optional    | Smallest tool set that enables the task                     |
| `argument-hint` | Optional    | Hint text shown in chat input to guide user interaction     |

If `tools` are specified and the current agent is `ask` or `edit`, the default agent
becomes `agent`. Keep one field per line.

## File Naming and Placement

- Use kebab-case filenames ending with `.prompt.md`
- Store attachable/reference prompts under `tools/apex-prompts/`.
  Local operational slash prompts live under `.github/prompts/`; both locations use the same validation rules.
  Keep shared behavior in its owning skill or agent rather than copying workflows between entrypoints.
- Provide a short filename that communicates the action
  (e.g., `generate-readme.prompt.md` rather than `prompt1.prompt.md`)

### Local And Agent Host

Local prompt files are adapters, not Agent Host entry points. On Agent Host, use
the shared skill and explicitly select its owning main agent before consequential
work. Skills inherit the caller's model/tools; they do not switch agents or grant
permissions. Keep needed Local discovery settings; they do not establish Host
support or override production human-selection boundaries. Verify each harness
separately; source validation is not runtime evidence.

## Body Structure

Workflow prompts are thin adapters for a named owner agent: read the owning skill, pass the
supplied inputs unchanged, require the owner and its configured model (stop if unavailable),
validate required inputs before work, preserve reviews and approvals, and return the owner's
canonical outputs, check results and blockers. The owner body and workflow graph control
execution; do not copy workflows into the prompt.

Other prompts start with an `#` heading matching the intent, then cover why → context →
inputs → actions → outputs → validation.

## Inputs, Tools and Outputs

- Use `${input:variableName[:placeholder]}` for required values and say how to proceed
  when mandatory context is missing (e.g., "Request the file path and stop if undefined").
- Warn about destructive operations (file creation, edits, terminal commands) and include
  guard rails or confirmation steps.
- Specify the format, location and success criteria of results, plus validation steps a
  reviewer can run.

## Quality Assurance Checklist

- [ ] Frontmatter fields are complete, accurate, and least-privilege
- [ ] Inputs include placeholders, defaults and missing-input behaviour
- [ ] Output expectations include formatting, storage and validation
- [ ] Links to owning skills, agents and references resolve

## Additional Resources

- [Prompt Files Documentation][prompt-docs]
- [Tool Configuration][tool-config]

[prompt-docs]: https://code.visualstudio.com/docs/agent-customization/prompt-files#_prompt-file-format
[tool-config]: https://code.visualstudio.com/docs/agents/run/tools
