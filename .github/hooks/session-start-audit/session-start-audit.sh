#!/usr/bin/env bash
# session-start-audit.sh
# SessionStart hook: logs new agent sessions for audit.
# Receives JSON input via stdin; outputs JSON to stdout.
set -euo pipefail

INPUT=$(cat)

LOG_DIR="${HOME}/.copilot-audit"
mkdir -p "$LOG_DIR"

SESSION_INFO=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps({
    'timestamp': data.get('timestamp', 'unknown'),
    'sessionId': data.get('sessionId', 'unknown'),
    'cwd': data.get('cwd', 'unknown')
}))
" 2>/dev/null || echo '{"timestamp":"unknown","sessionId":"unknown","cwd":"unknown"}')

LOG_FILE="${LOG_DIR}/sessions.jsonl"
echo "$SESSION_INFO" >> "$LOG_FILE"

echo '{"continue": true}'
