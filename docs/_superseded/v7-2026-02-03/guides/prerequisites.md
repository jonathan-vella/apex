# Prerequisites

> **Version 5.3.0** | [Back to Guides](README.md)
>
> **TL;DR**: You need VS Code with GitHub Copilot, an Azure subscription, and basic familiarity with IaC concepts.
> The Dev Container handles all tool installation automatically.

## Quick Start Checklist

- [ ] GitHub account with Copilot license (Individual, Business, or Enterprise)
- [ ] VS Code with GitHub Copilot and Copilot Chat extensions
- [ ] Azure subscription with Contributor access
- [ ] Docker Desktop (for Dev Container) or manual tool installation

---

## Required Tools

### Option A: Dev Container (Recommended)

The repository includes a pre-configured Dev Container that installs everything automatically.
For detailed setup instructions, Docker alternatives, and troubleshooting,
see the [Dev Containers Setup Guide](dev-containers-setup.md).

```bash
# Clone and open
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
code azure-agentic-infraops

# F1 → "Dev Containers: Reopen in Container"
# Wait 3-5 minutes for setup
```

**What's included:**

| Tool         | Version | Purpose                   |
| ------------ | ------- | ------------------------- |
| Azure CLI    | Latest  | Azure resource management |
| Bicep CLI    | Latest  | Infrastructure as Code    |
| PowerShell 7 | Latest  | Automation scripts        |
| Git          | Latest  | Version control           |
| GitHub CLI   | Latest  | GitHub operations         |
| Checkov      | Latest  | Security scanning         |

> **Note**: Credentials persist across container rebuilds:
>
> - **Azure CLI**: Mounts your host's credential directory (`~/.azure` or `%USERPROFILE%\.azure`)
> - **GitHub CLI**: Uses a Docker volume. Run `gh auth login` once inside the container; credentials persist across rebuilds.

### Option B: Manual Installation

If you can't use Dev Containers, install these tools:

| Tool                | Minimum Version | Installation                                            |
| ------------------- | --------------- | ------------------------------------------------------- |
| VS Code             | Latest          | [code.visualstudio.com](https://code.visualstudio.com/) |
| GitHub Copilot      | Extension       | VS Code Marketplace                                     |
| GitHub Copilot Chat | Extension       | VS Code Marketplace                                     |
| Azure CLI           | 2.50+           | `winget install Microsoft.AzureCLI`                     |
| Bicep CLI           | 0.20+           | Included with Azure CLI                                 |
| PowerShell          | 7.0+            | `winget install Microsoft.PowerShell`                   |
| Git                 | 2.30+           | `winget install Git.Git`                                |
| GitHub CLI          | 2.40+           | `winget install GitHub.cli` (optional, for auth mount)  |

---

## Azure Subscription Requirements

### Minimum Permissions

- **Contributor** role at subscription or resource group level
- Ability to create: VNets, Storage Accounts, Key Vaults, App Services, SQL Databases

### Quota Considerations

Most scenarios use minimal resources, but check these quotas for larger demos:

| Resource         | Typical Usage | How to Check                                      |
| ---------------- | ------------- | ------------------------------------------------- |
| vCPUs            | 4-8 cores     | `az vm list-usage --location swedencentral`       |
| Public IPs       | 2-3           | `az network list-usages --location swedencentral` |
| Storage Accounts | 1-2           | Rarely hits limits                                |

### Recommended Regions

| Region               | Use Case                                 |
| -------------------- | ---------------------------------------- |
| `swedencentral`      | Default - sustainable, good availability |
| `germanywestcentral` | Alternative if quota issues              |
| `eastus` / `westus2` | Americas users for lower latency         |

---

## Knowledge Prerequisites

### Required (You Should Know)

| Concept                 | Why It Matters                          | Quick Refresher                                                                                 |
| ----------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Azure fundamentals**  | Resource groups, subscriptions, regions | [Azure Fundamentals](https://learn.microsoft.com/training/paths/azure-fundamentals/)            |
| **Basic networking**    | VNets, subnets, IP addressing           | [Azure Networking](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview) |
| **Command line basics** | Terminal navigation, running scripts    | -                                                                                               |

### Helpful (But We'll Teach You)

| Concept                          | Where You'll Learn                        |
| -------------------------------- | ----------------------------------------- |
| Bicep syntax                     | S01 - Bicep Baseline scenario             |
| Copilot prompting                | Every scenario includes effective prompts |
| Azure Well-Architected Framework | S02 - Agentic Workflow                    |

### Not Required

- Previous AI/ML experience
- GitHub Copilot expertise (we start from basics)
- Deep Azure architecture knowledge

---

## Verifying Your Setup

Run these commands to verify your environment:

```bash
# Check Azure CLI
az --version

# Check Bicep
bicep --version

# Check PowerShell
pwsh --version

# Verify Azure login
az account show --query "{Name:name, SubscriptionId:id}" -o table
```

**Expected output** (versions may vary):

```
azure-cli                         2.64.0
bicep                             0.30.0
PowerShell 7.4.5

Name                    SubscriptionId
----------------------  ------------------------------------
My Azure Subscription   xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## Troubleshooting

### Dev Container Won't Start

1. Ensure Docker Desktop is running
2. Check available disk space (needs ~5GB)
3. Try "Rebuild Container" from command palette
4. See the [Troubleshooting Guide](../guides/troubleshooting.md) for detailed fixes

### Azure CLI Authentication Issues

```bash
# Clear cached credentials
az logout
az account clear

# Re-authenticate
az login

# Set subscription (if multiple)
az account set --subscription "Your Subscription Name"
```

### Copilot Not Responding

1. Check Copilot icon in VS Code status bar (should be active)
2. Verify license: Help → GitHub Copilot Status
3. Try signing out/in: Accounts → Sign out of GitHub

---

## Next Steps

Once your environment is ready:

1. **Choose a model** → [Model Selection Guide](copilot-model-selection.md)
2. **Learn Copilot** → [Copilot Getting Started](copilot-getting-started.md)
3. **Start a scenario** → [S01 Bicep Baseline](../../scenarios/S01-bicep-baseline/)
