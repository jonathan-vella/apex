# Agentic InfraOps - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Quick Start

1. Enable subagents: `"github.copilot.chat": { "customAgentInSubagent": { "enabled": true } }`
2. Open Chat (`Ctrl+Shift+I`) → Select **InfraOps Conductor** → Describe your project
3. The Conductor guides you through all 8 steps with approval gates

## 8-Step Workflow

| Step | Agent                                                                      | Output                                                                                       | Review   | Gate       |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | ---------- |
| 1    | Requirements                                                               | `01-requirements.md`                                                                         | 1×       | Approval   |
| 2    | Architect                                                                  | `02-architecture-assessment.md` + cost estimate                                              | 1×–3×+1× | Approval   |
| 3    | Design (opt)                                                               | `03-des-*.{py,png,md}`                                                                       | —        | —          |
| 3.5  | Governance (`04g-Governance`)                                              | `04-governance-constraints.md/.json`                                                         | —        | Approval   |
| 4    | IaC Plan (Bicep: `05b-Bicep Planner` / Terraform: `05t-Terraform Planner`) | `04-implementation-plan.md` + `04-dependency-diagram.py/.png` + `04-runtime-diagram.py/.png` | 1×–2×    | Approval   |
| 5    | IaC Code (Bicep: `06b-Bicep CodeGen` / Terraform: `06t-Terraform CodeGen`) | `infra/bicep/{project}/` or `infra/terraform/{project}/`                                     | 1×–3×    | Validation |
| 6    | Deploy (Bicep: `07b-Bicep Deploy` / Terraform: `07t-Terraform Deploy`)     | `06-deployment-summary.md`                                                                   | —        | Approval   |
| 7    | As-Built                                                                   | `07-*.md` documentation suite                                                                | —        | —          |

All outputs → `agent-output/{project}/`. Context flows via artifact files + handoffs.
Review column = adversarial passes by challenger subagents, complexity-dependent
(simple: 4, standard: 5–7, complex: 8).
Reviews target AI-generated creative decisions only (Steps 1, 2, 4, 5).

## Skills (Auto-Invoked by Agents)

| Skill                   | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `azure-defaults`        | Regions, tags, naming, AVM, security, governance, pricing         |
| `azure-artifacts`       | Template H2 structures, styling, generation rules                 |
| `azure-bicep-patterns`  | Reusable Bicep patterns (hub-spoke, PE, diagnostics)              |
| `azure-troubleshooting` | KQL templates, health checks, remediation playbooks               |
| `azure-diagrams`        | Python architecture diagram generation                            |
| `azure-adr`             | Architecture Decision Records                                     |
| `github-operations`     | GitHub issues, PRs, CLI, Actions, releases                        |
| `git-commit`            | Commit message conventions                                        |
| `docs-writer`           | Documentation generation                                          |
| `make-skill-template`   | Scaffold new Agent Skills from templates                          |
| `terraform-patterns`    | Terraform HCL patterns (hub-spoke, PE, diagnostics, AVM pitfalls) |
| `session-resume`        | Session state tracking, resume protocol, context budgets          |
| `workflow-engine`       | DAG workflow graph, complexity routing, step definitions          |
| `context-shredding`     | Runtime context compression tiers for large artifacts             |

Agents read skills via: **"Read `.github/skills/{name}/SKILL.digest.md`"** in their body.
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

## Key Conventions

See the root `AGENTS.md` for full conventions. Summary of VS Code-specific overrides:

- **AVM-first**: Always prefer Azure Verified Modules over raw Bicep/Terraform
- **Governance**: Always check `04-governance-constraints.md` for subscription-level Azure Policy

Full details in `.github/skills/azure-defaults/SKILL.md`.

### Terraform Conventions

Full details in `.github/skills/terraform-patterns/SKILL.md` and root `AGENTS.md`.

## Key Files

| Path                                           | Purpose                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `AGENTS.md`                                    | Cross-agent project conventions and commands              |
| `.github/agents/*.agent.md`                    | Agent definitions                                         |
| `.github/skills/*/SKILL.md`                    | Reusable skill knowledge                                  |
| `.github/instructions/`                        | File-type rules (Bicep, Markdown, etc.)                   |
| `.github/agent-registry.json`                  | Agent role → file/model/skills mapping                    |
| `.github/skill-affinity.json`                  | Skill/agent affinity weights                              |
| `agent-output/{project}/`                      | Agent-generated artifacts                                 |
| `agent-output/{project}/00-session-state.json` | Machine-readable workflow progress (session-resume skill) |
| `infra/bicep/{project}/`                       | Bicep templates                                           |
| `mcp/azure-pricing-mcp/`                       | Azure Pricing MCP server                                  |
| `.vscode/mcp.json`                             | MCP server configuration                                  |
| `infra/terraform/{project}/`                   | Terraform templates by project                            |
| `docs/tf-support/`                             | Terraform support planning docs and prompts               |

## Validation

See `AGENTS.md` for full build and validation commands. Quick reference:

```bash
npm run validate:all
npm run lint:md
```
