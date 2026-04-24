#!/usr/bin/env bash
# Session Telemetry: Merged session-start hook (governance audit + session logger)
# Env precedence: SKIP_SESSION_TELEMETRY disables everything (umbrella).
# If unset, SKIP_GOVERNANCE_AUDIT and SKIP_LOGGING work independently.
# The systemMessage is always emitted unless SKIP_SESSION_TELEMETRY is set.

set -euo pipefail

# Umbrella kill switch
if [[ "${SKIP_SESSION_TELEMETRY:-}" == "true" ]]; then
  exit 0
fi

INPUT=$(cat)

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)
LEVEL="${GOVERNANCE_LEVEL:-standard}"

# ── Governance log ──
if [[ "${SKIP_GOVERNANCE_AUDIT:-}" != "true" ]]; then
  mkdir -p logs/copilot/governance
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
fi

# ── Session log ──
if [[ "${SKIP_LOGGING:-}" != "true" ]]; then
  mkdir -p logs/copilot
  if command -v jq &>/dev/null; then
    jq -Rn --arg timestamp "$TIMESTAMP" --arg cwd "$CWD" \
      '{"timestamp":$timestamp,"event":"sessionStart","cwd":$cwd}' >> logs/copilot/session.log
  else
    echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"sessionStart\",\"cwd\":\"$CWD\"}" >> logs/copilot/session.log
  fi
fi

# ── Context injection (always, unless umbrella skip) ──
CONTEXT_PARTS=()

# Last completed workflow step from session state
SESSION_STATE=$(find agent-output -maxdepth 2 -name '00-session-state.json' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2- || true)
if [[ -n "$SESSION_STATE" && -f "$SESSION_STATE" ]]; then
  STEP_INFO=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
step = data.get('current_step', 'N/A')
steps = data.get('steps', {})
name = steps.get(str(step), {}).get('name', '')
print(f'{step} ({name})' if name else str(step))
" "$SESSION_STATE" 2>/dev/null || echo "N/A")
  CONTEXT_PARTS+=("Step: ${STEP_INFO}")
else
  CONTEXT_PARTS+=("Step: N/A")
fi

# Azure subscription
if command -v az >/dev/null 2>&1; then
  SUB_NAME=$(az account show --query name -o tsv 2>/dev/null || echo "")
  if [[ -n "$SUB_NAME" ]]; then
    CONTEXT_PARTS+=("Subscription: ${SUB_NAME}")
    CONTEXT_PARTS+=("Auth: authenticated")
  else
    CONTEXT_PARTS+=("Subscription: N/A")
    CONTEXT_PARTS+=("Auth: not authenticated")
  fi
else
  CONTEXT_PARTS+=("Subscription: N/A")
  CONTEXT_PARTS+=("Auth: az CLI not available")
fi

# Git branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
CONTEXT_PARTS+=("Branch: ${BRANCH}")

# Build system message
CONTEXT_MSG=$(IFS=" | "; echo "Session context: ${CONTEXT_PARTS[*]}")

# Output JSON safely (prevents injection via subscription names)
python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({'continue': True, 'systemMessage': msg}))
" "$CONTEXT_MSG" 2>/dev/null || echo '{"continue": true}'
