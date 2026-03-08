#!/usr/bin/env bash
# block-dangerous-commands.sh
# PreToolUse hook: blocks dangerous terminal commands before execution.
# Receives JSON input via stdin; outputs JSON to stdout.
set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('toolName',''))" 2>/dev/null || echo "")

if [[ "$TOOL_NAME" != "terminalCommand" ]]; then
  echo '{"continue": true}'
  exit 0
fi

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ti = data.get('toolInput', {})
print(ti.get('command', ti.get('input', '')))
" 2>/dev/null || echo "")

if [[ -z "$COMMAND" ]]; then
  echo '{"continue": true}'
  exit 0
fi

BLOCKED_PATTERNS=(
  'rm -rf /'
  'rm -rf ~'
  'rm -rf \.'
  'rm -rf \*'
  'git push --force'
  'git push -f '
  'git reset --hard'
  'terraform destroy'
  'terraform apply -auto-approve'
  'az group delete'
  'az deployment sub delete'
  'DROP TABLE'
  'DROP DATABASE'
  'mkfs\.'
  'dd if='
  ':(){:|:&};:'
)

LOWER_CMD=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  LOWER_PATTERN=$(echo "$pattern" | tr '[:upper:]' '[:lower:]')
  if echo "$LOWER_CMD" | grep -qF "$LOWER_PATTERN"; then
    echo "{\"continue\": false, \"stopReason\": \"BLOCKED by security hook: command matches dangerous pattern '${pattern}'. Use the terminal manually if this is intentional.\"}"
    exit 0
  fi
done

echo '{"continue": true}'
