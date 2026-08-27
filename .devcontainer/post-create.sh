#!/bin/bash
set -e

# ─── Progress Tracking Helpers ───────────────────────────────────────────────

# Compute total steps dynamically from step_start calls in this script
SCRIPT_PATH="${BASH_SOURCE[0]}"
TOTAL_STEPS=0
if [[ -r "$SCRIPT_PATH" ]]; then
    TOTAL_STEPS=$(grep -Ec '^step_start ' "$SCRIPT_PATH" || true)
fi
# Fallback if grep fails
if [[ "$TOTAL_STEPS" -eq 0 ]]; then
    TOTAL_STEPS=11
fi
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

# ─── Step 1: npm dependencies ────────────────────────────────────────────────

step_start "📦" "Installing npm dependencies..."
if npm ci --loglevel=error 2>&1; then
    step_done "npm packages installed"
else
    step_fail "npm ci failed"
fi

# ─── Step 2: Directories & Git ───────────────────────────────────────────────

step_start "🔐" "Configuring Git & directories..."
sudo mkdir -p "${HOME}/.cache" "${HOME}/.config/gh" \
              "${HOME}/.local/share/powershell/PSReadLine"
sudo chown -R vscode:vscode "${HOME}/.cache" 2>/dev/null || true
sudo chown -R vscode:vscode "${HOME}/.config/gh" 2>/dev/null || true
sudo chown -R vscode:vscode "${HOME}/.local/share/powershell/PSReadLine" 2>/dev/null || true
chmod 755 "${HOME}/.cache" 2>/dev/null || true
chmod 755 "${HOME}/.config/gh" 2>/dev/null || true
git config --global --add safe.directory "${PWD}"
git config --global core.autocrlf input
step_done "Git configured, cache dirs created"

# ─── Step 3: Python packages ─────────────────────────────────────────────────

step_start "🐍" "Installing Python packages..."
export PATH="${HOME}/.local/bin:${PATH}"

if command -v uv &> /dev/null; then
    mkdir -p "${HOME}/.cache/uv" 2>/dev/null || true
    chmod -R 755 "${HOME}/.cache/uv" 2>/dev/null || true
    if uv pip install --system --quiet --requirement "${PWD}/requirements.txt" 2>&1; then
        step_done "Installed pinned requirements via uv"
    else
        step_warn "uv install had issues, continuing"
    fi
else
    if pip3 install --quiet --requirement "${PWD}/requirements.txt"; then
        step_done "Installed pinned requirements via pip"
    else
        step_warn "pip install had issues"
    fi
fi

# ─── Step 4: PowerShell modules ──────────────────────────────────────────────

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

# ─── Step 5: Terraform CLI hardening ─────────────────────────────────────────
# The Terraform plugin-cache directory must exist before `terraform init` runs;
# the CLI refuses to operate when TF_PLUGIN_CACHE_DIR points at a missing path.
# devcontainer.json sets the env var; this step ensures the directory exists
# and runs a `terraform version` smoke test to fail fast on misconfiguration.

step_start "🪨" "Hardening Terraform CLI environment..."
TF_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"
if mkdir -p "$TF_CACHE_DIR" 2>/dev/null; then
    if command -v terraform &>/dev/null; then
        if terraform version > /dev/null 2>&1; then
            step_done "plugin-cache=$TF_CACHE_DIR · $(terraform version | head -1)"
        else
            step_warn "terraform binary present but 'terraform version' failed"
        fi
    else
        step_warn "Terraform not on PATH — plugin-cache dir created but CLI unverified"
    fi
else
    step_warn "Could not create plugin-cache dir at $TF_CACHE_DIR"
fi

# ─── Step 6: Python dependency verification ──────────────────────────────────

step_start "📦" "Verifying Python dependencies..."
if [ -f "${PWD}/requirements.txt" ]; then
    if python3 -c "import diagrams, matplotlib, PIL, pytest, ruff" 2>/dev/null; then
        step_done "All Python dependencies verified"
    else
        pip install --quiet -r "${PWD}/requirements.txt"
        step_done "Python dependencies installed from requirements.txt"
    fi
else
    step_warn "requirements.txt not found"
fi

# ─── Step 7: apex-recall CLI ─────────────────────────────────────────────────

step_start "🔍" "Installing apex-recall CLI..."
APEX_RECALL_DIR="${PWD}/tools/apex-recall"
if [ -d "$APEX_RECALL_DIR" ]; then
    UV_BIN=$(command -v uv 2>/dev/null || echo "${HOME}/.local/bin/uv")
    if [ -x "$UV_BIN" ]; then
        if "$UV_BIN" pip install --system --quiet -e "$APEX_RECALL_DIR" 2>&1; then
            if apex-recall --version >/dev/null 2>&1; then
                step_done "apex-recall $(apex-recall --version 2>&1 | awk '{print $2}') installed"
            else
                step_warn "apex-recall installed but --version check failed"
            fi
        else
            step_warn "uv pip install failed for apex-recall"
        fi
    else
        if pip3 install --quiet -e "$APEX_RECALL_DIR" 2>&1; then
            step_done "apex-recall installed via pip3"
        else
            step_warn "pip3 install failed for apex-recall"
        fi
    fi
else
    step_warn "apex-recall directory not found at $APEX_RECALL_DIR"
fi

# ─── Step 8: Gitleaks (secret scanner) ───────────────────────────────────────

step_start "🔐" "Installing gitleaks secret scanner..."
# The base image supports amd64 and arm64 only; keep release assets aligned.
case "$(dpkg --print-architecture)" in
    amd64) GITLEAKS_ARCH="x64" ;;
    arm64) GITLEAKS_ARCH="arm64" ;;
    *)     GITLEAKS_ARCH="" ;;
esac
if [ -z "$GITLEAKS_ARCH" ]; then
    step_warn "gitleaks skipped: unsupported architecture $(dpkg --print-architecture) (supported: amd64, arm64)"
else
    GITLEAKS_VERSION=$(curl -fsSL "https://api.github.com/repos/gitleaks/gitleaks/releases/latest" 2>/dev/null | jq -r '.tag_name' 2>/dev/null | sed 's/^v//' || echo '')
fi
if [ -n "$GITLEAKS_ARCH" ] && [ -n "$GITLEAKS_VERSION" ] && [ "$GITLEAKS_VERSION" != "null" ]; then
    if curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GITLEAKS_ARCH}.tar.gz" \
        | sudo tar -xz -C /usr/local/bin gitleaks 2>/dev/null; then
        step_done "gitleaks ${GITLEAKS_VERSION} installed (${GITLEAKS_ARCH})"
    else
        step_warn "gitleaks binary download failed (pre-commit hook will soft-skip)"
    fi
elif [ -n "$GITLEAKS_ARCH" ]; then
    step_warn "gitleaks version lookup failed (pre-commit hook will soft-skip)"
fi

# ─── Step 9: Azure CLI extension install behavior ────────────────────────────

step_start "☁️ " "Configuring Azure CLI extension install behavior..."
if az config set extension.use_dynamic_install=yes_without_prompt --only-show-errors 2>/dev/null \
    && az config set extension.dynamic_install_allow_preview=false --only-show-errors 2>/dev/null; then
    az config set auto-upgrade.enable=no --only-show-errors 2>/dev/null || true
    step_done "Azure CLI stable extensions auto-install without prompt"
else
    step_warn "Azure CLI config update failed"
fi

# ─── Step 10: Bicep CLI after persisted mounts ───────────────────────────────

step_start "🏗️ " "Ensuring Bicep CLI is available..."
if command -v bicep >/dev/null 2>&1 && bicep --version >/dev/null 2>&1; then
    step_done "$(bicep --version | head -1)"
elif az bicep version --only-show-errors >/dev/null 2>&1; then
    step_done "$(az bicep version --only-show-errors 2>/dev/null | head -1)"
elif az bicep install --only-show-errors >/dev/null 2>&1 \
    && az bicep version --only-show-errors >/dev/null 2>&1; then
    step_done "$(az bicep version --only-show-errors 2>/dev/null | head -1) installed after mounts initialized"
else
    step_warn "Bicep install failed — IaC validation will be unavailable"
fi

# ─── Step 11: MCP config & final verification ────────────────────────────────

step_start "🔍" "Verifying installations & MCP config..."

# Ensure MCP config
MCP_CONFIG_PATH="${PWD}/.vscode/mcp.json"
mkdir -p "${PWD}/.vscode"
python3 - "$MCP_CONFIG_PATH" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])

default_arm_mcp = {
    "type": "http",
    "url": "https://mcp.management.azure.com",
    "headers": {"x-mcp-toolset": "CostManagement, Pricing"},
}

default_github = {
    "type": "http",
    "url": "https://api.githubcopilot.com/mcp/",
}

default_azure_mcp = {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@azure/mcp@latest", "server", "start"],
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
servers.pop("azure-pricing", None)
servers.pop("drawio", None)
servers.pop("astro-docs", None)
servers.pop("terraform", None)
servers.setdefault("azure-resource-manager-mcp", default_arm_mcp)
servers.setdefault("github", default_github)
servers["azure-mcp"] = default_azure_mcp
config_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY

# Verify key tools
echo ""
printf "        %-15s %s\n" "Azure CLI:" "$(az --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "Bicep:" "$(bicep --version 2>/dev/null | head -n1 || az bicep version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "PowerShell:" "$(pwsh --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Python:" "$(python3 --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "Node.js:" "$(node --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "GitHub CLI:" "$(gh --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "uv:" "$(uv --version 2>/dev/null || echo '❌ not installed')"
printf "        %-15s %s\n" "markdownlint:" "$(./node_modules/.bin/markdownlint-cli2 --version 2>/dev/null | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "graphviz:" "$(dot -V 2>&1 | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "dos2unix:" "$(dos2unix --version 2>&1 | head -n1 || echo '❌ not installed')"
printf "        %-15s %s\n" "gitleaks:" "$(gitleaks version 2>/dev/null || echo '❌ not installed')"

# Wave 1+: assert minimum tool versions for IaC contract pipeline
if [ -f "tools/scripts/validate-tool-versions.mjs" ]; then
    node tools/scripts/validate-tool-versions.mjs --json > /tmp/tool-versions.json 2>/dev/null \
        && echo "        Tool pins:      ✅ all ≥ minimum" \
        || echo "        Tool pins:      ⚠️  one or more tools below pinned minimum (see tools/registry/tool-version-pins.json)"
fi

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
