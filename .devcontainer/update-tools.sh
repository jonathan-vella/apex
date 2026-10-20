#!/bin/bash
set -e

echo "🔄 Updating development tools..."
echo ""

# Track failures
FAILURES=()

# Update Azure CLI
echo "📦 Checking Azure CLI..."
CURRENT_AZ=$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "unknown")
echo "   ℹ️  Current version: $CURRENT_AZ (managed by devcontainer feature, auto-upgrade disabled)"

# Standalone Bicep shares the verified build manifest with the other native tools.
echo "📦 Native CLI versions are pinned in download-checksums.json; review pins and rebuild to update."

# Update Python packages
echo "📦 Updating Python packages..."
if command -v uv &>/dev/null; then
    if uv pip install --python /usr/local/python/current/bin/python3 --quiet --requirement requirements.txt; then
        echo "   ✅ Pinned Python requirements restored"
    else
        echo "   ⚠️  Python package updates had issues"
        FAILURES+=("Python packages")
    fi
else
    if pip3 install --quiet --requirement requirements.txt 2>/dev/null; then
        echo "   ✅ Pinned Python requirements restored"
    else
        echo "   ⚠️  Python package updates had issues"
        FAILURES+=("Python packages")
    fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ ${#FAILURES[@]} -eq 0 ]; then
    echo "✅ All tool updates completed successfully!"
else
    echo "⚠️  Updates completed with some issues:"
    for fail in "${FAILURES[@]}"; do
        echo "   - $fail"
    done
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Show current versions
echo "📊 Current tool versions:"
printf "   %-15s %s\n" "Azure CLI:" "$(az version --query '\"azure-cli\"' -o tsv 2>/dev/null || echo 'unknown')"
printf "   %-15s %s\n" "Bicep:" "$(az bicep version 2>/dev/null || echo 'unknown')"
printf "   %-15s %s\n" "markdownlint:" "$(./node_modules/.bin/markdownlint-cli2 --version 2>/dev/null | head -n1 || echo 'unknown')"
echo ""
