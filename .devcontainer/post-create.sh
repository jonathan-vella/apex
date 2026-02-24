#!/bin/bash
set -e

# ─── Progress Tracking Helpers ───────────────────────────────────────────────

TOTAL_STEPS=10
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
echo " 🚀 Agentic InfraOps — Dev Container Setup"
echo "    $TOTAL_STEPS steps · $(date '+%H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Log output to file for debugging
exec 1> >(tee -a ~/.devcontainer-install.log)
exec 2>&1

# ─── Step 1: npm install (local) ─────────────────────────────────────────────

step_start "📦" "Installing npm dependencies..."
if npm install --loglevel=warn 2>&1 | tail -3; then
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

# ─── Step 3: Directories & Git ───────────────────────────────────────────────

step_start "🔐" "Configuring Git & directories..."
mkdir -p "${HOME}/.cache" "${HOME}/.config/gh"
sudo chown -R vscode:vscode "${HOME}/.cache" 2>/dev/null || true
sudo chown -R vscode:vscode "${HOME}/.config/gh" 2>/dev/null || true
chmod 755 "${HOME}/.cache" 2>/dev/null || true
chmod 755 "${HOME}/.config/gh" 2>/dev/null || true
git config --global --add safe.directory "${PWD}"
git config --global core.autocrlf input
step_done "Git configured, cache dirs created"

# ─── Step 4: Python packages ─────────────────────────────────────────────────

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
    if pip3 install --quiet --user diagrams matplotlib pillow checkov ruff 2>&1 | tail -1; then
        step_done "Installed via pip (diagrams, matplotlib, pillow, checkov, ruff)"
    else
        step_warn "pip install had issues"
    fi
fi

# ─── Step 5: PowerShell modules ──────────────────────────────────────────────

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

# ─── Step 6: Azure Pricing MCP Server ────────────────────────────────────────

step_start "💰" "Setting up Azure Pricing MCP Server..."
MCP_DIR="${PWD}/mcp/azure-pricing-mcp"
if [ -d "$MCP_DIR" ]; then
    if [ ! -d "$MCP_DIR/.venv" ]; then
        python3 -m venv "$MCP_DIR/.venv"
    fi

    cd "$MCP_DIR"
    "$MCP_DIR/.venv/bin/pip" install --quiet -e . 2>&1 | tail -1 || true
    cd - > /dev/null

    if "$MCP_DIR/.venv/bin/python" -c "from azure_pricing_mcp import server; print('OK')" 2>/dev/null; then
        step_done "MCP server installed & health check passed"
    else
        step_warn "MCP server installed but health check failed"
    fi
else
    step_fail "MCP directory not found at $MCP_DIR"
fi

# ─── Step 7: Terraform MCP Server binary ────────────────────────────────────

step_start "🏗️ " "Installing Terraform MCP Server binary (go install)..."
if command -v go &> /dev/null; then
    if go install github.com/hashicorp/terraform-mcp-server/cmd/terraform-mcp-server@latest 2>&1 | tail -2; then
        if command -v /go/bin/terraform-mcp-server &> /dev/null; then
            step_done "terraform-mcp-server installed at /go/bin/"
        else
            step_warn "go install ran but binary not found at expected path"
        fi
    else
        step_warn "go install failed — MCP server unavailable until fixed"
    fi
else
    step_warn "Go not found — Terraform MCP Server not installed"
fi

# ─── Step 8: Python dependencies (authoritative) ─────────────────────────────

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

# ─── Step 9: Azure CLI defaults ────────────────────────────────────

step_start "☁️ " "Configuring Azure CLI..."
if az config set defaults.location=swedencentral --only-show-errors 2>/dev/null; then
    az config set auto-upgrade.enable=no --only-show-errors 2>/dev/null || true
    step_done "Default location: swedencentral"
else
    step_warn "Azure CLI config skipped (not authenticated)"
fi

# ─── Step 10: MCP config & final verification ─────────────────────────────

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

default_microsoft_learn = {
    "type": "http",
    "url": "https://learn.microsoft.com/api/mcp",
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
servers.setdefault("microsoft-learn", default_microsoft_learn)

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
printf "        %-15s %s\n" "terraform-mcp:" "$(terraform-mcp-server --version 2>/dev/null || /go/bin/terraform-mcp-server --version 2>/dev/null || echo '❌ not installed')"

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
echo "    3. Open Chat (Ctrl+Shift+I) → Select InfraOps Conductor"
echo ""
