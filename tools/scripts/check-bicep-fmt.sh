#!/usr/bin/env bash
# check-bicep-fmt.sh — CI-friendly Bicep format check across all projects.
#
# Loops every project under infra/bicep/ and runs format-bicep-tree.sh --check
# on it. Exits non-zero if ANY project has formatting drift. It is a clean no-op
# (exit 0) when there are no Bicep projects yet — infra/bicep/ is empty
# scaffolding until an agent generates IaC, so this gate stays silent until then.
#
# Usage: bash tools/scripts/check-bicep-fmt.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BICEP_ROOT="$ROOT/infra/bicep"

if [[ ! -d "$BICEP_ROOT" ]]; then
  echo "ℹ️  infra/bicep/ does not exist — nothing to format-check."
  exit 0
fi

# Collect project directories (those containing at least one .bicep file).
projects=()
while IFS= read -r dir; do
  projects+=("$dir")
done < <(find "$BICEP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)

if [[ ${#projects[@]} -eq 0 ]]; then
  echo "ℹ️  No Bicep projects under infra/bicep/ — nothing to format-check."
  exit 0
fi

if ! command -v bicep >/dev/null 2>&1; then
  echo "❌ 'bicep' CLI not found on PATH but Bicep projects exist." >&2
  echo "   Install with: az bicep install" >&2
  exit 127
fi

drift=0
for dir in "${projects[@]}"; do
  if find "$dir" -type f -name '*.bicep' -print -quit | grep -q .; then
    echo "🔍 Checking $(basename "$dir")..."
    bash "$SCRIPT_DIR/format-bicep-tree.sh" "$dir" --check || drift=1
  fi
done

if [[ "$drift" -ne 0 ]]; then
  echo "" >&2
  echo "❌ Bicep formatting drift detected. Fix with:" >&2
  echo "   bash tools/scripts/format-bicep-tree.sh <project-dir>" >&2
  exit 1
fi

echo "✅ All Bicep projects are formatted."
