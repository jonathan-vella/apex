# Development Container for APEX

> **[Version](../VERSION.md)**

This devcontainer provides a **complete, pre-configured development environment** for APEX.
It includes all required tools, extensions, and configurations to build Azure infrastructure with AI agents.

**Base Image:** `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`

## 🎯 What's Included

### Infrastructure as Code Tools

- **Azure CLI** (latest) with Bicep CLI
- **Bicep** for Azure infrastructure
- **Terraform** (latest) with **TFLint** (pinned to v0.61.0)
- **Checkov** - Infrastructure security scanner (replaces tfsec, which is archived and has no ARM64 support)
- **Go** (latest) — used to install the Terraform MCP Server binary

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
- **Terraform MCP Server** - HashiCorp registry, module, and workspace tools (go binary, auto-updated on start)

### Python Libraries (Auto-installed)

- **diagrams** - Infrastructure diagrams as code (mingrammer/diagrams)
- **matplotlib**, **pillow** - Image processing
- **checkov** - Infrastructure security scanner

### VS Code Extensions (Pre-installed)

- ✅ **GitHub Copilot** + Copilot Chat + Mermaid Diagrams
- ✅ **Python** (IntelliSense via Pylance, linting, debugging)
- ✅ **Azure Tools** (Bicep, Resource Groups, Container Apps, Static Web Apps, CLI)
- ✅ **PowerShell** language support
- ✅ **Markdown** (Mermaid diagrams, GitHub preview, linting, Prettier formatting)
- ✅ **Kubernetes & Container** tools (AKS, Container Tools)
- ✅ **GitHub** (Actions, Pull Requests, Azure Copilot)
- ✅ **Terraform** (HashiCorp + Azure Terraform)

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

### GitHub CLI Authentication (GH_TOKEN)

HTTPS-based `gh auth login` can fail inside devcontainers on some platforms (Windows, ARM, WSL 2).
The **only supported** approach is a **Personal Access Token (PAT)** set in **VS Code User Settings**.
The container reads it automatically — no `gh auth login` required inside the container.

> **Why not shell exports?** Setting `GH_TOKEN` in `~/.bashrc`, `~/.profile`, or PowerShell
> environment variables does **not** propagate reliably into devcontainers. VS Code reads
> `${localEnv:GH_TOKEN}` from its own process environment, which only inherits from the
> specific shell session that launched it. The VS Code settings method is deterministic and
> survives rebuilds, reboots, and IDE restarts.

#### Step 1: Create a Fine-Grained PAT

> **Yes, fine-grained PATs work here.** The `gh` CLI fully supports fine-grained tokens
> (`github_pat_...`) via the `GH_TOKEN` environment variable for all repository-scoped operations.

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click **Generate new token**
3. Set expiry (90 days recommended; rotate via calendar reminder)
4. **Repository access**: All repositories, or select specific ones
5. **Permissions** — minimum required:

   | Permission    | Level      |
   | ------------- | ---------- |
   | Contents      | Read/Write |
   | Metadata      | Read       |
   | Pull requests | Read/Write |
   | Issues        | Read/Write |
   | Workflows     | Read/Write |

6. Copy the token (`github_pat_...`)

#### Step 2: Add to VS Code User Settings (once per machine)

1. Open VS Code Settings: **Ctrl+,** (or **Cmd+,** on macOS)
2. Click the **Open Settings (JSON)** icon (top-right)
3. Add this entry (replace the placeholder with your actual token):

```jsonc
"terminal.integrated.env.linux": { "GH_TOKEN": "github_pat_your_token_here" }
```

<!-- markdownlint-disable MD029 -->

4. Save the file
5. Rebuild the devcontainer: **F1 → Dev Containers: Rebuild Container**
<!-- markdownlint-enable MD029 -->

The devcontainer forwards `GH_TOKEN` from VS Code's environment automatically
(`"GH_TOKEN": "${localEnv:GH_TOKEN}"` in `devcontainer.json`).

#### Step 3: Verify inside the container

```bash
gh auth status
# Expected: ✓ Logged in to github.com as <your-username> (token)
```

> **Token rotation**: When your PAT expires, update the value in VS Code User Settings and
> rebuild the container (`F1 → Dev Containers: Rebuild Container`).

### First-Time Setup (Inside Container)

```bash
# 1. Authenticate with Azure
az login

# 2. Set your default subscription
az account set --subscription "<your-subscription-id>"

# 3. Verify tools are installed (auto-displayed after setup)
az bicep version && pwsh --version

# 4. Explore docs and infrastructure
cd site/src/content/docs/ && ls -la
cd ../../infra/bicep/ && tree -L 2
```

## 📁 Environment Configuration

### Pre-configured Environment Variables

| Variable                  | Value                  | Purpose                                                                             |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `AZURE_DEFAULTS_LOCATION` | `swedencentral`        | Default Azure region (matches repo guidelines)                                      |
| `GH_TOKEN`                | `${localEnv:GH_TOKEN}` | GitHub PAT set in VS Code User Settings; enables `gh` CLI without interactive login |

### Azure CLI Extension Auto-Install

The devcontainer configures Azure CLI during `post-create.sh` so extension-backed commands do not
pause for interactive install prompts:

```bash
az config set extension.use_dynamic_install=yes_without_prompt
az config set extension.dynamic_install_allow_preview=false
```

This removes warnings such as `Run 'az config set extension.use_dynamic_install=yes_without_prompt'`
when Azure CLI needs an extension. Preview extensions remain opt-in; if you explicitly want Azure
CLI to auto-install preview extensions too, change `extension.dynamic_install_allow_preview` to
`true` in your own `~/.azure/config`.

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

### Automatic Updates (on every container start)

`post-start.sh` runs automatically via `postStartCommand` and updates:

| Tool                          | Method                         |
| ----------------------------- | ------------------------------ |
| `terraform-mcp-server`        | `go install ...@latest`        |
| Azure Pricing MCP             | `pip install -e .` in its venv |
| npm local deps                | `npm install`                  |
| `markdownlint-cli2`           | `npm install -g`               |
| `checkov`, `ruff`, `diagrams` | `uv pip install --upgrade`     |

### Manual Updates (require rebuild or manual run)

```bash
az upgrade                                         # Azure CLI
az bicep upgrade                                   # Bicep
pwsh -Command 'Update-Module Az.* -Force'          # PowerShell Az modules
bash .devcontainer/post-start.sh                   # Re-run all lightweight updates now
```

### Full Rebuild (for feature/OS-level updates)

`F1` → **Dev Containers: Rebuild Container** — re-runs `post-create.sh` which
installs all tools from scratch including the Go and Terraform features.

## 🐛 Troubleshooting

### Quick Fixes

| Issue                 | Solution                                                 |
| --------------------- | -------------------------------------------------------- |
| Container won't start | Check Docker running, increase memory to 4GB+            |
| Tool not found        | Run `bash .devcontainer/post-create.sh`                  |
| Azure auth fails      | Use `az login --use-device-code`                         |
| Rebuild needed        | `F1` → `Dev Containers: Rebuild Container Without Cache` |

📖 **Full troubleshooting guide:** [Troubleshooting](https://jonathan-vella.github.io/azure-agentic-infraops/guides/troubleshooting/)

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

- [Workflow Guide](https://jonathan-vella.github.io/azure-agentic-infraops/concepts/workflow/)
- [Prompt Guide](https://jonathan-vella.github.io/azure-agentic-infraops/guides/prompt-guide/)
- [Copilot Instructions](../.github/copilot-instructions.md)
- [Repository README](../README.md)

---

**Ready?** Press `F1` → `Dev Containers: Reopen in Container` 🚀
