#!/usr/bin/env bash
# Session Telemetry: Merged session-end hook (governance audit + session logger)
# Env precedence: SKIP_SESSION_TELEMETRY disables everything.
# SKIP_GOVERNANCE_AUDIT and SKIP_LOGGING work independently when umbrella is unset.

set -euo pipefail

if [[ "${SKIP_SESSION_TELEMETRY:-}" == "true" ]]; then
  exit 0
fi

INPUT=$(cat)

# Infinite-loop prevention: if stop_hook_active is set, return immediately
if command -v jq &>/dev/null; then
  STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
else
  STOP_ACTIVE="false"
  if echo "$INPUT" | grep -q '"stop_hook_active".*true'; then
    STOP_ACTIVE="true"
  fi
fi
if [[ "$STOP_ACTIVE" == "true" ]]; then
  echo '{"continue": true}'
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
LOG_FILE="logs/copilot/governance/audit.log"

# ── Governance: session end stats ──
if [[ "${SKIP_GOVERNANCE_AUDIT:-}" != "true" ]]; then
  mkdir -p logs/copilot/governance

  TOTAL=0
  THREATS=0
  SESSION_START=""
  if [[ -f "$LOG_FILE" ]]; then
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
fi

# ── Session log ──
if [[ "${SKIP_LOGGING:-}" != "true" ]]; then
  mkdir -p logs/copilot
  echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"sessionEnd\"}" >> logs/copilot/session.log
  echo "📝 Session end logged"
fi

exit 0
