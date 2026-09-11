# Development Container for APEX

> **[Version](../VERSION.md)**

This devcontainer provides a **complete, pre-configured development environment** for APEX.
It includes all required tools, extensions, and configurations to build Azure infrastructure
with AI agents.

**Base image:** `mcr.microsoft.com/devcontainers/base:ubuntu26.04` (`amd64` and `arm64`)

## What's Included

### Devcontainer Features (installed via `devcontainer.json`)

| Feature                   | Version | Purpose                           |
| ------------------------- | ------- | --------------------------------- |
| Azure CLI                 | latest  | Azure management with Bicep CLI   |
| PowerShell                | latest  | Scripting and Az module host      |
| Python                    | 3.14    | Diagrams and tooling              |
| Node.js                   | LTS     | Validation scripts, npm tooling   |
| GitHub CLI                | latest  | Repository operations             |
| Terraform                 | latest  | Signed HashiCorp APT repository    |
| Azure Developer CLI (azd) | latest  | Standardized Azure deployments    |

### Tools Installed by `post-create.sh`

| Step | Setup                          | Method                                                        |
| ---- | ------------------------------ | ------------------------------------------------------------- |
| 1    | Mounted directories            | Ensure uv, gh config, and Terraform cache directories are writable |
| 2    | npm and workspace dependencies | Ensure npm 12.0.2, then `npm ci` from `package-lock.json`       |
| 3    | Python and apex-recall         | One `uv pip install` for requirements and editable recall; import and CLI verification |
| 4    | PowerShell Az modules          | Synchronous `Install-Module`, then verify each required module exists |
| 5    | Build tools and Terraform      | Check gitleaks, uv, and Terraform versions                     |
| 6    | Azure CLI and Bicep            | Stable extension auto-install, disable CLI auto-upgrade, check Bicep with fallback install |
| 7    | MCP defaults and tool versions | Add missing defaults via JSONC edits; run tool-version validation |

Required setup errors stop the script with a nonzero exit. PowerShell installs Accounts, Resources,
Storage, Network, KeyVault, and Websites modules without bypassing publisher checks; missing modules
or installation errors fail setup. Setup does not change global Git settings or credentials.

### Build-Time Tools (installed via `Dockerfile`)

Stable APT dependencies (`ca-certificates`, `curl`, `jq`, `tar`, `gzip`, `graphviz`, `dos2unix`, and `bats`)
are installed in the image layer. uv 0.8.22 and gitleaks 8.28.0 are pinned and SHA-256 verified for
`amd64` and `arm64` using [the download manifest](download-checksums.json).
The existing tool updater does not update these pins; maintain their versions and checksums explicitly.

### MCP Servers (auto-configured in `.vscode/mcp.json`)

| Server            | Transport         | Purpose                                          |
| ----------------- | ----------------- | ------------------------------------------------ |
| Azure Resource Manager MCP | http      | Retail pricing and Azure cost management         |
| GitHub MCP        | http              | Copilot-provided GitHub context                  |
| Azure MCP Server  | stdio (`npx`)      | RBAC-aware Azure context for agents              |

Setup adds only missing default server entries. It preserves JSONC comments, custom arguments,
existing defaults, and custom or retired server entries. Malformed configuration fails setup and
is left untouched; setup does not perform automatic server migrations.

### VS Code Extensions

- **GitHub Copilot** — Copilot Chat
- **Python** — IntelliSense (Pylance), linting, debugging
- **Azure** — Bicep and Resource Groups explorer; Azure CLI and azd remain container tools
- **PowerShell** — language support
- **Markdown** — Native VS Code editing with Prettier formatting
- **GitHub** — Actions, Pull Requests
- **Terraform** — HashiCorp Terraform
- **Other** — YAML

#### Lean Extension Policy

Azure MCP runs directly from [the workspace MCP configuration](../.vscode/mcp.json), not an editor extension.
Keep GitHub Copilot Chat; GitHub Copilot for Azure is a separate, unwanted extension for this workflow.
The Azure Tools pack and Azure MCP Server extension bundle Azure Copilot. AI Toolkit adds another agent/skill
surface and depends on that MCP extension. Avoid those packages for the lean APEX setup.

Service-specific Azure explorers, Azure testing, and CLI/azd editor extensions are optional interfaces,
not prerequisites for the installed command-line tools. Removing them does not remove Azure CLI, azd,
Terraform, PowerShell, or the configured MCP servers. Keep the .NET runtime required by Bicep and the
Python debugger/environment tooling when using Python development features.

Workspace `unwantedRecommendations` discourage installation; they do not uninstall existing extensions
or override personal Settings Sync. After removal, reload the VS Code window and check host/profile extension
settings if packages return. The extension validator guards repository declarations, not personal installations.

#### Further Setup Optimization

| Area | Implemented State / Remaining Work |
| ---- | ---------------------------------- |
| Required dependencies | Fail-fast npm, Python, and synchronous PowerShell setup |
| Python installation | Shared requirements and editable recall install, followed by verification |
| MCP configuration | Missing-default-only JSONC edits; existing entries preserved; malformed input fails untouched |
| Image layers | Stable APT dependencies and checksum-verified uv/gitleaks installed at build time |
| Cache persistence | Terraform provider volume added; uv volume retained |
| Additional caches | No new npm or PowerShell module volumes: measured value and portability remain unproven |
| Git authentication | Existing credentials preserved; optional token forwarding uses the VS Code host process |
| Validation and timing | Actual image build and cold/warm timing remain unverified; Docker/devcontainer executables unavailable in the validation environment |

Startup is already lightweight: `post-start.sh` does no installs or upgrades. Retain that boundary.
No extension-removal token savings or rebuild-time improvement is claimed without measurements.

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
4. Wait for the image build and post-create setup to finish; cold-build time depends on downloads and host resources

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

## GitHub Authentication

Git normally uses credentials forwarded by VS Code Dev Containers from the host credential helper
or SSH agent. Git and the `gh` CLI can use different identities; successful Git access does not
establish a `gh` login.

For `gh`, use an explicitly authenticated configuration in the persistent `~/.config/gh` Docker
volume, or an optional host-process `GH_TOKEN`. If authentication is needed, the user chooses and
performs it, for example with `gh auth login`. Setup and agents must not run login automatically,
switch credentials, or persist Git credential-helper changes.

### Optional Host-Process Token

`remoteEnv.GH_TOKEN` uses `${localEnv:GH_TOKEN}`: the environment inherited by the **host VS Code process**
when it launches. Supply a token securely in that host environment before launching VS Code; an already
running VS Code process may need a full exit and relaunch before reopening the container.
After rotation, refresh that host environment and relaunch VS Code so the container receives the new value.

`terminal.integrated.env.*` applies only to integrated terminals. It does not populate `${localEnv:GH_TOKEN}`
and does not make a token available to all lifecycle hooks, MCP processes, or the extension host.
An export inside the container likewise does not change the host VS Code environment.

A fine-grained PAT is optional, not the only supported authentication method. Limit its repository access,
permissions, and lifetime to the intended operations; organization policies or approval may also apply.
An environment token takes precedence over stored `gh` credentials. Never put secrets in repository files,
paste them into chat, or ask an agent to receive or display them.

### Identity Mismatch on Git Push

When Git reports permission denied to an unexpected account, compare that identity with the CLI identity:

```bash
gh api user --jq .login
```

Check the target repository and branch as well. Do not automatically switch accounts or change persistent
Git configuration. If the user confirms the `gh` identity is the intended account and explicitly authorizes
using it for this push, use a per-command helper for the approved feature branch:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <approved-feature-branch>
```

Replace the branch placeholder before running. The empty helper clears inherited helpers for this invocation;
single quotes protect `!` from Bash history expansion. This does not change saved Git settings or authorize
a force push or a push to `main`. If the identities already match, investigate repository permissions or branch
protection instead of changing credentials.

## Environment Configuration

### Environment Variables

| Variable                  | Value                         | Purpose                                                  |
| ------------------------- | ----------------------------- | -------------------------------------------------------- |
| `AZURE_DEFAULTS_LOCATION` | `swedencentral`               | Default Azure region (EU GDPR-compliant)                 |
| `GH_TOKEN`                | `${localEnv:GH_TOKEN}`        | Optional token inherited by the host VS Code process     |
| `PYTHONDONTWRITEBYTECODE` | `1`                           | Skip `.pyc` generation                                   |
| `PYTHONUNBUFFERED`        | `1`                           | Unbuffered Python output                                 |
| `UV_CACHE_DIR`            | `~/.cache/uv`                 | uv package cache                                         |
| `TF_PLUGIN_CACHE_DIR`     | `~/.terraform.d/plugin-cache` | Terraform provider cache                                 |

### Azure CLI Extension Auto-Install

`post-create.sh` configures Azure CLI so extension-backed commands do not pause for prompts:

```bash
az config set extension.use_dynamic_install=yes_without_prompt
az config set extension.dynamic_install_allow_preview=false
```

Preview extensions remain opt-in. To auto-install preview extensions too, change
`extension.dynamic_install_allow_preview` to `true` in `~/.azure/config`.

## Lifecycle Scripts

### `onCreateCommand` — Azure CLI Smoke Check

Runs `az version --output none` once when the container is created and fails if Azure CLI is unusable.
System packages, uv, and gitleaks are already installed in the image.

### `postCreateCommand` — `post-create.sh`

Runs once after container creation. Installs workspace dependencies and PowerShell modules, adds missing
MCP defaults, and verifies tools. Required failures stop setup. Output goes to stdout/stderr in the
Dev Containers creation log (or the terminal for a manual run); no separate installation log file is written.

### `postStartCommand` — `post-start.sh`

Runs on every container start without installing or upgrading dependencies:

| Check | Method |
| --- | --- |
| Hook permissions | Restore executable bits on mounted shell hooks |
| azd authentication | Read-only status check |

### When to Rebuild vs. Restart

| Situation                       | Action                                       |
| ------------------------------- | -------------------------------------------- |
| Workspace dependency setup failed | Resolve the reported error, then run `bash .devcontainer/post-create.sh` |
| Build-time tool missing or broken | Rebuild the container; post-create verifies but does not reinstall uv/gitleaks |
| New devcontainer feature needed | `F1` → Rebuild Container                     |
| OS-level or base image update   | `F1` → Rebuild Container Without Cache       |
| Dependency or tool update       | Update the relevant pins or lockfile, then rebuild the container |

## Troubleshooting

| Issue                      | Solution                                                 |
| -------------------------- | -------------------------------------------------------- |
| Container won't start      | Check Docker is running; increase memory to 4 GB+        |
| Workspace dependency missing | Resolve setup errors and rerun `bash .devcontainer/post-create.sh` |
| uv or gitleaks missing     | Rebuild the image; check the build log and download manifest |
| Azure auth fails           | Use `az login --use-device-code`                         |
| `gh` CLI not authenticated | Explicitly authenticate `gh`, or supply optional host-process `GH_TOKEN` |
| Git and `gh` identities differ | Follow [Identity Mismatch on Git Push](#identity-mismatch-on-git-push) |
| Stale tool versions        | Review pins and locks before rebuilding; uv/gitleaks are not updated by the tool updater |
| Full rebuild needed        | `F1` → `Dev Containers: Rebuild Container Without Cache` |

Full troubleshooting guide: [Troubleshooting](https://apexops.pro/guides/troubleshooting/)

## Resource Usage

| Metric             | Value   |
| ------------------ | ------- |
| Container image    | ~1.5 GB |
| Memory (idle)      | ~1 GB   |
| Memory (active)    | ~2-3 GB |
| Disk (with caches) | ~4-6 GB |

## Security Notes

- Azure credentials persist in the host `~/.azure/` bind mount; never commit credentials to Git
- Explicit `gh` authentication persists in its config volume; optional `GH_TOKEN` comes from the host process
- Never store tokens in repository files or send secrets through chat or model-visible tool input
- gitleaks runs as a pre-commit hook for secret scanning (soft-skips if not installed)
- Use Azure Key Vault for production secrets
- Use service principals for CI/CD environments

## Related Documentation

- [Workflow Guide](https://apexops.pro/concepts/workflow/)
- [Prompt Guide](https://apexops.pro/guides/prompt-guide/)
- [Troubleshooting](https://apexops.pro/guides/troubleshooting/)
- [Copilot Instructions](../.github/copilot-instructions.md)
- [Repository README](../README.md)
