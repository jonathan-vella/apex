#!/bin/bash
# Runs on every container start (postStartCommand).
# Keeps fast-moving tools current without a full rebuild.
# Heavy installs (PowerShell modules, system packages) stay in post-create.sh.

set -e
START=$(date +%s)

printf "\n ♻️  Updating lightweight tools...\n"

# ─── Terraform MCP Server ────────────────────────────────────────────────────
if command -v go &>/dev/null; then
    printf "    terraform-mcp-server  "
    go install github.com/hashicorp/terraform-mcp-server/cmd/terraform-mcp-server@latest 2>&1 \
        && printf "✅ updated\n" \
        || printf "⚠️  update failed (continuing)\n"
else
    printf "    terraform-mcp-server  ⚠️  Go not found — skipping\n"
fi

# ─── Azure Pricing MCP ───────────────────────────────────────────────────────
MCP_DIR="${WORKSPACE_FOLDER:-$PWD}/mcp/azure-pricing-mcp"
if [ -f "$MCP_DIR/.venv/bin/pip" ]; then
    printf "    azure-pricing-mcp     "
    "$MCP_DIR/.venv/bin/pip" install --quiet -e "$MCP_DIR" \
        && printf "✅ updated\n" \
        || printf "⚠️  update failed (continuing)\n"
fi

# ─── npm local dependencies ──────────────────────────────────────────────────
printf "    npm local deps        "
npm install --loglevel=error 2>&1 | tail -1 \
    && printf "✅ ok\n" \
    || printf "⚠️  npm install failed (continuing)\n"

# ─── markdownlint-cli2 ───────────────────────────────────────────────────────
printf "    markdownlint-cli2     "
npm install -g markdownlint-cli2 --loglevel=error 2>&1 | tail -1 \
    && printf "✅ updated\n" \
    || printf "⚠️  update failed (continuing)\n"

# ─── Python tools via uv ─────────────────────────────────────────────────────
if command -v uv &>/dev/null; then
    printf "    checkov/ruff/diagrams  "
    uv pip install --system --quiet --upgrade checkov ruff diagrams 2>&1 \
        && printf "✅ updated\n" \
        || printf "⚠️  update failed (continuing)\n"
else
    printf "    checkov/ruff/diagrams  ⚠️  uv not found — skipping\n"
fi

ELAPSED=$(( $(date +%s) - START ))
printf " ✅ Tool refresh complete (%ds)\n\n" "$ELAPSED"
