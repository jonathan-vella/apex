#!/usr/bin/env bash
# Governance Audit: Log session start with governance context
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/governance-audit

set -euo pipefail

if [[ "${SKIP_GOVERNANCE_AUDIT:-}" == "true" ]]; then
  exit 0
fi

INPUT=$(cat)

mkdir -p logs/copilot/governance

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)
LEVEL="${GOVERNANCE_LEVEL:-standard}"

if command -v jq &>/dev/null; then
  jq -Rn \
    --arg timestamp "$TIMESTAMP" \
    --arg cwd "$CWD" \
    --arg level "$LEVEL" \
    '{"timestamp":$timestamp,"event":"session_start","governance_level":$level,"cwd":$cwd}' \
    >> logs/copilot/governance/audit.log
else
  echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"session_start\",\"governance_level\":\"$LEVEL\",\"cwd\":\"$CWD\"}" \
    >> logs/copilot/governance/audit.log
fi

echo "🛡️ Governance audit active (level: $LEVEL)"
exit 0
