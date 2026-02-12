# Development Container for Agentic InfraOps

> **[Version](../VERSION.md)**

This devcontainer provides a **complete, pre-configured development environment** for Agentic InfraOps.
It includes all required tools, extensions, and configurations to build Azure infrastructure with AI agents.

**Base Image:** `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`

## 🎯 What's Included

### Infrastructure as Code Tools

- **Azure CLI** (latest) with Bicep CLI
- **Bicep** for Azure infrastructure
- **Checkov** - Infrastructure security scanner

### Scripting & Automation

- **PowerShell 7+** (via devcontainer feature) with Az modules (Accounts, Resources, Storage, Network, KeyVault, Websites)
- **Python 3.13** with pip and uv
- **Node.js LTS** with npm
- **Bash** with common utilities

### Development Tools

- **Git** with common utilities
- **GitHub CLI** (gh)
- **graphviz**, **dos2unix**

### MCP Servers (Auto-configured)

- **Azure MCP Server** - RBAC-aware Azure context for agents
- **Azure Pricing MCP** - Real-time SKU pricing for cost estimates

### Python Libraries (Auto-installed)

- **diagrams** - Infrastructure diagrams as code (mingrammer/diagrams)
- **matplotlib**, **pillow** - Image processing
- **checkov** - Infrastructure security scanner

### VS Code Extensions (24 Pre-installed)

- ✅ **GitHub Copilot** + Copilot Chat + Mermaid Diagrams
- ✅ **Azure Tools** (Bicep, Resource Groups, Container Apps, Static Web Apps, CLI)
- ✅ **PowerShell** language support
- ✅ **Markdown** (Mermaid diagrams, GitHub preview, linting, Prettier formatting)
- ✅ **Kubernetes & Container** tools (AKS, Container Tools)
- ✅ **GitHub** (Actions, Pull Requests, Azure Copilot)

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** installed and running
- **VS Code** with **Dev Containers** extension (`ms-vscode-remote.remote-containers`)
- **4GB RAM** minimum allocated to Docker
- **10GB disk space** for container image and tools

### Opening the Devcontainer

**Option 1: Command Palette** (Recommended)

1. Open VS Code in this repository folder
2. Press `F1` or `Ctrl+Shift+P`
3. Type and select: `Dev Containers: Reopen in Container`
4. Wait 3-5 minutes for initial build (subsequent opens are ~30 seconds)

**Option 2: Notification Prompt**

1. Open VS Code in this repository folder
2. Click "Reopen in Container" when prompted

### First-Time Setup (Inside Container)

```bash
# 1. Authenticate with Azure
az login

# 2. Set your default subscription
az account set --subscription "<your-subscription-id>"

# 3. Verify tools are installed (auto-displayed after setup)
az bicep version && pwsh --version

# 4. Explore docs and infrastructure
cd docs/prompt-guide/ && ls -la
cd ../../infra/bicep/ && tree -L 2
```

## 📁 Environment Configuration

### Pre-configured Environment Variables

| Variable                  | Value                           | Purpose                                        |
| ------------------------- | ------------------------------- | ---------------------------------------------- |
| `AZURE_DEFAULTS_LOCATION` | `swedencentral`                 | Default Azure region (matches repo guidelines) |

### Azure Credentials Mount

Your host machine's `~/.azure` credentials are automatically mounted into the container,
so you only need to `az login` once on your host machine.

### PowerShell Modules (Auto-installed)

- Az.Accounts, Az.Resources, Az.Storage
- Az.Network, Az.KeyVault, Az.Websites

## 🧪 Testing the Environment

```bash
# Test Bicep compilation
bicep build infra/bicep/ecommerce/main.bicep

# Test security scanner
checkov --version

# Test PowerShell modules
pwsh -Command "Get-Module -ListAvailable Az.*"
```

## 🔄 Updating Tools

### Update All Tools

```bash
bash .devcontainer/update-tools.sh
```

This updates: Azure CLI, Bicep, PowerShell Az modules, Checkov, diagrams, markdownlint

### Update Specific Tools

```bash
az upgrade                                    # Azure CLI
az bicep upgrade                              # Bicep
pip3 install --upgrade checkov diagrams       # Python packages
sudo npm update -g markdownlint-cli           # markdownlint
```

## 🐛 Troubleshooting

### Quick Fixes

| Issue                 | Solution                                                 |
| --------------------- | -------------------------------------------------------- |
| Container won't start | Check Docker running, increase memory to 4GB+            |
| Tool not found        | Run `bash .devcontainer/post-create.sh`                  |
| Azure auth fails      | Use `az login --use-device-code`                         |
| Rebuild needed        | `F1` → `Dev Containers: Rebuild Container Without Cache` |

📖 **Full troubleshooting guide:** [docs/troubleshooting.md](../docs/troubleshooting.md)

## 📊 Resource Usage

| Metric                 | Value   |
| ---------------------- | ------- |
| **Container Image**    | ~1.5 GB |
| **Memory (idle)**      | ~1 GB   |
| **Memory (active)**    | ~2-3 GB |
| **Disk (with caches)** | ~4-6 GB |

## 🔒 Security Notes

- Azure credentials persist in `~/.azure/` (mounted volume)
- Never commit `.azure/` to Git (already in `.gitignore`)
- Use Azure Key Vault for production secrets
- Use service principals for CI/CD environments

## 📚 Related Documentation

- [Workflow Guide](../docs/workflow.md)
- [Prompt Guide](../docs/prompt-guide/)
- [Copilot Instructions](../.github/copilot-instructions.md)
- [Repository README](../README.md)

---

**Ready?** Press `F1` → `Dev Containers: Reopen in Container` 🚀
