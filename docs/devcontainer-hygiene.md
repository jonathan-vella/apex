# Dev container hygiene — Copilot context bloat

This repo ships workspace-level mitigations that reduce per-turn input-token
cost in GitHub Copilot Chat. The biggest single recoverable is
**extension-contributed customizations** — `chatSkills`, `chatAgents`, and
`chatPromptFiles` registered by VS Code extensions that load into every chat
turn's system prompt.

This document explains what's been mitigated at the repo level and what each
contributor can do on their own machine.

## What the repo already does

### 1. Suppresses user-scope discovery for this workspace

`.vscode/settings.json` (and the mirrored block in
`.devcontainer/devcontainer.json` `customizations.vscode.settings`) sets
user-profile paths to `false` in the chat customization location maps:

- `chat.instructionsFilesLocations` — `~/.copilot/instructions` and
  `~/.claude/rules` disabled
- `chat.agentFilesLocations` — `~/.copilot/agents` and `~/.claude/agents`
  disabled
- `chat.agentSkillsLocations` — `~/.copilot/skills` and `~/.claude/skills`
  disabled
- `chat.useClaudeMdFile` — `false` (this repo uses `AGENTS.md`)

Per the [VS Code custom-instructions docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions#_instructions-file-locations),
these settings override the default user-profile discovery. They are
**workspace-scoped** — your user-profile customizations remain available in
other workspaces.

### 2. Curates the dev container extension list

`.devcontainer/devcontainer.json` `customizations.vscode.extensions[]` is
curated to **exclude** extensions known to contribute heavy Copilot chat
customizations without serving the APEX workflow. A comment block above the
array documents the policy.

### 3. Surfaces a "do not install" dialog for bloat extensions

`.vscode/extensions.json` `unwantedRecommendations` lists the heavy
contributors:

| Extension                                   | Footprint                        | Why flagged                                |
| ------------------------------------------- | -------------------------------- | ------------------------------------------ |
| `ms-azuretools.vscode-azure-github-copilot` | 9 chatAgents + 7 chatPromptFiles | Duplicates APEX's own end-to-end agent set |
| `ms-windows-ai-studio`                      | 2 chatSkills + 2 chatAgents      | AI Toolkit; not used by APEX               |
| `teamsdevapp.vscode-ai-foundry`             | chatAgents                       | AI Foundry; not used by APEX               |

When you open the workspace with one of these installed, VS Code shows a
dialog: _"These extensions are not recommended for this workspace."_ One
click uninstalls them.

### 4. CI gate

`npm run validate:extension-bloat` (wired into `validate:_node` and
`validate:_node-ci`) rejects any future PR that adds a denylisted extension
to the dev container's `extensions[]` array. The denylist lives in
[`tools/scripts/validate-extension-bloat.mjs`](../tools/scripts/validate-extension-bloat.mjs).

Borderline cases (Cosmos DB, GitHub PR review) stay off the validator
denylist — they're `unwantedRecommendations` only (soft signal).

## What you can do (per-developer, optional)

### A. Acknowledge the unwantedRecommendations dialog

When you open the workspace, accept the prompt to uninstall the flagged
extensions. One click each.

### B. Remove from your host VS Code globally

If you want the extensions gone from every workspace, not just this one:

```bash
code --uninstall-extension ms-azuretools.vscode-azure-github-copilot
code --uninstall-extension ms-windows-ai-studio
code --uninstall-extension teamsdevapp.vscode-ai-foundry
```

(Re-install at any time with `code --install-extension <id>` if you start
using them.)

### C. Trim your VS Code user-profile prompts folder

If you keep personal `*.instructions.md` or `*.prompt.md` files in your VS
Code user profile, they load globally by default. The workspace mitigation
suppresses them when this folder is open, but they still cost tokens in
other workspaces.

Locations (clear or trim as you see fit):

- **Windows**: `%APPDATA%\Code\User\prompts\`
- **macOS**: `~/Library/Application Support/Code/User/prompts/`
- **Linux**: `~/.config/Code/User/prompts/`

### D. Inspect what's loading in any session

Right-click in the Chat view → **Diagnostics**. The dialog lists every
custom agent, skill, instruction, prompt, and hook currently in scope,
along with its source path. Confirms what the mitigations achieved and
exposes anything else worth trimming.

## Estimated saving

| Mitigation                                                   |    Per turn | Per Step 1 (~31 turns) |
| ------------------------------------------------------------ | ----------: | ---------------------: |
| User-scope discovery suppression (repo)                      |        1-3k |                 30-90k |
| `unwantedRecommendations` acknowledged + uninstall           |        5-7k |               150-200k |
| Long-tail (Cosmos DB, etc.)                                  |      0.5-1k |                 15-30k |
| **Cumulative (developer fully acts on the recommendations)** | **6.5-11k** |          **~200-320k** |

Numbers are estimates based on extension `package.json` `contributes` audits
against the test03 debug log
(`tmp/agent-debug-log-a3ca0888-f43d-4ab4-b06d-6d289a194942.json`). Real-world
savings will vary with what each contributor has installed.

## Adding a new extension to the dev container

If you propose adding an extension to `.devcontainer/devcontainer.json`
`extensions[]`:

1. Check the extension's `package.json` `contributes` for `chatSkills`,
   `chatAgents`, `chatPromptFiles`, or `chatParticipants`.
2. If any of those are present and non-empty, audit whether the contributed
   customizations duplicate APEX's own agent set. If yes, the extension
   should not be added to the dev container; route to a per-developer
   install instead.
3. `npm run validate:extension-bloat` enforces the denylist. To add a new
   extension to the denylist, edit
   [`tools/scripts/validate-extension-bloat.mjs`](../tools/scripts/validate-extension-bloat.mjs)
   `DENYLIST` constant and document the reason.

## See also

- [VS Code custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- [VS Code subagents](https://code.visualstudio.com/docs/copilot/agents/subagents)
- [VS Code Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
- [.github/instructions/agent-authoring.instructions.md `User-scope customization bloat (advisory)`](../.github/instructions/agent-authoring.instructions.md)
- [tmp/plan-input-token-reduction-v3.md](../tmp/plan-input-token-reduction-v3.md)

## Parallel chat retry race (upstream)

VS Code Copilot Chat occasionally fires the same model request twice
in parallel — typically observed on slow or rate-limited turns — and
the second response then **clobbers** the first into the chat
history. Both calls bill against the user's input-token budget but
only the latter is visible. There is no agent-side fix: the retry
happens inside the chat client outside any agent's reach. This
section captures the evidence for upstream triage so the symptom is
not mistaken for an agent bug.

### OTel evidence (test04-01 baseline)

Spans observed in
`logs/test04-01.json` (extracted via
`tar -xzf .github/data/token-reduction-logs.tar.gz`):

| Span ID          | Pattern                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| span #564 / #565 | Two `chat:claude-opus-4.7` calls fire within ~50 ms of each other, both with identical `gen_ai.request.id` — the second supersedes the first in the rendered chat. |
| span #1773       | A third occurrence later in the session — same agent, same step, no user input in between.                                                                         |

The pattern is reproducible from any saved OTel log by counting
`chat:` spans whose `gen_ai.request.id` matches a prior span within
500 ms. The Plan 01 profiler does not surface this signal directly
yet; a future enhancement could add it.

### Plan 01 v1 retry rule — REMOVED

The original v1 plan had an agent-body retry directive ("if your
response was truncated, do not retry immediately"). That directive is
**removed** in v2 because the agent never sees the truncation — the
retry happens at the chat-client layer. The only realistic path is
upstream.

### Filing an upstream issue

Use the [`copilot-chat-feedback.md`](../.github/ISSUE_TEMPLATE/copilot-chat-feedback.md)
issue template (one is filed at
<https://github.com/microsoft/vscode-copilot-release/issues> — link
this section so future contributors can pile on additional evidence).
