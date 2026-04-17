#!/usr/bin/env bash
# Devcontainer smoke test — run inside a built container to verify every
# tool, mount, and cache path the APEX workflow depends on. Exits non-zero
# on any failure and prints a summary table. Safe to re-run.
#
# Usage:
#   bash .devcontainer/smoke-test.sh          # full suite
#   SKIP_NETWORK=1 bash .devcontainer/smoke-test.sh   # skip gh auth check
#
# Designed for two contexts:
#   1. Local/Codespaces dev container (interactive feedback)
#   2. CI (devcontainers/ci@v0.3 runCmd) — exit code drives pass/fail

set -u
set -o pipefail

PASS=0
FAIL=0
WARN=0
FAILURES=()

# ─── Helpers ─────────────────────────────────────────────────────────────────

pass() { printf "  ✅ %-40s %s\n" "$1" "${2:-}"; PASS=$((PASS + 1)); }
fail() { printf "  ❌ %-40s %s\n" "$1" "${2:-}"; FAIL=$((FAIL + 1)); FAILURES+=("$1"); }
warn() { printf "  ⚠️  %-40s %s\n" "$1" "${2:-}"; WARN=$((WARN + 1)); }

# Assert a command exists AND runs (capture first line of --version output).
check_cmd() {
    local label="$1" cmd="$2"
    if out=$(eval "$cmd" 2>&1); then
        pass "$label" "$(printf '%s' "$out" | head -n1)"
    else
        fail "$label" "command failed: $cmd"
    fi
}

check_file() {
    local label="$1" path="$2"
    if [[ -e "$path" ]]; then
        pass "$label" "$path"
    else
        fail "$label" "missing: $path"
    fi
}

section() {
    printf "\n── %s ─────────────────────────────────────────\n" "$1"
}

# ─── Banner ──────────────────────────────────────────────────────────────────

printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
printf " 🔍 APEX devcontainer smoke test · %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
printf "    host arch: %s · kernel: %s\n" "$(uname -m)" "$(uname -r)"
printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"

# ─── User & filesystem ───────────────────────────────────────────────────────

section "User, home, and cache paths"

if id codespace &>/dev/null; then
    pass "user 'codespace' exists" "$(id codespace)"
else
    fail "user 'codespace' exists" "id codespace failed"
fi

[[ "$(id -un)" == "codespace" ]] \
    && pass "running as 'codespace'" \
    || warn "running as '$(id -un)' (expected codespace)"

[[ "$HOME" == "/home/codespace" ]] \
    && pass "\$HOME is /home/codespace" \
    || fail "\$HOME is /home/codespace" "got: $HOME"

check_file "~/.cache (dir)"     "$HOME/.cache"
check_file "~/.local/bin (dir)" "$HOME/.local/bin"

# Ownership check: cache must be owned by codespace (else uv/pyenv will hit
# permission errors later).
if [[ "$(stat -c '%U' "$HOME/.cache" 2>/dev/null)" == "codespace" ]]; then
    pass "~/.cache owned by codespace"
else
    fail "~/.cache owned by codespace" "owner: $(stat -c '%U' "$HOME/.cache" 2>/dev/null)"
fi

# ─── Mounts ──────────────────────────────────────────────────────────────────

section "Mounts"

# .azure is a bind mount from host; directory must exist (may be empty if
# host has never run `az login`).
check_file "~/.azure (host bind mount)"   "$HOME/.azure"
check_file "~/.config/gh (volume mount)"  "$HOME/.config/gh"
check_file "~/.cache/uv (volume mount)"   "$HOME/.cache/uv"

# ─── Core language runtimes (base image) ────────────────────────────────────

section "Language runtimes (base image provided)"

check_cmd "python3"        "python3 --version"
check_cmd "pyenv"          "pyenv --version"

# Python must be pyenv-pinned to 3.13.x
PY_VER=$(python3 --version 2>&1 | awk '{print $2}')
if [[ "$PY_VER" == 3.13.* ]]; then
    pass "Python pinned to 3.13.x" "$PY_VER"
else
    fail "Python pinned to 3.13.x" "got: $PY_VER (expected 3.13.x)"
fi

check_cmd "node"           "node --version"
check_cmd "npm"            "npm --version"
check_cmd "go"             "go version"
check_cmd "git"            "git --version"
check_cmd "gh (GitHub CLI)" "gh --version"

# ─── Feature-installed tools ────────────────────────────────────────────────

section "Feature-installed tools"

check_cmd "Azure CLI"      "az --version | head -n1"
check_cmd "Bicep"          "az bicep version"
check_cmd "PowerShell"     "pwsh --version"
check_cmd "Terraform"      "terraform version | head -n1"
check_cmd "TFLint"         "tflint --version | head -n1"
check_cmd "Deno"           "deno --version | head -n1"
check_cmd "azd"            "azd version"

# ─── Post-create-installed tools ────────────────────────────────────────────

section "Post-create installed tools"

check_cmd "uv"             "uv --version"
check_cmd "graphviz (dot)" "dot -V 2>&1"
check_cmd "dos2unix"       "dos2unix --version 2>&1 | head -n1"
check_cmd "k6"             "k6 version"
check_cmd "checkov"        "checkov --version"
check_cmd "ruff"           "ruff --version"

# markdownlint-cli2 lints the cwd by default; run from /tmp to avoid that.
if out=$(cd /tmp && markdownlint-cli2 --version 2>&1 | head -n1); then
    pass "markdownlint-cli2" "$out"
else
    fail "markdownlint-cli2" "not found or failed"
fi

# terraform-mcp-server is built into /go/bin or found on PATH.
if command -v terraform-mcp-server &>/dev/null; then
    pass "terraform-mcp-server (PATH)" "$(terraform-mcp-server --version 2>&1 | head -n1)"
elif [[ -x /go/bin/terraform-mcp-server ]]; then
    pass "terraform-mcp-server (/go/bin)" "$(/go/bin/terraform-mcp-server --version 2>&1 | head -n1)"
else
    fail "terraform-mcp-server" "not installed"
fi

# ─── Python packages ─────────────────────────────────────────────────────────

section "Python packages"

if python3 -c "import diagrams, matplotlib, PIL, checkov" 2>/dev/null; then
    pass "python imports (diagrams, matplotlib, PIL, checkov)"
else
    fail "python imports" "at least one of diagrams/matplotlib/PIL/checkov missing"
fi

# ─── PowerShell modules ──────────────────────────────────────────────────────

section "PowerShell Az modules"

PS_EXPECTED=(Az.Accounts Az.Resources Az.Storage Az.Network Az.KeyVault Az.Websites)
for mod in "${PS_EXPECTED[@]}"; do
    if pwsh -NoProfile -Command "
        if (Get-Module -ListAvailable -Name $mod) { exit 0 } else { exit 1 }
    " 2>/dev/null; then
        pass "PowerShell module: $mod"
    else
        fail "PowerShell module: $mod" "Get-Module -ListAvailable returned none"
    fi
done

# ─── Azure Pricing MCP venv ─────────────────────────────────────────────────

section "Azure Pricing MCP server"

MCP_DIR="${PWD}/mcp/azure-pricing-mcp"
MCP_PY="$MCP_DIR/.venv/bin/python"

if [[ -x "$MCP_PY" ]]; then
    pass "venv python exists" "$MCP_PY"
    if "$MCP_PY" -c "from azure_pricing_mcp import server" 2>/dev/null; then
        pass "azure_pricing_mcp importable"
    else
        fail "azure_pricing_mcp importable" "import failed"
    fi
else
    fail "venv python exists" "missing: $MCP_PY"
fi

# ─── MCP config ──────────────────────────────────────────────────────────────

section ".vscode/mcp.json"

MCP_JSON="${PWD}/.vscode/mcp.json"
if [[ -f "$MCP_JSON" ]]; then
    pass "mcp.json exists" "$MCP_JSON"
    for key in azure-pricing github drawio; do
        if python3 -c "
import json, sys
with open('$MCP_JSON') as f:
    data = json.load(f)
sys.exit(0 if '$key' in data.get('servers', {}) else 1)
" 2>/dev/null; then
            pass "mcp.json has server: $key"
        else
            fail "mcp.json has server: $key" "missing from servers{}"
        fi
    done
else
    fail "mcp.json exists" "missing: $MCP_JSON"
fi

# ─── GitHub auth (optional — requires GH_TOKEN from host) ───────────────────

section "GitHub authentication"

if [[ -n "${SKIP_NETWORK:-}" ]]; then
    warn "GitHub auth check skipped (SKIP_NETWORK=1)"
elif [[ -z "${GH_TOKEN:-}" ]]; then
    warn "GH_TOKEN not set — gh auth check skipped (set in VS Code User Settings)"
else
    if gh auth status &>/dev/null; then
        pass "gh auth status" "authenticated"
    else
        fail "gh auth status" "GH_TOKEN present but auth failed"
    fi
fi

# ─── PATH sanity ─────────────────────────────────────────────────────────────

section "PATH sanity"

case ":$PATH:" in
    *":/go/bin:"*)    pass "/go/bin in PATH" ;;
    *)                warn "/go/bin not in PATH" ;;
esac

case ":$PATH:" in
    *":$HOME/.local/bin:"*) pass "~/.local/bin in PATH" ;;
    *)                      warn "~/.local/bin not in PATH" ;;
esac

# ─── Summary ─────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + WARN))
printf "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
if [[ $FAIL -eq 0 && $WARN -eq 0 ]]; then
    printf " ✅ All %d checks passed\n" "$PASS"
elif [[ $FAIL -eq 0 ]]; then
    printf " ⚠️  %d/%d passed, %d warnings, 0 failures\n" "$PASS" "$TOTAL" "$WARN"
else
    printf " ❌ %d/%d passed, %d warnings, %d FAILURES:\n" "$PASS" "$TOTAL" "$WARN" "$FAIL"
    for f in "${FAILURES[@]}"; do
        printf "      - %s\n" "$f"
    done
fi
printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

exit $FAIL
