#!/usr/bin/env bash
# test-hooks.sh — Thin wrapper that runs bats hook tests.
# Usage: bash tools/tests/test-hooks.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v bats &>/dev/null; then
  echo "❌ bats not installed. Run: sudo apt-get install -y bats"
  exit 1
fi

echo "🧪 Running agent hook tests (bats)..."
echo ""

bats "$SCRIPT_DIR/bats/"

echo ""
echo "✅ All hook tests completed"
