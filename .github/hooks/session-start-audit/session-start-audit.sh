#!/usr/bin/env bash
# session-start-audit.sh
# SessionStart hook: logs new agent sessions and injects project context.
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
set -euo pipefail

INPUT=$(cat)

# ── Audit logging ──
LOG_DIR="${HOME}/.copilot-audit"
mkdir -p "$LOG_DIR"

SESSION_INFO=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps({
    'timestamp': data.get('timestamp', 'unknown'),
    'sessionId': data.get('sessionId', 'unknown'),
    'cwd': data.get('cwd', 'unknown'),
    'source': data.get('source', 'unknown')
}))
" 2>/dev/null || echo '{"timestamp":"unknown","sessionId":"unknown","cwd":"unknown","source":"unknown"}')

LOG_FILE="${LOG_DIR}/sessions.jsonl"
echo "$SESSION_INFO" >> "$LOG_FILE"

# ── Project context injection ──
CONTEXT_PARTS=()

# Last completed workflow step from session state (pick most recently modified if multiple exist)
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

# Use Python json.dumps for safe JSON output (prevents injection via subscription names)
python3 -c "
import json, sys
msg = sys.argv[1]
print(json.dumps({'continue': True, 'systemMessage': msg}))
" "$CONTEXT_MSG" 2>/dev/null || echo '{"continue": true}'
