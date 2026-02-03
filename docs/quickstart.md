# Quickstart

> Version 8.0.0 | Get running in 10 minutes

## Prerequisites

| Requirement | How to Get |
|-------------|------------|
| GitHub account | [Sign up](https://github.com/signup) |
| GitHub Copilot license | [Get Copilot](https://github.com/features/copilot) |
| VS Code | [Download](https://code.visualstudio.com/) |
| Docker Desktop | [Download](https://www.docker.com/products/docker-desktop/) |
| Azure subscription | [Free trial](https://azure.microsoft.com/free/) |

---

## Step 1: Clone and Open

```bash
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
code azure-agentic-infraops
```

---

## Step 2: Open in Dev Container

1. Press `F1` (or `Ctrl+Shift+P`)
2. Type: `Dev Containers: Reopen in Container`
3. Wait 3-5 minutes for setup

The Dev Container installs all tools automatically:

- Azure CLI + Bicep CLI
- PowerShell 7
- Python 3 + diagrams library
- 25+ VS Code extensions

---

## Step 3: Verify Setup

```bash
az --version && bicep --version && pwsh --version
```

---

## Step 4: First Agent Run

### Open Copilot Chat

Press `Ctrl+Shift+A` to open the agent picker.

### Select Requirements Agent

Choose `requirements` from the dropdown.

### Enter Your Prompt

```text
Create requirements for a simple web app in Azure.

Requirements:
- App Service for web frontend
- Azure SQL Database for data
- Key Vault for secrets
- Region: swedencentral
- Environment: dev
- Project name: my-webapp
```

### Approve the Output

When prompted, reply `yes` to approve and continue.

---

## Step 5: Continue the Workflow

After requirements, the workflow continues:

| Step | Agent | What Happens |
|------|-------|--------------|
| 2 | `architect` | WAF assessment |
| 4 | `bicep-plan` | Implementation plan |
| 5 | `bicep-code` | Bicep templates |
| 6 | `deploy` | Azure deployment |

Each agent hands off to the next. Follow the prompts.

---

## What You've Created

After completing the workflow:

```
agent-output/my-webapp/
├── 01-requirements.md
├── 02-architecture-assessment.md
├── 04-implementation-plan.md
├── 05-implementation-reference.md
└── 06-deployment-summary.md

infra/bicep/my-webapp/
├── main.bicep
└── modules/
    ├── app-service.bicep
    ├── sql-database.bicep
    └── key-vault.bicep
```

---

## Next Steps

| Goal | Resource |
|------|----------|
| Understand the full workflow | [workflow.md](workflow.md) |
| Try a complete scenario | [S01-bicep-baseline](../scenarios/S01-bicep-baseline/) |
| Generate architecture diagrams | Use `azure-diagrams` skill |
| Create documentation | Use `azure-workload-docs` skill |

---

## Quick Reference

### Agent Invocation

```
Ctrl+Shift+A → Select agent → Type prompt → Approve
```

### Skill Invocation

Skills activate automatically based on your prompt:

- "Create an architecture diagram" → `azure-diagrams`
- "Generate an ADR" → `azure-adr`
- "Create workload documentation" → `azure-workload-docs`

Or invoke explicitly:

```text
Use the azure-diagrams skill to create a diagram for my-webapp
```
