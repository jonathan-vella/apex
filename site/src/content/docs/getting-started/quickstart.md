---
title: "Quickstart"
description: "Get started with APEX in minutes"
---

<img src="/azure-agentic-infraops/images/hero-quickstart.jpg"
    width="100%" height="250" style="object-fit: cover; border-radius: 10px;"
    alt="Getting started with development tools"/>

Get running in 10 minutes.

:::note[Template repository]
You do **not** clone this repository directly. Instead, you create your own
repository from the
[Accelerator template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator),
which gives you a clean starting point with all agents, skills, and dev container
configuration ready to go.
:::

## Prerequisites

:::note[What you need]
Items marked ⭐ are required for learning. An Azure subscription is optional — you only need it
when deploying to Azure in Step 6.
:::

| Requirement                | How to Get                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| ⭐ GitHub account          | [Sign up](https://github.com/signup)                                                     |
| ⭐ GitHub Copilot license  | Business or Enterprise required — [see plans](https://github.com/features/copilot/plans) |
| ⭐ GitHub fine-grained PAT | Required for devcontainer GitHub auth via `GH_TOKEN`                                     |
| ⭐ VS Code                 | [Download](https://code.visualstudio.com/)                                               |
| ⭐ Docker Desktop          | [Download](https://www.docker.com/products/docker-desktop/)                              |
| Azure subscription         | Optional — required only for Step 6 deployment                                           |

:::note[Docker is required]
A Docker-compatible runtime is needed for the dev container. [Docker Desktop](https://www.docker.com/products/docker-desktop/)
is the most common choice. Free alternatives include [Rancher Desktop](https://rancherdesktop.io/),
[Colima](https://github.com/abiosoft/colima) (macOS), and [Podman](https://podman.io/) (Linux/macOS).
See [Dev Container Setup](../dev-containers/) for detailed installation options.
:::

:::tip[If the dev container fails to build]

1. Check the VS Code terminal for error messages
2. Verify Docker is running (`docker ps` should succeed)
3. Follow recovery steps in [Dev Container Setup](../dev-containers/)
   and [Troubleshooting](../../guides/troubleshooting/)

Most setup failures happen before APEX itself starts.
:::

:::caution[Configure `GH_TOKEN` before you open the container]
GitHub operations inside the devcontainer depend on a fine-grained Personal Access Token exposed as
`GH_TOKEN` through **VS Code User Settings**. Shell exports inside the container are not reliable and
do not survive rebuilds. The full setup is documented on [Dev Container Setup](../dev-containers/),
but the minimum working configuration is included below so you do not miss it.
:::

## Step 1: Create Your Repository from the Template

1. Go to the
   [Accelerator template repository](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator)
2. Click the green **"Use this template"** button → **"Create a new repository"**
3. Choose an owner and repository name (e.g. `my-infraops-project`)
4. Select **Public** or **Private** visibility
5. Click **Create repository**

:::tip[What is a template repository?]
A [GitHub template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
creates a brand-new repository with the same directory structure and files — but
with a clean commit history and no fork relationship. Your repo is entirely yours.
:::

## Step 2: Clone and Open

Clone **your new repository** (not this upstream project):

```bash
git clone https://github.com/YOUR-USERNAME/my-infraops-project.git # (1)!
code my-infraops-project
```

1. Replace `YOUR-USERNAME/my-infraops-project` with your actual
   GitHub username and the repository name you chose in Step 1.

## Step 3: Open in Dev Container

:::tip[What is a dev container?]
A [dev container](https://containers.dev/) is a pre-configured development environment
that runs inside a Docker container. It ensures every contributor has identical tools,
extensions, and settings — no manual setup required. See the
[Dev Container Setup](../dev-containers/) page for details.
:::

1. Press `F1` (or `Ctrl+Shift+P`)
2. Type: `Dev Containers: Reopen in Container`
3. Wait 3-5 minutes for setup

The Dev Container installs all tools automatically:

- Azure CLI + Bicep CLI
- Terraform CLI + TFLint
- PowerShell 7
- Python 3 + diagrams library
- Go (Terraform MCP server)
- `apex-recall` CLI (session recall)
- Comprehensive set of VS Code extensions

## Step 4: Set Up Azure (Optional)

If you plan to deploy to Azure or run the governance baseline workflow, configure
your Azure environment with a single command:

```bash
npm run setup
```

This creates an Entra ID app registration, OIDC federated credentials, RBAC
roles, and GitHub secrets/variables. See [Azure Setup](../azure-setup/) for
details and manual alternatives.

:::note[Skip this if you are just learning]
Azure setup is only required for Step 6 (Deploy) and the governance baseline
workflow. You can explore the full agent workflow without it.
:::

:::tip[Plan for cost before you deploy]
Deploying to a real subscription always costs money. Before Step 6, set
budget alerts and anomaly detection per
[Cost Governance](../../guides/cost-governance/) so a runaway deployment
cannot drain a credit pool unnoticed.
:::

## Step 5: Configure `GH_TOKEN` for the Dev Container

This step is easy to miss, but it is required for reliable GitHub CLI and repository operations in
the devcontainer.

:::caution[Use VS Code User Settings, not `export GH_TOKEN=...`]
Set `GH_TOKEN` in **VS Code User Settings** so the devcontainer can forward it automatically.
Adding it in `.bashrc`, `.profile`, or an in-container shell session does not persist reliably.
:::

1. Create a **fine-grained** GitHub Personal Access Token
2. Grant at least these permissions:

| Permission    | Level      |
| ------------- | ---------- |
| Contents      | Read/Write |
| Metadata      | Read       |
| Pull requests | Read/Write |
| Issues        | Read/Write |
| Workflows     | Read/Write |

1. Open **VS Code User Settings (JSON)**
2. Add this entry and replace the placeholder token value:

```jsonc
"terminal.integrated.env.linux": { "GH_TOKEN": "github_pat_your_token_here" }
```

1. Rebuild the devcontainer: `F1` → `Dev Containers: Rebuild Container`
2. Run `gh auth status` inside the container and confirm it shows a logged-in token-based
   session

See [Dev Container Setup](../dev-containers/) for the full explanation, screenshots, and token
rotation guidance.

## Step 6: Verify Setup

:::tip[Verify all tools installed correctly]
Run these commands to confirm the dev container has all required CLIs and GitHub authentication:
:::

```bash
gh auth status
az --version && bicep --version && terraform --version && pwsh --version # (1)!
```

1. `gh auth status` should show a token-backed login, and all four CLIs should print
   version numbers. If any fail, rebuild or reopen the dev container.

## Step 7: Enable Subagent Orchestration

:::caution[Required]
The Orchestrator pattern requires this setting.
:::

Without this setting, the Orchestrator cannot delegate to specialized agents,
so multi-step workflows will stall after the first response.

Add this to your **VS Code User Settings** (`Ctrl+,` → Settings JSON):

```json
{
  "chat.customAgentInSubagent.enabled": true // (1)!
}
```

1. This must be in **User Settings**, not Workspace Settings.
   Experimental features require user-level configuration.

**Why User Settings?** Workspace settings exist in `.vscode/settings.json`, but user settings
take precedence for experimental features like subagent invocation.

**Verify it's enabled:**

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: `Preferences: Open User Settings (JSON)`
3. Confirm the setting is present

## Step 8: Start the Orchestrator

### Option A: Orchestrator (Recommended)

The Orchestrator (🧠 Orchestrator) orchestrates the complete multi-step workflow:

1. Press `Ctrl+Shift+I` to open Copilot Chat
2. Select **Orchestrator** from the agent dropdown
3. Describe your project:

```text
Create a simple web app in Azure with:
- App Service for web frontend
- Azure SQL Database for data
- Key Vault for secrets
- Region: swedencentral
- Environment: dev
- Project name: my-webapp
```

The Orchestrator guides you through all steps with approval gates.

### Option B: Direct Agent Invocation

Invoke agents directly for specific tasks:

1. Press `Ctrl+Shift+A` to open the agent picker
2. Select the specific agent (e.g., `requirements`)
3. Enter your prompt

## Step 9: Follow the Workflow

The agents work in sequence with handoffs. Steps 1-3.5 and 7 are shared;
steps 4-6 route to **Bicep** or **Terraform** agents based on your `iac_tool` selection
in Step 1. During requirements gathering, the Requirements agent asks which IaC tool
you prefer — this choice determines which planning, code generation, and deployment
agents the Orchestrator invokes.

Each agent has a thematic codename for easy reference in documentation and prompts.

| Step | Agent                                 | Codename      | What Happens                |
| ---- | ------------------------------------- | ------------- | --------------------------- |
| 1    | `requirements`                        | 📜 Scribe     | Captures requirements       |
| 2    | `architect`                           | 🏛️ Oracle     | WAF assessment              |
| 3    | `design`                              | 🎨 Artisan    | Diagrams/ADRs (optional)    |
| 3.5  | `governance`                          | 🛡️ Warden     | Policy discovery/compliance |
| 4    | `iac-planner`                         | 📐 Strategist | Implementation plan         |
| 5    | `bicep-codegen` / `terraform-codegen` | ⚒️ Forge      | IaC templates               |
| 6    | `bicep-deploy` / `terraform-deploy`   | 🚀 Envoy      | Azure deployment            |
| 7    | `as-built`                            | 📚 Chronicler | Documentation suite         |

**Approval Gates**: The Orchestrator pauses at key points:

- ⛔ **Gate 1**: After requirements (Step 1) — confirm requirements
- ⛔ **Gate 2**: After architecture (Step 2) — approve WAF assessment
- ⛔ **Gate 2.5**: After governance (Step 3.5) — approve governance constraints
- ⛔ **Gate 3**: After planning (Step 4) — approve implementation plan
- ⛔ **Gate 4**: After validation (Step 5) — approve preflight results
- ⛔ **Gate 5**: After deployment (Step 6) — verify resources

:::tip[If a gate rejects your proposal]
If the Challenger or an approval gate produces `must_fix` findings, return to the
previous step, update your approach based on the feedback, and re-run. The Orchestrator
will re-execute the step and re-trigger the gate. Use the artifact files in
`agent-output/{project}/` to understand what was flagged.
:::

### If a Step Fails

- **Governance returns no policies**: continue if `04-governance-constraints.json`
  shows `discovery_status: "COMPLETE"`. An empty policy list means no deny-effect
  constraints were found for that scope.
- **Pricing, auth, or tooling fails**: fix the environment first, then resume the same step.
  Start with [Troubleshooting](../../guides/troubleshooting/) and
  [Dev Container Setup](../dev-containers/).
- **Security or cost findings block progress**: update the generated plan or code,
  then re-run the same step with the exact failing output so the agent can repair it.

Before you deploy, review the mandatory guidance in
[Security Baseline](../../guides/security-baseline/) and
[Cost Governance](../../guides/cost-governance/).

## What You've Created

After completing the workflow:

```text
agent-output/my-webapp/
├── 01-requirements.md          # Captured requirements (includes iac_tool)
├── 02-architecture-assessment.md  # WAF analysis
├── 03-des-diagram.drawio         # Optional Step 3 architecture diagram
├── 04-implementation-plan.md   # Phased plan
├── 04-dependency-diagram.py        # Step 4 dependency diagram
├── 04-runtime-diagram.py           # Step 4 runtime diagram
├── 04-governance-constraints.md   # Policy discovery
├── 05-implementation-reference.md # Module inventory
├── 06-deployment-summary.md    # Deployed resources
└── 07-*.md                     # Documentation suite

# Bicep track output:
infra/bicep/my-webapp/
├── main.bicep                  # Entry point
├── main.bicepparam             # Parameters
└── modules/
    ├── app-service.bicep
    ├── sql-database.bicep
    └── key-vault.bicep

# — OR — Terraform track output:
infra/terraform/my-webapp/
├── main.tf                     # Entry point
├── variables.tf                # Input variables
├── outputs.tf                  # Outputs
├── terraform.tfvars            # Variable values
└── modules/
    ├── app-service/
    ├── sql-database/
    └── key-vault/
```

## Next Steps

Pick the path that matches your goal — then drop into the resource table below for more.

- **Demo** — walk an end-to-end project: see
  [Il-Pastizzeria ta’ Mario](../../demo/) (a complete end-to-end walkthrough
  from Requirements through As-Built).
- **Learn** — understand the system before building:
  [Core Concepts](../../concepts/how-it-works/four-pillars/) →
  [Workflow](../../concepts/workflow/) →
  [Agent Architecture](../../concepts/how-it-works/agents/).
- **Build** — run the Orchestrator on your own project:
  [Prompt Guide](../../guides/prompt-guide/) for prompt patterns,
  [Security Baseline](../../guides/security-baseline/) and
  [Cost Governance](../../guides/cost-governance/) for the mandatory
  guardrails.

| Goal                            | Resource                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Understand the full workflow    | [workflow.md](../../concepts/workflow/)                                                                   |
| Try a guided hands-on challenge | [MicroHack](https://jonathan-vella.github.io/microhack-agentic-infraops/)                                 |
| Try a complete workflow         | [Prompt Guide](../../guides/prompt-guide/)                                                                |
| Review mandatory guardrails     | [Security Baseline](../../guides/security-baseline/) and [Cost Governance](../../guides/cost-governance/) |
| Generate architecture diagrams  | Use `drawio` skill (or `python-diagrams` for charts)                                                      |
| Create documentation            | Use `azure-artifacts` skill                                                                               |
| Explore Terraform patterns      | Use `terraform-patterns` skill                                                                            |
| Troubleshoot issues             | [troubleshooting.md](../../guides/troubleshooting/)                                                       |
| Contribute to the upstream repo | [azure-agentic-infraops](https://github.com/jonathan-vella/azure-agentic-infraops)                        |

## Quick Reference

### Orchestrator (Orchestrated Workflow)

```text
Ctrl+Shift+I → Orchestrator → Describe project → Follow gates
```

### Direct Agent Invocation

```text
Ctrl+Shift+A → Select agent → Type prompt → Approve
```

### Skill Invocation

Skills activate automatically based on your prompt:

- "Create an architecture diagram" → `drawio`
- "Generate an ADR" → `azure-adr`
- "Create workload documentation" → `azure-artifacts`

Or invoke explicitly:

```text
Use the drawio skill to create a diagram for my-webapp
```
