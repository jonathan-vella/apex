#!/usr/bin/env bash
# Session Logger: Log session start event with project context injection
# Adapted from: https://github.com/github/awesome-copilot/tree/main/hooks/session-logger
# Merged with project context injection from session-start-audit

set -euo pipefail

# Skip if logging disabled
if [[ "${SKIP_LOGGING:-}" == "true" ]]; then
  exit 0
fi

# Read input from Copilot
INPUT=$(cat)

# Create logs directory if it doesn't exist
LOG_DIR="logs/copilot"
mkdir -p "$LOG_DIR"

# Extract timestamp and session info
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CWD=$(pwd)

# Log session start (use jq for proper JSON encoding)
if command -v jq &>/dev/null; then
  jq -Rn --arg timestamp "$TIMESTAMP" --arg cwd "$CWD" \
    '{"timestamp":$timestamp,"event":"sessionStart","cwd":$cwd}' >> "$LOG_DIR/session.log"
else
  echo "{\"timestamp\":\"$TIMESTAMP\",\"event\":\"sessionStart\",\"cwd\":\"$CWD\"}" >> "$LOG_DIR/session.log"
fi

# ── Project context injection ──
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
