<div align="center">
  <img src="../assets/images/hero-quickstart.jpg"
    width="100%" height="250" style="object-fit: cover; border-radius: 10px;"
    alt="Getting started with development tools"/>
</div>

# :material-rocket-launch-outline: Quickstart

Get running in 10 minutes.

!!! info "Template repository"

    You do **not** clone this repository directly. Instead, you create your own
    repository from the
    [Accelerator template](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator),
    which gives you a clean starting point with all agents, skills, and dev container
    configuration ready to go.

## :material-clipboard-check-outline: Prerequisites

!!! info "What you need before starting"

    An Azure subscription is optional for learning the workflow — you only need it
    when deploying to Azure in Step 6.

| Requirement            | How to Get                                                  |
| ---------------------- | ----------------------------------------------------------- |
| GitHub account         | [Sign up](https://github.com/signup)                        |
| GitHub Copilot license | [Get Copilot](https://github.com/features/copilot)          |
| VS Code                | [Download](https://code.visualstudio.com/)                  |
| Docker Desktop         | [Download](https://www.docker.com/products/docker-desktop/) |
| Azure subscription     | Optional for learning                                       |

!!! info "Docker is required"

    A Docker-compatible runtime is needed for the dev container. [Docker Desktop](https://www.docker.com/products/docker-desktop/)
    is the most common choice. Free alternatives include [Rancher Desktop](https://rancherdesktop.io/),
    [Colima](https://github.com/abiosoft/colima) (macOS), and [Podman](https://podman.io/) (Linux/macOS).
    See [Dev Container Setup](dev-containers.md) for detailed installation options.

## :material-source-repository: Step 1: Create Your Repository from the Template

1. Go to the
   [Accelerator template repository](https://github.com/jonathan-vella/azure-agentic-infraops-accelerator)
2. Click the green **"Use this template"** button → **"Create a new repository"**
3. Choose an owner and repository name (e.g. `my-infraops-project`)
4. Select **Public** or **Private** visibility
5. Click **Create repository**

!!! tip "What is a template repository?"

    A [GitHub template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
    creates a brand-new repository with the same directory structure and files — but
    with a clean commit history and no fork relationship. Your repo is entirely yours.

## :material-content-copy: Step 2: Clone and Open

Clone **your new repository** (not this upstream project):

```bash
git clone https://github.com/YOUR-USERNAME/my-infraops-project.git # (1)!
code my-infraops-project
```

1. :material-swap-horizontal: Replace `YOUR-USERNAME/my-infraops-project` with your actual
   GitHub username and the repository name you chose in Step 1.

## :material-docker: Step 3: Open in Dev Container

!!! tip "What is a dev container?"

    A [dev container](https://containers.dev/) is a pre-configured development environment
    that runs inside a Docker container. It ensures every contributor has identical tools,
    extensions, and settings — no manual setup required. See the
    [Dev Container Setup](dev-containers.md) page for details.

1. Press `F1` (or `Ctrl+Shift+P`)
2. Type: `Dev Containers: Reopen in Container`
3. Wait 3-5 minutes for setup

The Dev Container installs all tools automatically:

- Azure CLI + Bicep CLI
- Terraform CLI + TFLint
- PowerShell 7
- Python 3 + diagrams library
- Go (Terraform MCP server)
- 27+ VS Code extensions

## :material-check-circle-outline: Step 4: Verify Setup

!!! tip "Verify all tools installed correctly"

    Run this command to confirm the dev container has all required CLIs:

```bash
az --version && bicep --version && terraform --version && pwsh --version # (1)!
```

1. :material-check-all: All four CLIs should print version numbers. If any fail, reopen
   the dev container.

## :material-toggle-switch-outline: Step 5: Enable Subagent Orchestration

!!! warning "Required"

    The Conductor pattern requires this setting.

Add this to your **VS Code User Settings** (`Ctrl+,` → Settings JSON):

```json
{
  "chat.customAgentInSubagent.enabled": true // (1)!
}
```

1. :material-information-outline: This must be in **User Settings**, not Workspace Settings.
   Experimental features require user-level configuration.

**Why User Settings?** Workspace settings exist in `.vscode/settings.json`, but user settings
take precedence for experimental features like subagent invocation.

**Verify it's enabled:**

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: `Preferences: Open User Settings (JSON)`
3. Confirm the setting is present

## :material-play-circle-outline: Step 6: Start the Conductor

### Option A: InfraOps Conductor (Recommended)

The Conductor (🎼 Maestro), also known as the Coordinator, orchestrates the complete 8-step workflow:

1. Press `Ctrl+Shift+I` to open Copilot Chat
2. Select **InfraOps Conductor** from the agent dropdown
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

The Conductor guides you through all 8 steps with approval gates.

### Option B: Direct Agent Invocation

Invoke agents directly for specific tasks:

1. Press `Ctrl+Shift+A` to open the agent picker
2. Select the specific agent (e.g., `requirements`)
3. Enter your prompt

## :material-chart-timeline-variant: Step 7: Follow the Workflow

The agents work in sequence with handoffs. Steps 1-3.5 and 7 are shared;
steps 4-6 route to **Bicep** or **Terraform** agents based on your `iac_tool` selection.

Each agent has a thematic codename for easy reference in documentation and prompts.

| Step | Agent                                 | Codename      | What Happens                |
| ---- | ------------------------------------- | ------------- | --------------------------- |
| 1    | `requirements`                        | 📜 Scribe     | Captures requirements       |
| 2    | `architect`                           | 🏛️ Oracle     | WAF assessment              |
| 3    | `design`                              | 🎨 Artisan    | Diagrams/ADRs (optional)    |
| 3.5  | `governance`                          | 🛡️ Warden     | Policy discovery/compliance |
| 4    | `bicep-planner` / `terraform-planner` | 📐 Strategist | Implementation plan         |
| 5    | `bicep-codegen` / `terraform-codegen` | ⚒️ Forge      | IaC templates               |
| 6    | `bicep-deploy` / `terraform-deploy`   | 🚀 Envoy      | Azure deployment            |
| 7    | `as-built`                            | 📚 Chronicler | Documentation suite         |

**Approval Gates**: The Conductor pauses at key points:

- ⛔ **Gate 1**: After requirements (Step 1) — confirm requirements
- ⛔ **Gate 2**: After architecture (Step 2) — approve WAF assessment
- ⛔ **Gate 2.5**: After governance (Step 3.5) — approve governance constraints
- ⛔ **Gate 3**: After planning (Step 4) — approve implementation plan
- ⛔ **Gate 4**: After validation (Step 5) — approve preflight results
- ⛔ **Gate 5**: After deployment (Step 6) — verify resources

## :material-folder-check-outline: What You've Created

After completing the workflow:

```text
agent-output/my-webapp/
├── 01-requirements.md          # Captured requirements (includes iac_tool)
├── 02-architecture-assessment.md  # WAF analysis
├── 04-implementation-plan.md   # Phased plan
├── 04-dependency-diagram.py     # Step 4 dependency diagram source
├── 04-dependency-diagram.png    # Step 4 dependency diagram image
├── 04-runtime-diagram.py        # Step 4 runtime diagram source
├── 04-runtime-diagram.png       # Step 4 runtime diagram image
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

## :material-arrow-right-circle-outline: Next Steps

| Goal                            | Resource                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Understand the full workflow    | [workflow.md](workflow.md)                                                         |
| Try a guided hands-on challenge | [MicroHack](https://jonathan-vella.github.io/microhack-agentic-infraops/)          |
| Try a complete workflow         | [Prompt Guide](prompt-guide/index.md)                                              |
| Generate architecture diagrams  | Use `azure-diagrams` skill                                                         |
| Create documentation            | Use `azure-artifacts` skill                                                        |
| Explore Terraform patterns      | Use `terraform-patterns` skill                                                     |
| Troubleshoot issues             | [troubleshooting.md](troubleshooting.md)                                           |
| Contribute to the upstream repo | [azure-agentic-infraops](https://github.com/jonathan-vella/azure-agentic-infraops) |

## :material-lightning-bolt: Quick Reference

### Conductor (Orchestrated Workflow)

```text
Ctrl+Shift+I → InfraOps Conductor → Describe project → Follow gates
```

### Direct Agent Invocation

```text
Ctrl+Shift+A → Select agent → Type prompt → Approve
```

### Skill Invocation

Skills activate automatically based on your prompt:

- "Create an architecture diagram" → `azure-diagrams`
- "Generate an ADR" → `azure-adr`
- "Create workload documentation" → `azure-artifacts`

Or invoke explicitly:

```text
Use the azure-diagrams skill to create a diagram for my-webapp
```
