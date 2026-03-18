#!/usr/bin/env bash
# block-dangerous-commands.sh
# PreToolUse hook: blocks dangerous terminal commands and file edits to protected paths.
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")

# ── Self-modification protection: block edits to hook scripts ──
case "$TOOL_NAME" in
  replace_string_in_file|multi_replace_string_in_file|create_file|editFiles)
    FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ti = data.get('tool_input', {})
print(ti.get('filePath', ti.get('path', '')))
" 2>/dev/null || echo "")
    if [[ -n "$FILE_PATH" ]]; then
      RESOLVED=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
      if [[ "$RESOLVED" == *".github/hooks"* ]]; then
        echo '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "BLOCKED: hook self-modification prevented. Files under .github/hooks/ cannot be edited by agents."}}'
        exit 0
      fi
    fi
    echo '{"continue": true}'
    exit 0
    ;;
esac

# ── Terminal command checks ──
if [[ "$TOOL_NAME" != "run_in_terminal" ]]; then
  echo '{"continue": true}'
  exit 0
fi

COMMAND=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ti = data.get('tool_input', {})
print(ti.get('command', ti.get('input', '')))
" 2>/dev/null || echo "")

if [[ -z "$COMMAND" ]]; then
  echo '{"continue": true}'
  exit 0
fi

LOWER_CMD=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# ── Hard-deny patterns (regex) ──
BLOCKED_REGEX_PATTERNS=(
  'rm\s+-rf\s+[/~.*]'
  'git\s+push\s+(-f|--force)'
  'git\s+reset\s+--hard'
  'terraform\s+destroy'
  'terraform\s+apply\s+.*-auto-approve'
  'az\s+group\s+delete'
  'az\s+deployment\s+sub\s+delete'
  'drop\s+table'
  'drop\s+database'
  'mkfs\.'
  'dd\s+if='
  ':\(\)\{.*:\|:.*\};:'
  '--no-verify'
  'chmod\s+777'
  'curl\s.*\|.*(bash|sh|zsh)'
  'wget\s.*\|.*(bash|sh|zsh)'
  'source\s+<\('
  'eval\s+"\$\(curl'
  'python.*-c.*(urllib|requests).*http'
  'node.*-e.*http'
)

for pattern in "${BLOCKED_REGEX_PATTERNS[@]}"; do
  if echo "$LOWER_CMD" | grep -qiE -- "$pattern"; then
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"deny\", \"permissionDecisionReason\": \"BLOCKED by security hook: command matches dangerous pattern. Use the terminal manually if this is intentional.\"}}"
    exit 0
  fi
done

# ── Ask-confirmation patterns (borderline destructive) ──
ASK_PATTERNS=(
  'az\s+resource\s+delete'
  'terraform\s+plan\s+.*-destroy'
)

for pattern in "${ASK_PATTERNS[@]}"; do
  if echo "$LOWER_CMD" | grep -qiE -- "$pattern"; then
    echo "{\"hookSpecificOutput\": {\"hookEventName\": \"PreToolUse\", \"permissionDecision\": \"ask\", \"permissionDecisionReason\": \"Destructive operation detected. Please confirm you want to proceed.\"}}"
    exit 0
  fi
done

echo '{"continue": true}'
