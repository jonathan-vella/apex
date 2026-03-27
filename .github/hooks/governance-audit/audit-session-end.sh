#!/usr/bin/env bash
# Governance Audit: Log session end with summary statistics
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/governance-audit

set -euo pipefail

if [[ "${SKIP_GOVERNANCE_AUDIT:-}" == "true" ]]; then
  exit 0
fi

INPUT=$(cat)

mkdir -p logs/copilot/governance

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="logs/copilot/governance/audit.log"

# Count events from this session
TOTAL=0
THREATS=0
SESSION_START=""
if [[ -f "$LOG_FILE" ]]; then
  # Find the last session_start event to scope stats to current session
  if command -v jq &>/dev/null; then
    SESSION_START=$(grep '"session_start"' "$LOG_FILE" 2>/dev/null | tail -1 | jq -r '.timestamp' 2>/dev/null || true)
  fi
  if [[ -n "$SESSION_START" ]]; then
    TOTAL=$(awk -v start="$SESSION_START" -F'"timestamp":"' '{split($2,a,"\""); if(a[1]>=start) count++} END{print count+0}' "$LOG_FILE" 2>/dev/null || echo "0")
    THREATS=$(awk -v start="$SESSION_START" -F'"timestamp":"' '{split($2,a,"\""); if(a[1]>=start && /threat_detected/) count++} END{print count+0}' "$LOG_FILE" 2>/dev/null || echo "0")
  else
    TOTAL=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
    THREATS=$(grep -c '"threat_detected"' "$LOG_FILE" 2>/dev/null || true)
    THREATS="${THREATS:-0}"
  fi
fi
# Ensure numeric values
TOTAL="${TOTAL:-0}"
THREATS="${THREATS:-0}"

if command -v jq &>/dev/null; then
  jq -Rn \
    --arg timestamp "$TIMESTAMP" \
    --argjson total "$TOTAL" \
    --argjson threats "$THREATS" \
    '{"timestamp":$timestamp,"event":"session_end","total_events":$total,"threats_detected":$threats}' \
    >> "$LOG_FILE"
else
  echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"session_end\",\"total_events\":$TOTAL,\"threats_detected\":$THREATS}" \
    >> "$LOG_FILE"
fi

if [[ "$THREATS" -gt 0 ]]; then
  echo "⚠️ Session ended: $THREATS threat(s) detected in $TOTAL events"
else
  echo "✅ Session ended: $TOTAL events, no threats"
fi

exit 0
