#!/usr/bin/env bash
# test-git-hooks.sh — Run structural tests for Lefthook Git hooks, not agent runtime hooks.
# Usage: bash tools/tests/test-git-hooks.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v bats &>/dev/null; then
  echo "❌ bats not installed. Run: sudo apt-get install -y bats"
  exit 1
fi

echo "🧪 Running Lefthook Git hook tests (bats)..."
echo ""

bats "$SCRIPT_DIR/bats/lefthook-config.bats"

echo ""
echo "✅ All Git hook tests completed"
