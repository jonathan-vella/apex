# Dev Containers Setup Guide

> Complete guide for the VS Code Dev Container environment

## What Are Dev Containers?

Dev Containers use Docker to create a full-featured development environment inside a container.
When you open this repository in a Dev Container:

- All required tools are pre-installed (Azure CLI, Bicep, PowerShell 7)
- VS Code extensions are automatically configured
- Git credentials are shared from your host machine
- The environment matches what other team members use

---

## System Requirements

### Docker Options

| Platform | Recommended | Alternatives |
|----------|-------------|--------------|
| **Windows 10/11 Pro** | Docker Desktop with WSL 2 | Rancher Desktop, Podman |
| **Windows 10/11 Home** | Docker Desktop with WSL 2 (2004+) | — |
| **macOS** | Docker Desktop 2.0+ | Colima, Rancher Desktop |
| **Linux** | Docker CE/EE 18.06+ | Podman |

### Hardware

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| CPU | 2 cores | 4+ cores |
| Disk | 10 GB free | 20 GB free |

### Software

| Software | Version | Purpose |
|----------|---------|---------|
| VS Code | Latest | IDE |
| Dev Containers Extension | Latest | Container integration |
| Docker | See above | Container runtime |
| Git | 2.30+ | Version control |

---

## Installation Steps

### Step 1: Install Docker

#### Windows (with WSL 2)

```powershell
# Install WSL 2 (if not already installed)
wsl --install

# Then download and install Docker Desktop
# https://www.docker.com/products/docker-desktop

# Enable WSL 2 backend in Docker Desktop settings
```

#### macOS

1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. Start Docker Desktop from Applications
3. Wait for "Docker Desktop is running"

#### Linux

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
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops
code .
```

Press `F1` → **Dev Containers: Reopen in Container**

First build takes 2-5 minutes. Subsequent opens are instant.

### Step 4: Verify Setup

```bash
az --version && bicep --version && pwsh --version
```

---

## Alternative Docker Options

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

---

## What's Included

The Dev Container includes:

| Category | Tools |
|----------|-------|
| **Azure** | Azure CLI 2.50+, Bicep CLI 0.30+, Azure Pricing MCP |
| **PowerShell** | PowerShell 7+, Az modules |
| **Python** | Python 3.12+, diagrams library, graphviz |
| **Node.js** | Node 22+, npm, markdownlint |
| **VS Code Extensions** | 25+ extensions (Bicep, Copilot, Azure, etc.) |

---

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

---

## References

- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Rancher Desktop](https://rancherdesktop.io/)
