#!/bin/bash
# Runs on every container start (postStartCommand).
# Keeps fast-moving tools current without a full rebuild.
# Heavy installs (PowerShell modules, system packages) stay in post-create.sh.

set -e
START=$(date +%s)

printf "\n ♻️  Updating lightweight tools...\n"

# ─── Fix hook script permissions (core.fileMode=false loses execute bits) ────
if [ -d .github/hooks ]; then
    find .github/hooks -name '*.sh' -exec chmod +x {} +
    printf "    hook script perms     ✅ fixed\n"
fi

# ─── Terraform MCP Server ────────────────────────────────────────────────────
# Uses clone+build: go install rejects modules with replace directives in go.mod.
if command -v terraform-mcp-server &>/dev/null || [ -x /go/bin/terraform-mcp-server ]; then
    printf "    terraform-mcp-server  ✅ already installed — skipping\n"
elif command -v go &>/dev/null; then
    printf "    terraform-mcp-server  "
    TF_MCP_TMP=$(mktemp -d)
    if git clone --depth=1 --quiet https://github.com/hashicorp/terraform-mcp-server.git "$TF_MCP_TMP" 2>/dev/null; then
        pushd "$TF_MCP_TMP" > /dev/null
        go build -o /go/bin/terraform-mcp-server ./cmd/terraform-mcp-server/ 2>/dev/null \
            && printf "✅ installed\n" \
            || printf "⚠️  build failed (continuing)\n"
        popd > /dev/null
    else
        printf "⚠️  git clone failed (continuing)\n"
    fi
    rm -rf "$TF_MCP_TMP"
else
    printf "    terraform-mcp-server  ⚠️  Go not found — skipping\n"
fi

# ─── Deno ─────────────────────────────────────────────────────────────────────
# Deno is upgraded automatically on container rebuild via the devcontainer
# feature (version: latest). No in-container upgrade needed.
if command -v deno &>/dev/null; then
    printf "    deno                  ✅ %s\n" "$(deno --version 2>/dev/null | head -n1)"
else
    printf "    deno                  ⚠️  not installed — rebuild container\n"
fi

# ─── Azure Pricing MCP ───────────────────────────────────────────────────────
MCP_DIR="${WORKSPACE_FOLDER:-$PWD}/mcp/azure-pricing-mcp"
if [ -f "$MCP_DIR/.venv/bin/pip" ]; then
    "$MCP_DIR/.venv/bin/pip" install --quiet --upgrade pip 2>/dev/null || true
    printf "    azure-pricing-mcp     "
    "$MCP_DIR/.venv/bin/pip" install --quiet -e "$MCP_DIR[azure]" \
        && printf "✅ updated\n" \
        || printf "⚠️  update failed (continuing)\n"
fi

# ─── npm local dependencies ──────────────────────────────────────────────────
printf "    npm local deps        "
npm install --loglevel=error 2>&1 | tail -1 \
    && printf "✅ ok\n" \
    || printf "⚠️  npm install failed (continuing)\n"

# ─── Azure Developer CLI (azd) auth check ────────────────────────────────────
if command -v azd &>/dev/null; then
    printf "    azd auth              "
    if azd auth token --output json &>/dev/null; then
        printf "✅ authenticated\n"
    else
        printf "⚠️  not authenticated — run 'azd auth login'\n"
    fi
else
    printf "    azd                   ⚠️  not installed — rebuild container\n"
fi

# ─── Python tools via uv ─────────────────────────────────────────────────────
UV_BIN=$(command -v uv 2>/dev/null || echo "${HOME}/.local/bin/uv")
if [ -x "$UV_BIN" ]; then
    printf "    python packages      "
    "$UV_BIN" pip install --system --quiet --upgrade checkov ruff diagrams matplotlib pillow 2>&1 \
        && printf "✅ updated\n" \
        || printf "⚠️  update failed (continuing)\n"
else
    printf "    python packages      ⚠️  uv not found — skipping\n"
fi

ELAPSED=$(( $(date +%s) - START ))
printf " ✅ Tool refresh complete (%ds)\n\n" "$ELAPSED"
