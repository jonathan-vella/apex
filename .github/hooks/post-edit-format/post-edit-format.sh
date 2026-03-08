#!/usr/bin/env bash
# post-edit-format.sh
# PostToolUse hook: auto-formats edited files based on extension.
# - .md files → markdownlint
# - .tf files → terraform fmt
# Receives JSON input via stdin; outputs JSON to stdout.
set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('toolName',''))" 2>/dev/null || echo "")

if [[ "$TOOL_NAME" != "editFiles" && "$TOOL_NAME" != "createFile" ]]; then
  echo '{"continue": true}'
  exit 0
fi

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ti = data.get('toolInput', {})
print(ti.get('filePath', ti.get('path', '')))
" 2>/dev/null || echo "")

if [[ -z "$FILE_PATH" ]]; then
  echo '{"continue": true}'
  exit 0
fi

case "$FILE_PATH" in
  *.md)
    if command -v markdownlint-cli2 >/dev/null 2>&1; then
      if markdownlint-cli2 --no-globs "$FILE_PATH" >/dev/null 2>&1; then
        echo '{"continue": true}'
      else
        echo "{\"continue\": true, \"systemMessage\": \"markdownlint found issues in ${FILE_PATH}. Consider fixing them.\"}"
      fi
    else
      echo '{"continue": true}'
    fi
    ;;
  *.tf)
    if command -v terraform >/dev/null 2>&1; then
      if terraform fmt -check "$FILE_PATH" >/dev/null 2>&1; then
        echo '{"continue": true}'
      else
        terraform fmt "$FILE_PATH" >/dev/null 2>&1 || true
        echo "{\"continue\": true, \"systemMessage\": \"terraform fmt applied to ${FILE_PATH}.\"}"
      fi
    else
      echo '{"continue": true}'
    fi
    ;;
  *)
    echo '{"continue": true}'
    ;;
esac
