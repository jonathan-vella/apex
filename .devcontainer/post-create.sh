#!/bin/bash
set -e

# ─── Progress Tracking Helpers ───────────────────────────────────────────────

TOTAL_STEPS=12
CURRENT_STEP=0
SETUP_START=$(date +%s)
STEP_START=0
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

step_start() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    STEP_START=$(date +%s)
    printf "\n [%d/%d] %s %s\n" "$CURRENT_STEP" "$TOTAL_STEPS" "$1" "$2"
}

step_done() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "        ✅ %s (%ds)\n" "${1:-Done}" "$elapsed"
}

step_warn() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    WARN_COUNT=$((WARN_COUNT + 1))
    printf "        ⚠️  %s (%ds)\n" "${1:-Completed with warnings}" "$elapsed"
}

step_fail() {
    local elapsed=$(( $(date +%s) - STEP_START ))
    [[ $elapsed -lt 0 ]] && elapsed=0
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "        ❌ %s (%ds)\n" "${1:-Failed}" "$elapsed"
}

# ─── Banner ──────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🚀 APEX — Dev Container Setup"
echo "    $TOTAL_STEPS steps · $(date '+%H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Log output to file for debugging
exec 1> >(tee ~/.devcontainer-install.log)
exec 2>&1

# ─── Step 1: npm install (local) ─────────────────────────────────────────────

step_start "📦" "Installing npm dependencies..."
if npm install --loglevel=error 2>&1; then
    step_done "npm packages installed"
else
    step_warn "npm install had issues, continuing"
fi

# ─── Step 2: npm global tools ────────────────────────────────────────────────

step_start "📦" "Installing global tools (markdownlint-cli2)..."
if npm install -g markdownlint-cli2 --loglevel=warn 2>&1 | tail -2; then
    step_done "markdownlint-cli2 installed globally"
else
    step_warn "Global install had issues"
fi

# ─── Step 3: k6 load testing tool ────────────────────────────────────────────

step_start "📦" "Installing k6 load testing tool..."
ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "amd64" ]; then
    curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --yes --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg 2>/dev/null
    echo 'deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main' | sudo tee /etc/apt/sources.list.d/k6.list > /dev/null
    if sudo apt-get update > /dev/null 2>&1 && sudo apt-get install -y k6 > /dev/null 2>&1; then
        step_done "k6 installed from deb repo (amd64)"
    else
        step_warn "k6 deb install failed"
    fi
elif [ "$ARCH" = "arm64" ]; then
    K6_VER=$(curl -fsSL https://api.github.com/repos/grafana/k6/releases/latest | grep tag_name | head -1 | tr -dc 'v0-9.')
    if [ -n "$K6_VER" ]; then
        curl -fsSL "https://github.com/grafana/k6/releases/download/${K6_VER}/k6-${K6_VER}-linux-arm64.tar.gz" \
            | sudo tar -xz --strip-components=1 -C /usr/local/bin/ 2>/dev/null \
            && step_done "k6 ${K6_VER} installed from GitHub release (arm64)" \
            || step_warn "k6 arm64 install failed"
    else
        step_warn "k6 version lookup failed (check GitHub API access)"
    fi
else
    step_warn "k6 skipped: unsupported architecture $ARCH (supported: amd64, arm64)"
fi

# ─── Step 4: Deno upgrade ─────────────────────────────────────────────────────
# The devcontainer feature caches the image layer, so "version: latest" may
# lag behind. Explicitly upgrade to ensure we always have the latest release.
# Falls back to curl installer if `deno upgrade` fails (e.g. corrupt binary,
# GitHub API rate limit during feature install).

step_start "🦕" "Upgrading Deno to latest..."
if command -v deno &>/dev/null; then
    DENO_OUT=$(sudo deno upgrade 2>&1) ; DENO_RC=$?
    echo "$DENO_OUT" | tail -1
    if [[ $DENO_RC -eq 0 ]]; then
        step_done "deno $(deno --version 2>/dev/null | head -n1 | awk '{print $2}')"
    else
        # Fallback: install from official script if upgrade fails
        DENO_OUT=$(curl -fsSL https://deno.land/install.sh | sudo env DENO_INSTALL=/usr/local sh 2>&1) ; DENO_RC=$?
        echo "$DENO_OUT" | tail -1
        if [[ $DENO_RC -eq 0 ]]; then
            step_done "deno $(deno --version 2>/dev/null | head -n1 | awk '{print $2}') (fresh install)"
        else
            step_warn "Deno upgrade and fresh install both failed — using feature-installed version"
        fi
    fi
    # Pre-cache drawio MCP server dependencies to eliminate first-start latency.
    # Must run from the project dir so deno.json import map is resolved correctly.
    DRAWIO_DIR="${PWD}/mcp/drawio-mcp-server"
    if [ -f "$DRAWIO_DIR/deno.json" ]; then
        (cd "$DRAWIO_DIR" && deno install) 2>/dev/null \
            && printf "        ✅ drawio-mcp-server deps cached\n" \
            || printf "        ⚠️  drawio dep cache skipped\n"
    fi
else
    step_warn "Deno not found — rebuild container"
fi

# ─── Step 5: Directories & Git ───────────────────────────────────────────────

step_start "🔐" "Configuring Git & directories..."
sudo mkdir -p "${HOME}/.cache" "${HOME}/.cache/deno" "${HOME}/.config/gh" \
              "${HOME}/.local/share/powershell/PSReadLine"
sudo chown -R vscode:vscode "${HOME}/.cache" 2>/dev/null || true
sudo chown -R vscode:vscode "${HOME}/.config/gh" 2>/dev/null || true
sudo chown -R vscode:vscode "${HOME}/.local/share/powershell/PSReadLine" 2>/dev/null || true
chmod 755 "${HOME}/.cache" 2>/dev/null || true
chmod 755 "${HOME}/.config/gh" 2>/dev/null || true
git config --global --add safe.directory "${PWD}"
git config --global core.autocrlf input
step_done "Git configured, cache dirs created"

# ─── Step 6: Python packages ─────────────────────────────────────────────────

step_start "🐍" "Installing Python packages..."
export PATH="${HOME}/.local/bin:${PATH}"

if command -v uv &> /dev/null; then
    mkdir -p "${HOME}/.cache/uv" 2>/dev/null || true
    chmod -R 755 "${HOME}/.cache/uv" 2>/dev/null || true
    if uv pip install --system --quiet diagrams matplotlib pillow checkov ruff 2>&1; then
        step_done "Installed via uv (diagrams, matplotlib, pillow, checkov, ruff)"
    else
        step_warn "uv install had issues, continuing"
    fi
else
    if pip3 install --quiet diagrams matplotlib pillow checkov ruff 2>&1 | tail -1; then
        step_done "Installed via pip (diagrams, matplotlib, pillow, checkov, ruff)"
    else
        step_warn "pip install had issues"
    fi
fi

# ─── Step 7: PowerShell modules ──────────────────────────────────────────────

step_start "🔧" "Installing Azure PowerShell modules..."
pwsh -NoProfile -Command "
    \$ErrorActionPreference = 'SilentlyContinue'
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted

    \$modules = @('Az.Accounts', 'Az.Resources', 'Az.Storage', 'Az.Network', 'Az.KeyVault', 'Az.Websites')
    \$toInstall = \$modules | Where-Object { -not (Get-Module -ListAvailable -Name \$_) }

    if (\$toInstall.Count -eq 0) {
        Write-Host '        All modules already installed'
        exit 0
    }

    Write-Host \"        Installing \$(\$toInstall.Count) modules: \$(\$toInstall -join ', ')\"

    \$jobs = \$toInstall | ForEach-Object {
        Start-Job -ScriptBlock {
            param(\$m)
            Install-Module -Name \$m -Scope CurrentUser -Force -AllowClobber -SkipPublisherCheck -ErrorAction SilentlyContinue
        } -ArgumentList \$_
    }

    \$completed = \$jobs | Wait-Job -Timeout 90
    \$jobs | Remove-Job -Force
" && step_done "PowerShell modules installed" || step_warn "PowerShell module installation incomplete"

# ─── Step 8: Azure Pricing MCP Server ────────────────────────────────────────

step_start "💰" "Setting up Azure Pricing MCP Server..."
MCP_DIR="${PWD}/mcp/azure-pricing-mcp"
if [ -d "$MCP_DIR" ]; then
    if [ ! -f "$MCP_DIR/.venv/bin/pip" ]; then
        rm -rf "$MCP_DIR/.venv" 2>/dev/null || true
        python3 -m venv "$MCP_DIR/.venv"
    fi

    "$MCP_DIR/.venv/bin/pip" install --quiet --upgrade pip 2>&1 | tail -1 || true

    cd "$MCP_DIR"
    "$MCP_DIR/.venv/bin/pip" install --quiet -e ".[azure]" 2>&1 | tail -1 || true
    cd - > /dev/null

    if "$MCP_DIR/.venv/bin/python" -c "from azure_pricing_mcp import server; print('OK')" 2>/dev/null; then
        step_done "MCP server installed & health check passed"
    else
        step_warn "MCP server installed but health check failed"
    fi
else
    step_fail "MCP directory not found at $MCP_DIR"
fi

# ─── Step 9: Terraform MCP Server binary ────────────────────────────────────
# Uses clone+build instead of go install because the module's go.mod contains
# replace directives, which go install rejects for non-main modules.

step_start "🏗️ " "Installing Terraform MCP Server binary (clone & build)..."
if command -v go &> /dev/null; then
    TF_MCP_TMP=$(mktemp -d)
    if git clone --depth=1 --quiet https://github.com/hashicorp/terraform-mcp-server.git "$TF_MCP_TMP" 2>&1; then
        pushd "$TF_MCP_TMP" > /dev/null
        if go build -o /go/bin/terraform-mcp-server ./cmd/terraform-mcp-server/ 2>&1 | tail -2; then
            popd > /dev/null
            rm -rf "$TF_MCP_TMP"
            if command -v terraform-mcp-server &>/dev/null || [ -x /go/bin/terraform-mcp-server ]; then
                step_done "terraform-mcp-server built and installed at /go/bin/"
            else
                step_warn "build ran but binary not found at expected path"
            fi
        else
            popd > /dev/null
            rm -rf "$TF_MCP_TMP"
            step_warn "go build failed — MCP server unavailable until fixed"
        fi
    else
        rm -rf "$TF_MCP_TMP"
        step_warn "git clone failed — check network access to github.com"
    fi
else
    step_warn "Go not found — Terraform MCP Server not installed"
fi

# ─── Step 10: Python dependencies (authoritative) ───────────────────────────

step_start "📦" "Verifying Python dependencies..."
if [ -f "${PWD}/requirements.txt" ]; then
    if python3 -c "import diagrams, matplotlib, PIL, checkov" 2>/dev/null; then
        step_done "All Python dependencies verified"
    else
        pip install --quiet -r "${PWD}/requirements.txt"
        step_done "Python dependencies installed from requirements.txt"
    fi
else
    step_warn "requirements.txt not found"
fi

# ─── Step 11: Azure CLI extension install behavior ─────────────────────────

step_start "☁️ " "Configuring Azure CLI extension install behavior..."
if az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors 2>/dev/null \
    && az config set extension.dynamic_install_allow_preview=false --only-show-errors 2>/dev/null; then
    az config set auto-upgrade.enable=no --only-show-errors 2>/dev/null || true
    step_done "Azure CLI stable extensions auto-install without prompt"
else
    step_warn "Azure CLI config update failed"
fi

# ─── Step 12: MCP config & final verification ─────────────────────────────

step_start "🔍" "Verifying installations & MCP config..."

# Ensure MCP config
MCP_CONFIG_PATH="${PWD}/.vscode/mcp.json"
mkdir -p "${PWD}/.vscode"
python3 - "$MCP_CONFIG_PATH" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])

default_azure_pricing = {
    "type": "stdio",
    "command": "${workspaceFolder}/mcp/azure-pricing-mcp/.venv/bin/python",
    "args": ["-m", "azure_pricing_mcp"],
    "cwd": "${workspaceFolder}/mcp/azure-pricing-mcp/src",
}

default_github = {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp/",
}

default_drawio = {
    "type": "stdio",
    "command": "deno",
    "args": ["run", "-P", "--no-check", "--cached-only", "${workspaceFolder}/mcp/drawio-mcp-server/src/index.ts"],
}

data = {"servers": {}}

if config_path.exists():
    raw = config_path.read_text(encoding="utf-8").strip()
    if raw:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            backup = config_path.with_suffix(config_path.suffix + ".bak")
            backup.write_text(raw + "\n", encoding="utf-8")
            data = {"servers": {}}

servers = data.setdefault("servers", {})
servers.setdefault("azure-pricing", default_azure_pricing)
servers.setdefault("github", default_github)
servers.setdefault("drawio", default_drawio)
config_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY

# Verify key tools
echo ""
printf "        %-15s %s\n" "Azure CLI:" "$(az --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "Bicep:" "$(az bicep version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "PowerShell:" "$(pwsh --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Python:" "$(python3 --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Node.js:" "$(node --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "GitHub CLI:" "$(gh --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "uv:" "$(uv --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Checkov:" "$(checkov --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "markdownlint:" "$(cd /tmp && markdownlint-cli2 --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "graphviz:" "$(dot -V 2>&1 | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "dos2unix:" "$(dos2unix --version 2>&1 | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "k6:" "$(k6 version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Deno:" "$(deno --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "terraform-mcp:" "$(( terraform-mcp-server --version 2>/dev/null || /go/bin/terraform-mcp-server --version 2>/dev/null ) | head -2 | tr '\n' ' ' || echo '❌ not installed')"

step_done "All verifications complete"

# ─── Summary ─────────────────────────────────────────────────────────────────

TOTAL_ELAPSED=$(( $(date +%s) - SETUP_START ))
MINUTES=$((TOTAL_ELAPSED / 60))
SECONDS_REMAINING=$((TOTAL_ELAPSED % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$FAIL_COUNT" -eq 0 ] && [ "$WARN_COUNT" -eq 0 ]; then
    printf " ✅ Setup complete! %d/%d steps passed (%dm %ds)\n" "$PASS_COUNT" "$TOTAL_STEPS" "$MINUTES" "$SECONDS_REMAINING"
elif [ "$FAIL_COUNT" -eq 0 ]; then
    printf " ⚠️  Setup complete with warnings: %d passed, %d warnings (%dm %ds)\n" "$PASS_COUNT" "$WARN_COUNT" "$MINUTES" "$SECONDS_REMAINING"
else
    printf " ❌ Setup complete with errors: %d passed, %d warnings, %d failed (%dm %ds)\n" "$PASS_COUNT" "$WARN_COUNT" "$FAIL_COUNT" "$MINUTES" "$SECONDS_REMAINING"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo " 📝 Next steps:"
echo "    1. Authenticate: az login"
echo "    2. Set subscription: az account set --subscription <id>"
echo "    3. Open Chat (Ctrl+Shift+I) → Select Orchestrator"
echo ""
