#!/usr/bin/env bash
# Tool Audit: Log tool usage metadata after each tool invocation.
# Logs tool_name and success/failure status. Does NOT log duration, input, or output.

set -euo pipefail

mkdir -p logs/copilot

INPUT=$(cat 2>/dev/null || echo "")

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Parse tool_name and status from stdin JSON; fallback on invalid input
if [[ -z "$INPUT" ]] || ! echo "$INPUT" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "{\"timestamp\":\"$TIMESTAMP\",\"tool_name\":\"unknown\",\"error\":\"invalid_stdin\"}" >> logs/copilot/tool-audit.log
  echo '{"continue": true}'
  exit 0
fi

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('toolName','unknown'))" 2>/dev/null || echo "unknown")
STATUS=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('success' if d.get('toolResult',{}).get('success', True) else 'failure')" 2>/dev/null || echo "unknown")

echo "{\"timestamp\":\"$TIMESTAMP\",\"tool_name\":\"$TOOL_NAME\",\"status\":\"$STATUS\"}" >> logs/copilot/tool-audit.log

echo '{"continue": true}'
