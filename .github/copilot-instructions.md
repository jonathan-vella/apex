# APEX - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Quick Start

1. Open Chat (`Ctrl+Shift+I`) → Select **Orchestrator** → Describe your project
2. The Orchestrator guides you through all steps with approval gates

Subagent support is pre-configured in `.vscode/settings.json`.

## Session State — apex-recall

All session state flows through `apex-recall`. Do not read or write
`00-session-state.json` directly.

```bash
# Lifecycle
apex-recall init <project> --json                                    # new project
apex-recall show <project> --json                                    # context: step, decisions, findings, artifacts
apex-recall checkpoint <project> <step> <phase> --json               # after each phase
apex-recall complete-step <project> <step> --json                    # on step completion
apex-recall review-audit <project> <step> ... --json                 # after challenger reviews

# Decisions + findings
apex-recall decide <project> --key <k> --value <v> --json
apex-recall decide <project> --decision "<text>" --rationale "<why>" --json
apex-recall finding <project> --add "<text>" --json

# Read-only orientation: sessions | files | search '<term>' | decisions (all accept --json)
```

If `apex-recall` returns useful context, skip redundant file reads.
If empty/errored, continue normally — it's a convenience, not a blocker.

## Multi-Step Workflow

The Steps 1–7 + Post-Lessons table is in [AGENTS.md](../AGENTS.md#agent-workflow);
the machine-readable source is
[`.github/skills/workflow-engine/templates/workflow-graph.json`](skills/workflow-engine/templates/workflow-graph.json).
Each step's outputs land in `agent-output/{project}/`; context flows via artifact
files + handoffs. Reviews are adversarial passes by challenger subagents
(1-pass default; multi-pass opt-in for complex projects). Reviews target AI-
generated creative decisions only (Steps 1, 2, 3.5, 4, 5).

## Skills

Skills auto-discover via the `description` field in `.github/skills/{name}/SKILL.md`.
Agents wire skills by reading the file directly. Default tier is
`SKILL.digest.md`; `SKILL.minimal.md` is the >80%-utilization escalation;
full `SKILL.md` is reserved for skill-authoring/debugging. See the
`context-shredding` skill for tier selection.

## Chat Triggers

- Messages starting with `gh` are GitHub operations (e.g., `gh pr create`,
  `gh workflow run`, `gh api`). Follow `.github/skills/github-operations/SKILL.digest.md`
  (MCP-first, `gh` CLI fallback).

### GitHub MCP Priority (Mandatory)

For issues and pull requests, prefer GitHub MCP tools over `gh` CLI; only fall
back to `gh` for operations with no MCP write equivalent. In devcontainers,
do not run `gh auth` commands unless the user explicitly asks for CLI auth
troubleshooting (`GH_TOKEN` is set via VS Code User Settings →
`terminal.integrated.env.linux`; shell exports do not propagate reliably).

### Explore Subagent Thoroughness

Specify thoroughness explicitly when invoking Explore:

| Lookup Type                           | Thoroughness | Examples                                                  |
| ------------------------------------- | ------------ | --------------------------------------------------------- |
| Single file read, config check        | `quick`      | "What's in azure.yaml?", "Find the main.bicep path"       |
| Multi-file comparison, pattern search | `medium`     | "How do agents reference skills?", "What modules exist?"  |
| Deep codebase research                | `thorough`   | "Audit all security patterns", "Full dependency analysis" |

Check whether the needed information is already in context from earlier
file reads before calling Explore.

## Conventions, Key Files & Validation

See `AGENTS.md` for all conventions, project structure, key file paths,
and build/validation commands.

**Terminal hygiene**: Never use `mv -i`, `rm -i`, `cp -i`, `read -p`, or any
prompt-driven shell builtin (incl. inside `bash -c '...'`). Pipe >50-line
output to a file. See `.github/instructions/no-interactive-shell.instructions.md`
for the full ruleset; `npm run lint:safe-shell` enforces it on committed
agent/skill/instruction snippets.
