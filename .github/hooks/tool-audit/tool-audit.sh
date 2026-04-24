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

# Support both camelCase (toolName) and snake_case (tool_name) field shapes;
# use python3 json.dumps for safe JSONL output (prevents log injection).
python3 -c "
import sys, json
d = json.load(sys.stdin)
tool = d.get('tool_name') or d.get('toolName') or 'unknown'
result = d.get('tool_result') if isinstance(d.get('tool_result'), dict) else d.get('toolResult', {})
result = result if isinstance(result, dict) else {}
status = 'success' if result.get('success', True) else 'failure'
entry = {'timestamp': '$TIMESTAMP', 'tool_name': tool, 'status': status}
with open('logs/copilot/tool-audit.log', 'a') as f:
    f.write(json.dumps(entry) + chr(10))
" <<< "$INPUT" 2>/dev/null || echo "{\"timestamp\":\"$TIMESTAMP\",\"tool_name\":\"unknown\",\"status\":\"unknown\"}" >> logs/copilot/tool-audit.log

echo '{"continue": true}'
