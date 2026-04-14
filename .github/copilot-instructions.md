# APEX - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Quick Start

1. Enable subagents: `"github.copilot.chat": { "customAgentInSubagent": { "enabled": true } }`
2. Open Chat (`Ctrl+Shift+I`) → Select **Orchestrator** → Describe your project
3. The Orchestrator guides you through all steps with approval gates

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
Review column = adversarial passes by challenger subagents; 1-pass default, multi-pass opt-in
Single-pass comprehensive review is the default; multi-pass rotating lens is opt-in for complex projects.
Reviews target AI-generated creative decisions only (Steps 1, 2, 3.5, 4, 5).

## Skills (Auto-Invoked by Agents)

| Skill                         | Purpose                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `appinsights-instrumentation` | Application Insights telemetry patterns, SDK setup, APM best practices                            |
| `azure-adr`                   | Architecture Decision Records                                                                     |
| `azure-ai`                    | Azure AI services (Search, Speech, OpenAI, Document Intelligence)                                 |
| `azure-aigateway`             | Azure API Management as AI Gateway for models, MCP tools, agents                                  |
| `azure-artifacts`             | Template H2 structures, styling, generation rules                                                 |
| `azure-bicep-patterns`        | Reusable Bicep patterns (hub-spoke, PE, diagnostics)                                              |
| `azure-cloud-migrate`         | Cross-cloud migration assessment and code conversion to Azure                                     |
| `azure-compliance`            | Compliance scanning, security auditing, Key Vault expiration monitoring                           |
| `azure-compute`               | VM size recommendations, VMSS, configuration guidance                                             |
| `azure-cost-optimization`     | Cost savings analysis, utilization metrics, optimization recommendations                          |
| `azure-defaults`              | Regions, tags, naming, AVM, security, governance, pricing                                         |
| `azure-deploy`                | Execute Azure deployments (azd up, terraform apply, az deployment)                                |
| `azure-diagnostics`           | KQL templates, health checks, remediation playbooks                                               |
| `azure-diagrams`              | Routing skill — delegates to drawio, python-diagrams, mermaid                                     |
| `azure-hosted-copilot-sdk`    | Build and deploy GitHub Copilot SDK apps to Azure                                                 |
| `azure-kusto`                 | KQL queries for Azure Data Explorer, log analytics, time series                                   |
| `azure-messaging`             | Troubleshoot Azure Event Hubs and Service Bus SDK issues                                          |
| `azure-prepare`               | Prepare Azure apps for deployment (infra, azure.yaml, Dockerfiles)                                |
| `azure-quotas`                | Check and manage Azure quotas, usage, capacity validation                                         |
| `azure-rbac`                  | Find least-privilege RBAC roles, generate assignment CLI/Bicep                                    |
| `azure-resource-lookup`       | List, find, and show Azure resources across subscriptions                                         |
| `azure-resource-visualizer`   | Analyze resource groups and generate Mermaid architecture diagrams                                |
| `azure-storage`               | Blob, File, Queue, Table Storage and Data Lake guidance                                           |
| `azure-validate`              | Pre-deployment validation for Azure readiness                                                     |
| `context-optimizer`           | Audit agent context window usage, token profiling, redundancy detection                           |
| `context-shredding`           | Runtime context compression tiers for large artifacts                                             |
| `copilot-customization`       | VS Code Copilot customization (instructions, agents, skills, MCP)                                 |
| `count-registry`              | Canonical entity counts from count-manifest.json                                                  |
| `docs-writer`                 | Documentation generation                                                                          |
| `drawio`                      | Azure architecture diagrams via MCP server (700+ Azure icons, batch creation, transactional mode) |
| `entra-app-registration`      | Microsoft Entra ID app registration, OAuth 2.0, MSAL integration                                  |
| `excalidraw`                  | Hand-drawn whiteboarding, brainstorming, wireframes, informal sketches                            |
| `github-operations`           | GitHub issues, PRs, CLI, Actions, releases, commit conventions                                    |
| `golden-principles`           | The 10 agent-first operating principles governing agent behavior                                  |
| `iac-common`                  | Shared IaC deploy patterns, circuit breaker, known deploy issues                                  |
| `make-skill-template`         | Scaffold new Agent Skills from templates                                                          |
| `mermaid`                     | Inline Mermaid diagrams for markdown documentation                                                |
| `microsoft-code-reference`    | Azure SDK/API verification and code sample lookup                                                 |
| `microsoft-docs`              | Official Microsoft documentation search and retrieval                                             |
| `microsoft-foundry`           | Deploy, evaluate, and manage Foundry agents end-to-end                                            |
| `microsoft-skill-creator`     | Generate custom agent skills for Microsoft technologies                                           |
| `python-diagrams`             | Python charts (WAF/cost/compliance) and diagrams library patterns                                 |
| `session-resume`              | Session state tracking, resume protocol, context budgets                                          |
| `terraform-patterns`          | Terraform HCL patterns (hub-spoke, PE, diagnostics, AVM pitfalls)                                 |
| `terraform-search-import`     | Azure resource discovery and bulk Terraform import                                                |
| `terraform-test`              | Terraform testing framework (.tftest.hcl, mocks, assertions)                                      |
| `workflow-engine`             | DAG workflow graph, complexity routing, step definitions                                          |

Agents read skills via: **"Read `.github/skills/{name}/SKILL.md`"** in their body.
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

## Key Conventions

See the root `AGENTS.md` for full conventions. Summary of VS Code-specific overrides:

- **AVM-first**: Always prefer Azure Verified Modules over raw Bicep/Terraform
- **Governance**: Always check `04-governance-constraints.md` for subscription-level Azure Policy

Full details in `.github/skills/azure-defaults/SKILL.md`.

### Terraform Conventions

Full details in `.github/skills/terraform-patterns/SKILL.md` and root `AGENTS.md`.

## Key Files

| Path                                           | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `AGENTS.md`                                    | Cross-agent project conventions and commands                                 |
| `.github/agents/*.agent.md`                    | Agent definitions                                                            |
| `.github/skills/*/SKILL.md`                    | Reusable skill knowledge                                                     |
| `.github/instructions/`                        | File-type rules (Bicep, Markdown, etc.)                                      |
| `.github/agent-registry.json`                  | Agent role → file/model/skills mapping                                       |
| `.github/skill-affinity.json`                  | Skill/agent affinity weights                                                 |
| `agent-output/{project}/`                      | Agent-generated artifacts                                                    |
| `agent-output/{project}/00-session-state.json` | Machine-readable workflow progress (session-resume skill)                    |
| `infra/bicep/{project}/`                       | Bicep templates                                                              |
| `mcp/azure-pricing-mcp/`                       | Azure Pricing MCP server                                                     |
| `.vscode/mcp.json`                             | MCP server configuration (github, azure-pricing, terraform, microsoft-learn) |
| `infra/terraform/{project}/`                   | Terraform templates by project                                               |

## Validation

See `AGENTS.md` for full build and validation commands. Quick reference:

```bash
npm run validate:all
npm run lint:md
```
