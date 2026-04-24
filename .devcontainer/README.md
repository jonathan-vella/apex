# Development Container for APEX

> **[Version](../VERSION.md)**

This devcontainer provides a **complete, pre-configured development environment** for APEX.
It includes all required tools, extensions, and configurations to build Azure infrastructure
with AI agents.

**Base image:** `mcr.microsoft.com/devcontainers/base:ubuntu-24.04`

## What's Included

### Devcontainer Features (installed via `devcontainer.json`)

| Feature | Version | Purpose |
| --- | --- | --- |
| Azure CLI | latest | Azure management with Bicep CLI |
| PowerShell | latest | Scripting and Az module host |
| Python | 3.13 | Diagrams, MCP servers, tooling |
| Node.js | LTS | Validation scripts, npm tooling |
| GitHub CLI | latest | Repository operations |
| Terraform | latest | IaC with TFLint v0.61.0 |
| Go | 1.24.2 | Build Terraform MCP Server binary |
| Deno | latest | Draw.io MCP server runtime |
| Azure Developer CLI (azd) | latest | Standardized Azure deployments |

### Tools Installed by `post-create.sh` (14 steps)

| Step | Tool | Method |
| --- | --- | --- |
| 1 | npm local dependencies | `npm install` |
| 2 | markdownlint-cli2 | `npm install -g` |
| 3 | k6 load testing | deb repo (amd64) or GitHub release (arm64) |
| 4 | Deno upgrade | `deno upgrade` (ensures latest beyond cached feature layer) |
| 5 | Git config and cache dirs | `git config`, `mkdir` |
| 6 | Python packages | `uv pip install` — diagrams, matplotlib, pillow, checkov, ruff |
| 7 | PowerShell Az modules | `Install-Module` — Accounts, Resources, Storage, Network, KeyVault, Websites |
| 8 | Azure Pricing MCP Server | `pip install -e .` in isolated venv |
| 9 | Terraform MCP Server | `git clone` + `go build` to `/go/bin/` |
| 10 | Python dependency verification | Validates imports against `requirements.txt` |
| 11 | apex-recall CLI | `uv pip install -e` from `tools/apex-recall/` |
| 12 | gitleaks | Binary from GitHub releases (pre-commit soft-skips if missing) |
| 13 | Azure CLI config | Auto-install stable extensions without prompt |
| 14 | MCP config and verification | Ensures `.vscode/mcp.json`, prints tool versions |

### System Packages (installed via `onCreateCommand`)

graphviz, dos2unix, bats, uv

### MCP Servers (auto-configured in `.vscode/mcp.json`)

| Server | Transport | Purpose |
| --- | --- | --- |
| Azure Pricing MCP | stdio | Real-time SKU pricing for cost estimates |
| GitHub MCP | http | Copilot-provided GitHub context |
| Draw.io MCP | stdio (Deno) | Architecture diagram generation with Azure icons |
| Terraform MCP | stdio (Go) | HashiCorp registry, module, and workspace tools |
| Azure MCP Server | VS Code extension | RBAC-aware Azure context for agents |

### VS Code Extensions

- **GitHub Copilot** — Copilot Chat
- **Python** — IntelliSense (Pylance), linting, debugging
- **Azure** — Bicep, Resource Groups, Container Apps, Static Web Apps, CLI, azd, Azure MCP Server
- **PowerShell** — language support
- **Markdown** — Mermaid diagrams, GitHub preview, linting, Prettier formatting
- **Kubernetes** — AKS tools, Container Tools
- **GitHub** — Actions, Pull Requests
- **Terraform** — HashiCorp + Azure Terraform
- **Other** — Draw.io, Rainbow CSV, YAML, Resource Monitor, Deno

## Quick Start

### Prerequisites

- **Docker Desktop** installed and running
- **VS Code** with **Dev Containers** extension (`ms-vscode-remote.remote-containers`)
- **4 GB RAM** minimum allocated to Docker
- **10 GB disk space** for container image and tools

### Opening the Devcontainer

**Option 1: Command Palette** (recommended)

1. Open VS Code in this repository folder
2. Press `F1` or `Ctrl+Shift+P`
3. Type and select: `Dev Containers: Reopen in Container`
4. Wait 3-5 minutes for initial build (subsequent opens are faster)

**Option 2: Notification Prompt**

1. Open VS Code in this repository folder
2. Click "Reopen in Container" when prompted

### First-Time Setup (inside container)

```bash
# 1. Authenticate with Azure
az login

# 2. Set your default subscription
az account set --subscription "<your-subscription-id>"

# 3. Start working
# Open Chat (Ctrl+Shift+I) → Select Orchestrator → Describe your project
```

## GitHub CLI Authentication (GH_TOKEN)

HTTPS-based `gh auth login` can fail inside devcontainers on some platforms (Windows, ARM, WSL 2).
The **only supported** approach is a **Personal Access Token (PAT)** set in **VS Code User Settings**.
The container reads it automatically — no `gh auth login` required inside the container.

> **Why not shell exports?** Setting `GH_TOKEN` in `~/.bashrc`, `~/.profile`, or PowerShell
> environment variables does **not** propagate reliably into devcontainers. VS Code reads
> `${localEnv:GH_TOKEN}` from its own process environment, which only inherits from the
> specific shell session that launched it. The VS Code settings method is deterministic and
> survives rebuilds, reboots, and IDE restarts.

### Step 1: Create a Fine-Grained PAT

Fine-grained PATs work here. The `gh` CLI fully supports fine-grained tokens (`github_pat_...`)
via the `GH_TOKEN` environment variable for all repository-scoped operations.

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

### Step 2: Add to VS Code User Settings (once per machine)

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

### Step 3: Verify inside the container

```bash
gh auth status
# Expected: ✓ Logged in to github.com as <your-username> (token)
```

> **Token rotation**: When your PAT expires, update the value in VS Code User Settings and
> rebuild the container (`F1 → Dev Containers: Rebuild Container`).

## Environment Configuration

### Environment Variables

| Variable                    | Value                   | Purpose |
| --------------------------- | ----------------------- | --- |
| `AZURE_DEFAULTS_LOCATION`   | `swedencentral`         | Default Azure region (EU GDPR-compliant) |
| `GH_TOKEN`                  | `${localEnv:GH_TOKEN}`  | GitHub PAT forwarded from host via VS Code User Settings |
| `PYTHONDONTWRITEBYTECODE`    | `1`                     | Skip `.pyc` generation |
| `PYTHONUNBUFFERED`           | `1`                     | Unbuffered Python output |
| `UV_CACHE_DIR`               | `~/.cache/uv`           | uv package cache |
| `TF_PLUGIN_CACHE_DIR`        | `~/.terraform.d/plugin-cache` | Terraform provider cache |
| `DENO_DIR`                   | `~/.cache/deno`         | Deno module cache |

### Azure CLI Extension Auto-Install

`post-create.sh` configures Azure CLI so extension-backed commands do not pause for prompts:

```bash
az config set extension.use_dynamic_install=yes_without_prompt
az config set extension.dynamic_install_allow_preview=false
```

Preview extensions remain opt-in. To auto-install preview extensions too, change
`extension.dynamic_install_allow_preview` to `true` in `~/.azure/config`.

## Lifecycle Scripts

### `onCreateCommand` — system packages

Runs once when the container is created. Installs `graphviz`, `dos2unix`, `bats`, and `uv`.

### `postCreateCommand` — `post-create.sh`

Runs once after container creation. Performs the 14-step setup (npm, Python, PowerShell modules,
MCP servers, gitleaks, Git config, and tool verification). Output is logged to
`~/.devcontainer-install.log`.

### `postStartCommand` — `post-start.sh`

Runs on every container start. Lightweight updates only:

| Tool | Method |
| --- | --- |
| terraform-mcp-server | Clone + build (if missing) |
| Azure Pricing MCP | `pip install -e .` in its venv |
| npm local deps | `npm install` |
| Python packages | `uv pip install --upgrade` (checkov, ruff, diagrams, matplotlib, pillow) |
| apex-recall | `uv pip install --upgrade -e` |
| azd auth | Status check (warns if not authenticated) |
| lefthook | `npx lefthook install` (Git hooks) |

### When to Rebuild vs. Restart

| Situation | Action |
| --- | --- |
| Tool not found or broken | `bash .devcontainer/post-create.sh` |
| New devcontainer feature needed | `F1` → Rebuild Container |
| OS-level or base image update | `F1` → Rebuild Container Without Cache |
| Routine tool updates | Automatic on every start via `post-start.sh` |

## Troubleshooting

| Issue | Solution |
| --- | --- |
| Container won't start | Check Docker is running; increase memory to 4 GB+ |
| Tool not found | Run `bash .devcontainer/post-create.sh` |
| Azure auth fails | Use `az login --use-device-code` |
| `gh` CLI not authenticated | Set `GH_TOKEN` in VS Code User Settings (see above) |
| Stale tool versions | Restart container (triggers `post-start.sh`) |
| Full rebuild needed | `F1` → `Dev Containers: Rebuild Container Without Cache` |

Full troubleshooting guide: [Troubleshooting](https://jonathan-vella.github.io/azure-agentic-infraops/guides/troubleshooting/)

## Resource Usage

| Metric | Value |
| --- | --- |
| Container image | ~1.5 GB |
| Memory (idle) | ~1 GB |
| Memory (active) | ~2-3 GB |
| Disk (with caches) | ~4-6 GB |

## Security Notes

- Azure credentials persist in `~/.azure/` (mounted volume) — never commit to Git (already in `.gitignore`)
- `GH_TOKEN` is injected via VS Code User Settings, not stored in any repo file
- gitleaks runs as a pre-commit hook for secret scanning (soft-skips if not installed)
- Use Azure Key Vault for production secrets
- Use service principals for CI/CD environments

## Related Documentation

- [Workflow Guide](https://jonathan-vella.github.io/azure-agentic-infraops/concepts/workflow/)
- [Prompt Guide](https://jonathan-vella.github.io/azure-agentic-infraops/guides/prompt-guide/)
- [Troubleshooting](https://jonathan-vella.github.io/azure-agentic-infraops/guides/troubleshooting/)
- [Copilot Instructions](../.github/copilot-instructions.md)
- [Repository README](../README.md)
