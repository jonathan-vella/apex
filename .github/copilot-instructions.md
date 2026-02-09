# Agentic InfraOps - Copilot Instructions

> Azure infrastructure engineered by agents. Verified. Well-Architected. Deployable.

## Quick Start

1. Enable subagents: `"github.copilot.chat": { "customAgentInSubagent": { "enabled": true } }`
2. Open Chat (`Ctrl+Shift+I`) → Select **InfraOps Conductor** → Describe your project
3. The Conductor guides you through all 7 steps with approval gates

## 7-Step Workflow

| Step | Agent | Output | Gate |
| --- | --- | --- | --- |
| 1 | Requirements | `01-requirements.md` | Approval |
| 2 | Architect | `02-architecture-assessment.md` + cost estimate | Approval |
| 3 | Design (opt) | `03-des-*.{py,png,md}` | — |
| 4 | Bicep Plan | `04-implementation-plan.md` + governance | Approval |
| 5 | Bicep Code | `infra/bicep/{project}/` | Validation |
| 6 | Deploy | `06-deployment-summary.md` | Approval |
| 7 | As-Built | `07-*.md` documentation suite | — |

All outputs → `agent-output/{project}/`. Context flows via artifact files + handoffs.

## Skills (Auto-Invoked by Agents)

| Skill | Purpose |
| --- | --- |
| `azure-defaults` | Regions, tags, naming, AVM, security, governance, pricing |
| `azure-artifacts` | Template H2 structures, styling, generation rules |
| `azure-diagrams` | Python architecture diagram generation |
| `azure-adr` | Architecture Decision Records |
| `github-operations` | GitHub issues, PRs, CLI, Actions, releases |
| `git-commit` | Commit message conventions |
| `docs-writer` | Documentation generation |

Agents read skills via: **"Read `.github/skills/{name}/SKILL.md`"** in their body.

## Key Conventions

- **Default region**: `swedencentral` (exception: Static Web Apps → `westeurope`)
- **Required tags**: `Environment`, `ManagedBy`, `Project`, `Owner`
- **Unique suffix**: `uniqueString(resourceGroup().id)` — generate once, pass everywhere
- **AVM-first**: Always prefer Azure Verified Modules over raw Bicep
- **Security baseline**: TLS 1.2, HTTPS-only, managed identity, Azure AD-only SQL auth

Full details in `.github/skills/azure-defaults/SKILL.md`.

## Key Files

| Path | Purpose |
| --- | --- |
| `.github/agents/*.agent.md` | Agent definitions |
| `.github/skills/*/SKILL.md` | Reusable skill knowledge |
| `.github/instructions/` | File-type rules (Bicep, Markdown, etc.) |
| `agent-output/{project}/` | Agent-generated artifacts |
| `infra/bicep/{project}/` | Bicep templates |
| `mcp/azure-pricing-mcp/` | Azure Pricing MCP server |
| `.vscode/mcp.json` | MCP server configuration |

## Validation

```bash
bicep build infra/bicep/{project}/main.bicep
bicep lint infra/bicep/{project}/main.bicep
npm run validate
npm run lint:md
```
