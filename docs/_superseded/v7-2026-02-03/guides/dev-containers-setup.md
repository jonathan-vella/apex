# Dev Containers Setup Guide

> **Version 5.3.0** | [Back to Guides](README.md)
>
> Complete guide to setting up VS Code Dev Containers for Agentic InfraOps.
>
> Dev Containers provide a consistent, pre-configured development environment
> that works identically across Windows, macOS, and Linux.

---

## What Are Dev Containers?

Dev Containers use Docker to create a full-featured development environment inside a container.
When you open this repository in a Dev Container:

- All required tools are pre-installed (Azure CLI, Bicep, PowerShell 7)
- VS Code extensions are automatically configured
- Git credentials are shared from your host machine
- The environment matches what other team members use

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│  Your Local Machine                                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  VS Code                                               │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Dev Containers Extension                       │  │  │
│  │  └────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────────┐  │
│  │  Docker Container (Ubuntu 24.04)                      │  │
│  │  ├── Azure CLI + Bicep                                │  │
│  │  ├── PowerShell 7+                                    │  │
│  │  ├── Python 3.12 + diagrams                           │  │
│  │  ├── Node.js + markdownlint                           │  │
│  │  └── Your workspace files (mounted)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## System Requirements

### Docker Installation Options

You need Docker running on your machine. Choose one of these options:

| Platform                         | Recommended Option                                                                                   | Alternative Options             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Windows 10/11 Pro/Enterprise** | [Docker Desktop](https://www.docker.com/products/docker-desktop) with WSL 2 backend                  | Rancher Desktop, Podman         |
| **Windows 10/11 Home**           | [Docker Desktop](https://www.docker.com/products/docker-desktop) with WSL 2 backend (requires 2004+) | -                               |
| **macOS**                        | [Docker Desktop](https://www.docker.com/products/docker-desktop) 2.0+                                | Colima, Rancher Desktop, Podman |
| **Linux**                        | [Docker CE/EE](https://docs.docker.com/install/#supported-platforms) 18.06+                          | Podman                          |

### Minimum Hardware

| Resource | Minimum    | Recommended |
| -------- | ---------- | ----------- |
| RAM      | 8 GB       | 16 GB       |
| CPU      | 2 cores    | 4+ cores    |
| Disk     | 10 GB free | 20 GB free  |

### Software Requirements

| Software                 | Version         | Purpose               |
| ------------------------ | --------------- | --------------------- |
| VS Code                  | Latest          | IDE                   |
| Dev Containers Extension | Latest          | Container integration |
| Docker                   | See table above | Container runtime     |
| Git                      | 2.30+           | Version control       |

---

## Installation Steps

### Step 1: Install Docker

#### Windows (with WSL 2)

1. **Install WSL 2** (if not already installed):

   ```powershell
   wsl --install
   ```

2. **Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop)**

3. **Enable WSL 2 backend**:
   - Right-click Docker icon in system tray → Settings
   - Check "Use the WSL 2 based engine"
   - Under Resources → WSL Integration, enable your distro

#### macOS

1. **Download and install [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)**
2. Start Docker Desktop from Applications
3. Wait for the Docker icon to show "Docker Desktop is running"

#### Linux

1. **Install Docker CE**:

   ```bash
   # Ubuntu/Debian
   curl -fsSL https://get.docker.com | sh

   # Add your user to docker group
   sudo usermod -aG docker $USER

   # Log out and back in for group changes to take effect
   ```

2. **Install Docker Compose** (if not included):

   ```bash
   sudo apt-get install docker-compose-plugin
   ```

3. **Verify installation**:

   ```bash
   docker --version
   docker compose version
   ```

### Step 2: Install VS Code Extensions

1. **Install [VS Code](https://code.visualstudio.com/)** if not already installed

2. **Install the Dev Containers extension**:
   - Open VS Code
   - Press `Ctrl+Shift+X` to open Extensions
   - Search for "Dev Containers"
   - Install **Dev Containers** by Microsoft

   Or install from command line:

   ```bash
   code --install-extension ms-vscode-remote.remote-containers
   ```

3. **Optional: Install Remote Development extension pack** (includes SSH, WSL, and Containers):

   ```bash
   code --install-extension ms-vscode-remote.vscode-remote-extensionpack
   ```

### Step 3: Open Repository in Dev Container

1. **Clone the repository**:

   ```bash
   git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
   cd azure-agentic-infraops
   code .
   ```

2. **Open in Dev Container**:
   - Press `F1` to open Command Palette
   - Type "Dev Containers: Reopen in Container"
   - Press Enter

3. **Wait for container to build** (2-5 minutes on first run)

4. **Verify setup**:

   ```bash
   az --version
   bicep --version
   terraform --version
   pwsh --version
   ```

---

## Alternative Docker Options

If Docker Desktop doesn't work for your environment, consider these alternatives:

### Rancher Desktop

Free, open-source alternative to Docker Desktop.

1. Download from [rancherdesktop.io](https://rancherdesktop.io/)
2. Choose "dockerd (moby)" as the container runtime
3. Works with VS Code Dev Containers extension

### Podman (Linux/macOS)

Docker-compatible container engine without daemon.

1. **Install Podman**:

   ```bash
   # macOS
   brew install podman
   podman machine init
   podman machine start

   # Linux (Fedora/RHEL)
   sudo dnf install podman

   # Linux (Ubuntu 22.04+)
   sudo apt-get install podman
   ```

2. **Configure VS Code** to use Podman:
   Add to your VS Code settings:

   ```json
   {
     "dev.containers.dockerPath": "podman"
   }
   ```

### Colima (macOS)

Lightweight Docker runtime for macOS.

1. **Install Colima**:

   ```bash
   brew install colima docker
   colima start
   ```

2. Works automatically with VS Code Dev Containers

### Remote Docker Host

Run Docker on a remote server and connect to it:

1. **Install Docker on remote host** (Linux server)

2. **Configure SSH access** with key-based authentication

3. **Set Docker context**:

   ```bash
   docker context create remote --docker "host=ssh://user@remote-host"
   docker context use remote
   ```

4. **Open in Dev Container** - VS Code will use the remote Docker

See [Develop on a remote Docker host](https://code.visualstudio.com/remote/advancedcontainers/develop-remote-host)
for detailed instructions.

---

## Working with Git

### Line Endings (Cross-Platform)

This repository uses LF line endings via `.gitattributes`. Git handles conversion automatically:

```bash
# Check your Git config
git config core.autocrlf

# Should be 'input' (Linux/Mac) or 'true' (Windows)
```

### Git Credentials

The Dev Container automatically shares Git credentials from your host:

- **HTTPS**: Credential managers (Windows Credential Manager, macOS Keychain) work automatically
- **SSH**: SSH keys are shared via ssh-agent

To verify:

```bash
# Check SSH access
ssh -T git@github.com

# Check credential helper
git config --global credential.helper
```

If SSH keys aren't working, see
[Sharing Git credentials with your container](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials).

---

## What's in Our Dev Container?

The `.devcontainer/devcontainer.json` configures:

### Pre-installed Tools

| Tool         | Version | Purpose                   |
| ------------ | ------- | ------------------------- |
| Azure CLI    | Latest  | Azure resource management |
| Bicep CLI    | Latest  | Infrastructure as Code    |
| PowerShell 7 | Latest  | Automation scripts        |
| Python 3.12  | 3.12.x  | Diagrams, scripts         |
| Node.js      | LTS     | markdownlint, npm scripts |
| Graphviz     | Latest  | Diagram rendering         |

### VS Code Extensions (Auto-installed)

- GitHub Copilot & Copilot Chat
- Azure extensions (Bicep, Resource Groups, Container Apps)
- PowerShell extension
- Markdown preview and linting
- Git and GitHub integration

### Post-Create Setup

The container automatically:

- Configures Husky git hooks for pre-commit linting
- Sets up Azure PowerShell modules
- Configures the Azure Pricing MCP server
- Verifies all tool installations

---

## Troubleshooting

### Container Build Fails

**Symptoms**: Red error notification, container won't start

**Solutions**:

1. **Check Docker is running**:

   ```bash
   docker info
   ```

2. **Clear Docker cache and rebuild**:
   - Press `F1` → "Dev Containers: Rebuild Container Without Cache"

3. **Check disk space**:

   ```bash
   docker system df
   docker system prune  # Clean up unused resources
   ```

### Extensions Not Loading

**Symptoms**: Copilot or other extensions show as disabled

**Solutions**:

1. **Reload window**: Press `F1` → "Developer: Reload Window"
2. **Check extension host**: View → Output → Select "Extension Host"
3. **Rebuild container**: Press `F1` → "Dev Containers: Rebuild Container"

### Git Authentication Fails

**Symptoms**: `Permission denied (publickey)` or credential prompts

**Solutions**:

1. **For SSH**: Ensure ssh-agent is running on host:

   ```bash
   # Windows (PowerShell as Admin)
   Get-Service ssh-agent | Set-Service -StartupType Automatic
   Start-Service ssh-agent
   ssh-add ~/.ssh/id_rsa

   # macOS/Linux
   eval "$(ssh-agent -s)"
   ssh-add ~/.ssh/id_rsa
   ```

2. **For HTTPS**: Configure credential helper on host:

   ```bash
   # Windows
   git config --global credential.helper manager

   # macOS
   git config --global credential.helper osxkeychain

   # Linux
   git config --global credential.helper store
   ```

### Slow Performance (Windows/macOS)

**Symptoms**: File operations are slow, especially with many files

**Solutions**:

1. **Use WSL 2 file system** (Windows):
   - Store your code in `\\wsl$\Ubuntu\home\user\` instead of `/mnt/c/`

2. **Clone to container volume**:
   - Press `F1` → "Dev Containers: Clone Repository in Container Volume"

3. **Exclude unnecessary folders** from file watching in VS Code settings

### Azure Mount Issues

**Symptoms**: `~/.azure` not available in container

**Solutions**:

The container mounts `~/.azure` from your host. If it's missing:

1. Run `az login` on your host machine first
2. Rebuild the container

---

## Running Without Docker

If you cannot use Docker, install tools manually:

1. **Follow the manual installation steps** in [Prerequisites](prerequisites.md#option-b-manual-installation)

2. **Install VS Code extensions manually**:

   ```bash
   code --install-extension github.copilot
   code --install-extension github.copilot-chat
   code --install-extension ms-azuretools.vscode-bicep
   code --install-extension ms-vscode.powershell
   ```

3. **Configure Husky hooks**:

   ```bash
   npm install
   git config core.hooksPath .husky
   ```

---

## Advanced Configuration

### Custom Features

Add tools to your container by modifying `.devcontainer/devcontainer.json`:

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/kubectl-helm-minikube:1": {},
    "ghcr.io/devcontainers/features/github-cli:1": {},
  },
}
```

Browse available features at [containers.dev/features](https://containers.dev/features).

### Environment Variables

Set environment variables in `.devcontainer/devcontainer.json`:

```jsonc
{
  "remoteEnv": {
    "AZURE_DEFAULTS_LOCATION": "swedencentral",
    "MY_CUSTOM_VAR": "value",
  },
}
```

### Dotfiles

Personalize your container with dotfiles:

1. Create a GitHub repository with your dotfiles
2. Configure in VS Code settings:

   ```json
   {
     "dotfiles.repository": "your-username/dotfiles",
     "dotfiles.targetPath": "~/dotfiles",
     "dotfiles.installCommand": "install.sh"
   }
   ```

---

## Next Steps

- [Quick Start](../getting-started/quickstart.md) — Run your first demo
- [Prerequisites](prerequisites.md) — Full requirements reference
- [Troubleshooting](troubleshooting.md) — More solutions
- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)

---

## Additional Resources

- [Dev Containers Specification](https://containers.dev/) — Open standard
- [Alternative Docker options](https://code.visualstudio.com/remote/advancedcontainers/docker-options)
- [Advanced container configuration](https://code.visualstudio.com/remote/advancedcontainers/overview)
- [devcontainer.json reference](https://containers.dev/implementors/json_reference)
