#!/usr/bin/env bash
# subagent-validation.sh
# SubagentStop hook: validates subagent output quality (advisory only).
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
set -euo pipefail

INPUT=$(cat)

SUBAGENT_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('subagentName',''))" 2>/dev/null || echo "")
SUBAGENT_OUTPUT=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('output',''))" 2>/dev/null || echo "")

OUTPUT_LEN=${#SUBAGENT_OUTPUT}

# Helper: safe JSON output using Python json.dumps (prevents injection via subagent names)
safe_warn() {
  local msg="$1"
  python3 -c "
import json, sys
print(json.dumps({'continue': True, 'systemMessage': sys.argv[1]}))
" "$msg" 2>/dev/null || echo '{"continue": true}'
}

# Validate challenger subagent output structure (check before generic length)
if echo "$SUBAGENT_NAME" | grep -qi "challenger"; then
  VALID_JSON=$(echo "$SUBAGENT_OUTPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    findings = data.get('findings', [])
    if isinstance(findings, list) and len(findings) >= 1:
        print('valid')
    else:
        print('missing_findings')
except (json.JSONDecodeError, ValueError):
    print('invalid_json')
" 2>/dev/null || echo "parse_error")

  case "$VALID_JSON" in
    valid)
      echo '{"continue": true}'
      ;;
    missing_findings)
      safe_warn "Warning: challenger subagent '${SUBAGENT_NAME}' output has no findings array or it is empty. Verify review quality."
      ;;
    *)
      safe_warn "Warning: challenger subagent '${SUBAGENT_NAME}' output is not valid JSON. Expected structured findings."
      ;;
  esac
  exit 0
fi

# Validate codegen/lint subagent produced non-empty output
if echo "$SUBAGENT_NAME" | grep -qiE "(codegen|lint)"; then
  if [[ "$OUTPUT_LEN" -eq 0 ]]; then
    safe_warn "Warning: subagent '${SUBAGENT_NAME}' produced empty output. Check for errors."
    exit 0
  fi
fi

# Generic: warn if output is suspiciously short
if [[ "$OUTPUT_LEN" -lt 100 && "$OUTPUT_LEN" -gt 0 ]]; then
  safe_warn "Warning: subagent '${SUBAGENT_NAME}' produced short output (${OUTPUT_LEN} chars). Verify output quality."
  exit 0
fi

echo '{"continue": true}'
