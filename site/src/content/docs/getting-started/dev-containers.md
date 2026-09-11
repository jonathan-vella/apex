---
title: "Dev Containers Setup Guide"
description: "Set up the VS Code Dev Container environment"
---

> Complete guide for the VS Code Dev Container environment

## What Are Dev Containers?

Dev Containers use Docker to create a full-featured development environment inside a container.
When you open this repository in a Dev Container:

- All required tools are pre-installed (Azure CLI, Bicep, PowerShell 7)
- VS Code extensions are automatically configured
- Git credentials are shared from your host machine
- The environment matches what other team members use

## System Requirements

:::caution[Docker Required]
A container runtime (Docker Desktop, Rancher Desktop, Colima, or Podman) must be running
before you open the dev container. See [Alternative Docker Options](#alternative-docker-options)
if Docker Desktop licensing does not suit your organization.
:::

### Docker Options

| Platform               | Recommended                       | Alternatives            |
| ---------------------- | --------------------------------- | ----------------------- |
| **Windows 10/11 Pro**  | Docker Desktop with WSL 2         | Rancher Desktop, Podman |
| **Windows 10/11 Home** | Docker Desktop with WSL 2 (2004+) | —                       |
| **macOS**              | Docker Desktop 2.0+               | Colima, Rancher Desktop |
| **Linux**              | Docker CE/EE 18.06+               | Podman                  |

### Hardware

| Resource | Minimum    | Recommended |
| -------- | ---------- | ----------- |
| RAM      | 8 GB       | 16 GB       |
| CPU      | 2 cores    | 4+ cores    |
| Disk     | 10 GB free | 20 GB free  |

### Software

| Software                 | Version   | Purpose               |
| ------------------------ | --------- | --------------------- |
| VS Code                  | Latest    | IDE                   |
| Dev Containers Extension | Latest    | Container integration |
| Docker                   | See above | Container runtime     |
| Git                      | 2.30+     | Version control       |

## Installation Steps

### Step 1: Install Docker

=== "Windows (WSL 2)"

    ```powershell
    # Install WSL 2 (if not already installed)
    wsl --install

    # Then download and install Docker Desktop
    # https://www.docker.com/products/docker-desktop

    # Enable WSL 2 backend in Docker Desktop settings
    ```

=== "macOS"

    1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
    2. Start Docker Desktop from Applications
    3. Wait for "Docker Desktop is running"

=== "Linux"

    ```bash
    # Ubuntu/Debian
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    # Log out and back in for group changes

    # Verify
    docker --version
    ```

### Step 2: Install VS Code Extension

```bash
code --install-extension ms-vscode-remote.remote-containers
```

Or install from Extensions (`Ctrl+Shift+X`) → search "Dev Containers".

### Step 3: Open in Dev Container

```bash
git clone https://github.com/YOUR-USERNAME/my-infraops-project.git
cd my-infraops-project
code .
```

:::note[Use the template repository]
Do not clone this upstream project directly. Create your own repo from the
[Accelerator template](https://github.com/jonathan-vella/apex-accelerator)
first. See the [Quickstart](../quickstart/) for the full setup flow.
:::

Press `F1` → **Dev Containers: Reopen in Container**

First build takes 2-5 minutes. Subsequent opens are instant.

### Step 4: GitHub Authentication

Git normally uses host credentials forwarded by VS Code Dev Containers through a credential helper
or SSH agent. The `gh` CLI authenticates separately: use an explicitly authenticated configuration
in the persistent `~/.config/gh` Docker volume, or an optional host-process `GH_TOKEN`.
If needed, the user chooses and performs authentication, for example with `gh auth login`.
Setup and agents do not automatically log in, switch credentials, or change persistent Git settings.

**Optional token forwarding:** `${localEnv:GH_TOKEN}` reads the environment inherited by the host
VS Code process when it launches. Supply the token securely in that host environment before launching
VS Code. Fully exit and relaunch an existing VS Code process, then reopen the container, when changing
or rotating that value. An environment token takes precedence over stored `gh` credentials.

:::caution[Terminal-only settings]
`terminal.integrated.env.*` affects integrated terminals only. It does not populate `${localEnv:GH_TOKEN}`
or supply credentials to all lifecycle hooks, MCP processes, and the extension host.
Exporting a token inside the container does not change the host VS Code environment.
:::

A fine-grained PAT is optional, not mandatory. Limit repository access, permissions, and lifetime to
the intended operations, subject to organization approval and policy. Never put secrets in repository
files, paste tokens into chat, or ask an agent to receive or display them.

**If Git denies access to an unexpected account**, compare the account named in the denial with:

```bash
gh api user --jq .login
```

Check the target repository and branch. Only after the user confirms the `gh` identity and explicitly
authorizes using it for the push, use a per-command helper for the approved feature branch:

```bash
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <approved-feature-branch>
```

Replace the branch placeholder before running. The empty helper clears inherited helpers for this invocation;
single quotes protect `!` from Bash history expansion. No persistent Git configuration is changed.
This does not authorize a force push or a push to `main`. If identities match, investigate permissions
or branch protection instead of switching credentials.

### Step 5: Verify Setup

```bash
az --version && bicep --version && pwsh --version
```

:::note[Azure CLI extension prompts are pre-configured away]
The devcontainer sets Azure CLI config during `post-create.sh` so extension-backed commands can
install stable extensions automatically without prompting:

```bash
az config set extension.use_dynamic_install=yes_without_prompt
az config set extension.dynamic_install_allow_preview=false
```

This avoids the common warning about dynamic extension installation. Preview extensions remain
manual unless you explicitly change that setting.
:::

## Alternative Docker Options

:::tip[Choose your Docker runtime before installing]
If Docker Desktop licensing is a concern, consider one of these free alternatives.
Choose your runtime **before** opening the dev container for the first time.
:::

### Rancher Desktop (Free Docker Desktop Alternative)

1. Download from [rancherdesktop.io](https://rancherdesktop.io/)
2. Choose "dockerd (moby)" as runtime
3. Works with VS Code Dev Containers extension

### Colima (macOS Only)

```bash
brew install colima docker
colima start
```

### Podman (Linux/macOS)

```bash
# macOS
brew install podman
podman machine init
podman machine start

# Linux
sudo apt install podman
```

Configure VS Code: `"dev.containers.dockerPath": "podman"`

## What's Included

The Dev Container includes:

| Category               | Tools                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| **Azure**              | Azure CLI, Bicep CLI, Azure Resource Manager MCP                         |
| **Terraform**          | Terraform CLI and Registry API access                                    |
| **PowerShell**         | PowerShell 7+, Az modules                                                |
| **Python**             | Python 3.14, diagrams library, graphviz                                  |
| **Node.js**            | Node LTS+, npm, markdownlint                                             |
| **APEX Tools**         | `apex-recall` CLI (progressive session recall)                           |
| **VS Code Extensions** | Curated language, IaC, Copilot, and GitHub extensions                    |

Dependencies install during container creation from lockfiles and pinned
manifests. `post-start.sh` only restores hook permissions and reports azd
authentication status.

## Troubleshooting

### Container Won't Start

```bash
# Check Docker is running
docker ps

# Rebuild without cache
# F1 → Dev Containers: Rebuild Container Without Cache
```

### Port Conflicts

Stop other containers using the same ports:

```bash
docker ps
docker stop <container-id>
```

### Slow Performance (Windows/macOS)

- Increase Docker Desktop memory allocation (Settings → Resources)
- Use WSL 2 backend on Windows (faster than Hyper-V)
- Close unnecessary applications

### Extensions Not Loading

```bash
# Force extension reinstall
# F1 → Developer: Reload Window
```

## References

- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Rancher Desktop](https://rancherdesktop.io/)
