# Agentic InfraOps - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Quick Start

1. Enable subagents: `"github.copilot.chat": { "customAgentInSubagent": { "enabled": true } }`
2. Open Chat (`Ctrl+Shift+I`) → Select **InfraOps Conductor** → Describe your project
3. The Conductor guides you through all 7 steps with approval gates

## 7-Step Workflow

| Step | Agent                                                                      | Output                                                                                                    | Review | Gate       |
| ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 1    | Requirements                                                               | `01-requirements.md`                                                                                      | 1x     | Approval   |
| 2    | Architect                                                                  | `02-architecture-assessment.md` + cost estimate                                                           | 3x+1x  | Approval   |
| 3    | Design (opt)                                                               | `03-des-*.{py,png,md}`                                                                                    | —      | —          |
| 4    | IaC Plan (Bicep: `05b-Bicep Planner` / Terraform: `05t-Terraform Planner`) | `04-implementation-plan.md` + governance + `04-dependency-diagram.py/.png` + `04-runtime-diagram.py/.png` | 1x+3x  | Approval   |
| 5    | IaC Code (Bicep: `06b-Bicep CodeGen` / Terraform: `06t-Terraform CodeGen`) | `infra/bicep/{project}/` or `infra/terraform/{project}/`                                                  | 3x     | Validation |
| 6    | Deploy (Bicep: `07b-Bicep Deploy` / Terraform: `07t-Terraform Deploy`)     | `06-deployment-summary.md`                                                                                | 1x     | Approval   |
| 7    | As-Built                                                                   | `07-*.md` documentation suite                                                                             | —      | —          |

All outputs → `agent-output/{project}/`. Context flows via artifact files + handoffs.
Review column = adversarial passes by `challenger-review-subagent` (3x = rotating lenses; 1x = comprehensive).

## Skills (Auto-Invoked by Agents)

| Skill                      | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `azure-defaults`           | Regions, tags, naming, AVM, security, governance, pricing             |
| `azure-artifacts`          | Template H2 structures, styling, generation rules                     |
| `azure-bicep-patterns`     | Reusable Bicep patterns (hub-spoke, PE, diagnostics)                  |
| `azure-troubleshooting`    | KQL templates, health checks, remediation playbooks                   |
| `azure-diagrams`           | Python architecture diagram generation                                |
| `azure-adr`                | Architecture Decision Records                                         |
| `github-operations`        | GitHub issues, PRs, CLI, Actions, releases                            |
| `git-commit`               | Commit message conventions                                            |
| `docs-writer`              | Documentation generation                                              |
| `make-skill-template`      | Scaffold new Agent Skills from templates                              |
| `microsoft-docs`           | Query official Microsoft/Azure docs (requires Learn MCP)              |
| `microsoft-code-reference` | Verify SDK methods and find working code samples (requires Learn MCP) |
| `microsoft-skill-creator`  | Create hybrid skills for Microsoft technologies (requires Learn MCP)  |
| `terraform-patterns`       | Terraform HCL patterns (hub-spoke, PE, diagnostics, AVM pitfalls)     |
| `session-resume`           | Session state tracking, resume protocol, context budgets              |

Agents read skills via: **"Read `.github/skills/{name}/SKILL.md`"** in their body.

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
