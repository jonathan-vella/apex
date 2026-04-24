# APEX - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Quick Start

1. Open Chat (`Ctrl+Shift+I`) → Select **Orchestrator** → Describe your project
2. The Orchestrator guides you through all steps with approval gates

Subagent support is pre-configured in `.vscode/settings.json`.

## Session State — apex-recall

All session state is managed through `apex-recall`. Do not read or write
`00-session-state.json` directly.

```bash
# On start/resume
apex-recall show <project> --json       # full context: step, decisions, findings, artifacts

# During work
apex-recall checkpoint <project> <step> <phase> --json   # after each phase
apex-recall decide <project> --key <k> --value <v> --json # record decisions
apex-recall decide <project> --decision "<text>" --rationale "<why>" --json # decision log
apex-recall finding <project> --add "<text>" --json       # add findings

# On completion
apex-recall complete-step <project> <step> --json

# New project
apex-recall init <project> --json

# Review tracking
apex-recall review-audit <project> <step> ... --json
```

If `apex-recall` returns useful context, skip redundant file reads.
If it returns empty results or errors, continue normally — it is a convenience, not a blocker.

Orientation (read-only): `apex-recall sessions`, `files`, `search '<term>'`, `decisions` — all accept `--json`.

## Multi-Step Workflow

| Step | Agent                                                                      | Output                                                                                       | Review                           | Gate       |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------- | ---------- |
| 1    | Requirements                                                               | `01-requirements.md`                                                                         | 1×                               | Approval   |
| 2    | Architect                                                                  | `02-architecture-assessment.md` + cost estimate                                              | 1× + 1 cost (opt-in: multi-pass) | Approval   |
| 3    | Design (opt)                                                               | `03-des-*.{py,png,md}` diagrams and ADRs                                                     | —                                | —          |
| 3.5  | Governance (`04g-Governance`)                                              | `04-governance-constraints.md/.json`                                                         | 1×                               | Approval   |
| 4    | IaC Plan (`05-IaC Planner`)                                                | `04-implementation-plan.md` + `04-dependency-diagram.py/.png` + `04-runtime-diagram.py/.png` | opt-in (default: skip)           | Approval   |
| 5    | IaC Code (Bicep: `06b-Bicep CodeGen` / Terraform: `06t-Terraform CodeGen`) | `infra/bicep/{project}/` or `infra/terraform/{project}/`                                     | opt-in (default: skip)           | Validation |
| 6    | Deploy (Bicep: `07b-Bicep Deploy` / Terraform: `07t-Terraform Deploy`)     | `06-deployment-summary.md`                                                                   | —                                | Approval   |
| 7    | As-Built                                                                   | `07-*.md` documentation suite                                                                | —                                | —          |
| Post | Lessons (Orchestrator)                                                     | `09-lessons-learned.json/.md`                                                                | —                                | —          |

All outputs → `agent-output/{project}/`. Context flows via artifact files + handoffs.
Programmatic source of truth: `.github/skills/workflow-engine/templates/workflow-graph.json`.
Review = adversarial passes by challenger subagents; 1-pass default, multi-pass opt-in for complex projects.
Reviews target AI-generated creative decisions only (Steps 1, 2, 3.5, 4, 5).

## Skills

Skills are auto-discovered via the `description` field in each `.github/skills/{name}/SKILL.md`.
Agents load skills by reading the SKILL.md file directly.
At >60% context, agents load `SKILL.digest.md` (compact); at >80% they load
`SKILL.minimal.md`. See the `context-shredding` skill for tier selection.

## Chat Triggers

- If a user message starts with `gh`, treat it as a GitHub operation.
  Examples: `gh pr create ...`, `gh workflow run ...`, `gh api ...`.
- Automatically follow the `github-operations` skill guidance (MCP-first, `gh` CLI fallback) from `.github/skills/github-operations/SKILL.md`.

### GitHub MCP Priority (Mandatory)

- For issues and pull requests, always prefer GitHub MCP tools over `gh` CLI.
- Only use `gh` for operations that have no equivalent MCP write tool in the current environment.
- In devcontainers, do not run `gh auth` commands unless the user explicitly asks for CLI authentication troubleshooting.
- `GH_TOKEN` is set via VS Code User Settings (`terminal.integrated.env.linux`) — shell exports do not propagate reliably.

### Explore Subagent Thoroughness

When invoking the Explore subagent, always specify thoroughness explicitly:

| Lookup Type                           | Thoroughness | Examples                                                  |
| ------------------------------------- | ------------ | --------------------------------------------------------- |
| Single file read, config check        | `quick`      | "What's in azure.yaml?", "Find the main.bicep path"       |
| Multi-file comparison, pattern search | `medium`     | "How do agents reference skills?", "What modules exist?"  |
| Deep codebase research                | `thorough`   | "Audit all security patterns", "Full dependency analysis" |

Before calling Explore, check whether the needed information is already in context
from files read earlier in the session.

## Conventions, Key Files & Validation

See `AGENTS.md` for all conventions, project structure, key file paths,
and build/validation commands.
