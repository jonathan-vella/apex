---
title: "Dev Container Hygiene"
description: "Reduce Copilot context bloat from workspace and extension customizations"
sidebar:
  order: 8
---

This guide explains how APEX keeps GitHub Copilot Chat context lean in the dev
container, and what contributors can do locally when extension-contributed chat
customizations inflate every turn.

The largest avoidable source is extension-contributed customization: chat
skills, chat agents, chat prompt files, and chat participants registered by VS
Code extensions. These can be loaded into every Copilot Chat turn even when they
are unrelated to the APEX workflow.

## Repository Mitigations

### User-Scope Discovery Is Disabled

The workspace settings disable user-profile customization discovery for this
repository:

- `chat.instructionsFilesLocations` disables `~/.copilot/instructions` and
  `~/.claude/rules`.
- `chat.agentFilesLocations` disables `~/.copilot/agents` and
  `~/.claude/agents`.
- `chat.agentSkillsLocations` disables `~/.copilot/skills` and
  `~/.claude/skills`.
- `chat.useClaudeMdFile` is set to `false` because this repository uses
  `AGENTS.md`.

The same settings are mirrored into the dev container VS Code customizations.
They are workspace-scoped, so personal prompts and instructions still work in
other repositories.

### The Dev Container Extension List Is Curated

The dev container extension list excludes extensions that contribute heavy
Copilot Chat customizations without serving the APEX workflow. The policy is
recorded next to the `customizations.vscode.extensions` array in
`.devcontainer/devcontainer.json`.

### Unwanted Extension Recommendations Warn Contributors

The workspace uses `.vscode/extensions.json` `unwantedRecommendations` to
flag extensions that commonly add large chat customization payloads:

- `ms-azuretools.vscode-azure-github-copilot`: duplicates APEX's end-to-end
  agent set.
- `ms-windows-ai-studio`: AI Toolkit is not used by the APEX flow.
- `teamsdevapp.vscode-ai-foundry`: AI Foundry is not used by the APEX flow.

When one of these extensions is installed, VS Code shows a workspace-specific
recommendation dialog. Accepting the prompt removes the extension from this
workspace environment.

### CI Rejects Denylisted Extensions

`npm run validate:extension-bloat` rejects changes that add denylisted
extensions to the dev container extension list. The denylist lives in
`tools/scripts/validate-extension-bloat.mjs`.

Borderline extensions can remain as `unwantedRecommendations` only. That keeps
the warning visible without blocking contributors who deliberately need a tool
for work outside the APEX flow.

## Contributor Cleanup

### Acknowledge the VS Code Dialog

When the workspace opens, accept the unwanted extension recommendation dialog
for flagged extensions. This is the simplest way to reduce per-turn context in
this repository.

### Remove Extensions Globally When Appropriate

To remove flagged extensions from every workspace on your machine, run these
commands from your host VS Code environment:

```bash
code --uninstall-extension ms-azuretools.vscode-azure-github-copilot
code --uninstall-extension ms-windows-ai-studio
code --uninstall-extension teamsdevapp.vscode-ai-foundry
```

Reinstall an extension later with `code --install-extension <id>` if you start
using it in another workspace.

### Trim User-Profile Prompt Files

Personal `*.instructions.md` and `*.prompt.md` files in your VS Code user
profile load globally by default. The workspace suppresses them for APEX, but
they can still add context in other repositories.

Common locations:

- Windows: `%APPDATA%\Code\User\prompts\`
- macOS: `~/Library/Application Support/Code/User/prompts/`
- Linux: `~/.config/Code/User/prompts/`

### Inspect What Loaded

Right-click in the Copilot Chat view and select **Diagnostics**. The diagnostics
view lists every active agent, skill, instruction, prompt, and hook, including
where each one came from.

Use this when you need to confirm that workspace mitigations are active or when
a new extension appears to be adding unexpected context.

## Adding Dev Container Extensions

Before adding an extension to `.devcontainer/devcontainer.json`, inspect the
extension `package.json` for these `contributes` keys:

- `chatSkills`
- `chatAgents`
- `chatPromptFiles`
- `chatParticipants`

If the extension contributes chat customizations that overlap with APEX's agent
and skill model, prefer a per-developer install. If the extension should be
blocked for everyone, update the denylist in
`tools/scripts/validate-extension-bloat.mjs` and document the reason.

## Parallel Chat Retry Race

VS Code Copilot Chat can occasionally issue the same model request twice in
parallel, usually during slow or rate-limited turns. The second response may
replace the first in chat history. Both requests can count against input tokens,
but only the later response is visible.

This is a client-layer behavior, not an APEX agent behavior. Agent prompts cannot
reliably prevent it because the retry happens outside the agent's execution
context. Saved telemetry can reveal the pattern by grouping `chat:` spans with
the same `gen_ai.request.id` within a short time window.

When filing an upstream issue, use the Copilot Chat feedback issue template in
`.github/ISSUE_TEMPLATE/copilot-chat-feedback.md` and include the relevant saved
telemetry details.

## Related

- [Debug Log Export](../apex-debug-log-export/) — bundle Copilot debug logs
  for review
- [Session Debugging](../session-debugging/) — recover workflow state and
  resume safely
- [Validation & Linting](../../reference/validation-reference/) — run
  repository validation checks
