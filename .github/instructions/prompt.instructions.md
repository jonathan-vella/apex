---
description: "Guidelines for creating high-quality prompt files for GitHub Copilot"
applyTo: "**/*.prompt.md"
---

# Copilot Prompt Files Guidelines

Instructions for creating effective and maintainable prompt files that guide
GitHub Copilot in delivering consistent, high-quality outcomes across any repository.

## Scope and Principles

- Target audience: maintainers and contributors authoring reusable prompts.
- Goals: predictable behaviour, clear expectations, minimal permissions, portability.
- Primary references: VS Code documentation on prompt files and organization conventions.

## Frontmatter Requirements

Every prompt file should include YAML frontmatter with the following fields:

### Required/Recommended Fields

| Field           | Required    | Description                                                 |
| --------------- | ----------- | ----------------------------------------------------------- |
| `description`   | Recommended | Short description (single sentence, actionable outcome)     |
| `name`          | Optional    | Name shown after typing `/` in chat. Defaults to filename   |
| `agent`         | Recommended | Agent to use: `ask`, `edit`, `agent`, or custom agent       |
| `model`         | Optional    | Language model to use. Defaults to currently selected model |
| `tools`         | Optional    | List of tool/tool set names available for this prompt       |
| `argument-hint` | Optional    | Hint text shown in chat input to guide user interaction     |

### Guidelines

- Use consistent quoting (single quotes recommended)
- Keep one field per line for readability and version control clarity
- If `tools` are specified and the current agent is `ask` or `edit`,
  the default agent becomes `agent`
- Preserve any additional metadata (`language`, `tags`, `visibility`, etc.)
  required by your organization

## File Naming and Placement

- Use kebab-case filenames ending with `.prompt.md`
- Store APEX prompts under `tools/apex-prompts/` (workspace-only, never
  auto-loaded by VS Code Copilot discovery). Other workspaces may use
  `.github/prompts/` if their policy permits auto-loading.
- Provide a short filename that communicates the action
  (e.g., `generate-readme.prompt.md` rather than `prompt1.prompt.md`)

## Body Structure

- Start with an `#` heading that matches the prompt intent for Quick Pick search
- Organize with predictable sections: `Mission`, `Scope & Preconditions`, `Inputs`,
  `Workflow` (step-by-step), `Output Expectations`, and `Quality Assurance`
- Adjust section names to fit the domain, but retain the logical flow:
  why → context → inputs → actions → outputs → validation
- Reference related prompts or instruction files using relative links

## Input and Context Handling

- Use `${input:variableName[:placeholder]}` for required values
- Explain when the user must supply them; provide defaults where possible
- Call out contextual variables (`${selection}`, `${file}`, `${workspaceFolder}`)
  only when essential, describing how Copilot should interpret them
- Document how to proceed when mandatory context is missing
  (e.g., "Request the file path and stop if undefined")

## Tool and Permission Guidance

- Limit `tools` to the smallest set that enables the task
- List them in preferred execution order when sequence matters
- If the prompt inherits tools from a chat mode, mention that relationship
  and state any critical tool behaviours or side effects
- Warn about destructive operations (file creation, edits, terminal commands)
  and include guard rails or confirmation steps in the workflow

## Instruction Tone and Style

- Write in direct, imperative sentences targeted at Copilot ("Analyze", "Generate")
- Keep sentences short and unambiguous
- Follow Google Developer Documentation translation best practices
- Avoid idioms, humor, or culturally specific references

## Output Definition

- Specify the format, structure, and location of expected results
  (e.g., "Create `docs/adr/adr-XXXX.md` using the template below")
- Include success criteria and failure triggers
- Provide validation steps—manual checks, automated commands,
  or acceptance criteria lists—that reviewers can execute

## Examples and Reusable Assets

- Embed Good/Bad examples or scaffolds (Markdown templates, JSON stubs)
- Maintain reference tables inline to keep the prompt self-contained
- Update these tables when upstream resources change
- Link to authoritative documentation instead of duplicating lengthy guidance

## Quality Assurance Checklist

- [ ] Frontmatter fields are complete, accurate, and least-privilege
- [ ] Inputs include placeholders, default behaviours, and fallbacks
- [ ] Workflow covers preparation, execution, and post-processing without gaps
- [ ] Output expectations include formatting and storage details
- [ ] Validation steps are actionable (commands, diff checks, review prompts)
- [ ] Security, compliance, and privacy policies are current
- [ ] Prompt executes successfully in VS Code using representative scenarios

## Maintenance Guidance

- Version-control prompts alongside the code they affect
- Update them when dependencies, tooling, or review processes change
- Review prompts periodically to ensure tool lists and linked documents remain valid
- Coordinate with other repositories: when a prompt proves broadly useful,
  extract common guidance into instruction files or shared prompt packs

## Additional Resources

- [Prompt Files Documentation][prompt-docs]
- [Awesome Copilot Prompt Files][awesome-prompts]
- [Tool Configuration][tool-config]

[prompt-docs]: https://code.visualstudio.com/docs/copilot/customization/prompt-files#_prompt-file-format
[awesome-prompts]: https://github.com/github/awesome-copilot/tree/main/prompts
[tool-config]: https://code.visualstudio.com/docs/copilot/chat/chat-agent-mode#_agent-mode-tools
