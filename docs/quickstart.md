# Quickstart

Get running in 10 minutes.

## Prerequisites

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

## Step 1: Clone and Open

```bash
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
code azure-agentic-infraops
```

## Step 2: Open in Dev Container

1. Press `F1` (or `Ctrl+Shift+P`)
2. Type: `Dev Containers: Reopen in Container`
3. Wait 3-5 minutes for setup

The Dev Container installs all tools automatically:

- Azure CLI + Bicep CLI
- Terraform CLI + TFLint
- PowerShell 7
- Python 3 + diagrams library
- Go (Terraform MCP server)
- 25+ VS Code extensions

## Step 3: Verify Setup

!!! tip "Verify all tools installed correctly"

    Run this command to confirm the dev container has all required CLIs:

```bash
az --version && bicep --version && terraform --version && pwsh --version
```

## Step 4: Enable Subagent Orchestration

!!! warning "Required"

    The Conductor pattern requires this setting.

Add this to your **VS Code User Settings** (`Ctrl+,` → Settings JSON):

```json
{
  "chat.customAgentInSubagent.enabled": true
}
```

**Why User Settings?** Workspace settings exist in `.vscode/settings.json`, but user settings
take precedence for experimental features like subagent invocation.

**Verify it's enabled:**

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type: `Preferences: Open User Settings (JSON)`
3. Confirm the setting is present

## Step 5: Start the Conductor

### Option A: InfraOps Conductor (Recommended)

The Conductor (🎼 Maestro) orchestrates the complete 7-step workflow:

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

The Conductor guides you through all 7 steps with approval gates.

### Option B: Direct Agent Invocation

Invoke agents directly for specific tasks:

1. Press `Ctrl+Shift+A` to open the agent picker
2. Select the specific agent (e.g., `requirements`)
3. Enter your prompt

## Step 6: Follow the Workflow

The agents work in sequence with handoffs. Steps 1-3 and 7 are shared;
steps 4-6 route to **Bicep** or **Terraform** agents based on your `iac_tool` selection.

| Step | Agent                                 | Persona       | What Happens             |
| ---- | ------------------------------------- | ------------- | ------------------------ |
| 1    | `requirements`                        | 📜 Scribe     | Captures requirements    |
| 2    | `architect`                           | 🏛️ Oracle     | WAF assessment           |
| 3    | `design`                              | 🎨 Artisan    | Diagrams/ADRs (optional) |
| 4    | `bicep-planner` / `terraform-planner` | 📐 Strategist | Implementation plan      |
| 5    | `bicep-codegen` / `terraform-codegen` | ⚒️ Forge      | IaC templates            |
| 6    | `bicep-deploy` / `terraform-deploy`   | 🚀 Envoy      | Azure deployment         |
| 7    | `as-built`                            | 📚 Chronicler | Documentation suite      |

**Approval Gates**: The Conductor pauses at key points:

- ⛔ **Gate 1**: After requirements (Step 1) — confirm requirements
- ⛔ **Gate 2**: After architecture (Step 2) — approve WAF assessment
- ⛔ **Gate 3**: After planning (Step 4) — approve implementation plan
- ⛔ **Gate 4**: After validation (Step 5) — approve preflight results
- ⛔ **Gate 5**: After deployment (Step 6) — verify resources

## What You've Created

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

## Next Steps

| Goal                           | Resource                                 |
| ------------------------------ | ---------------------------------------- |
| Understand the full workflow   | [workflow.md](workflow.md)               |
| Try a complete workflow        | [Prompt Guide](prompt-guide/index.md)    |
| Generate architecture diagrams | Use `azure-diagrams` skill               |
| Create documentation           | Use `azure-artifacts` skill              |
| Explore Terraform patterns     | Use `terraform-patterns` skill           |
| Troubleshoot issues            | [troubleshooting.md](troubleshooting.md) |

## Quick Reference

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
