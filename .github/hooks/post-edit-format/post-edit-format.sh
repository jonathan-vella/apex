#!/usr/bin/env bash
# post-edit-format.sh
# PostToolUse hook: auto-formats edited files based on extension.
# - .md files → markdownlint
# - .bicep files → bicep lint
# - .tf files → terraform fmt
# - .js/.mjs/.cjs files → prettier
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
set -euo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")

case "$TOOL_NAME" in
  replace_string_in_file|multi_replace_string_in_file|create_file|editFiles)
    ;;
  *)
    echo '{"continue": true}'
    exit 0
    ;;
esac

FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
ti = data.get('tool_input', {})
print(ti.get('filePath', ti.get('path', '')))
" 2>/dev/null || echo "")

if [[ -z "$FILE_PATH" ]]; then
  echo '{"continue": true}'
  exit 0
fi

# Validate file path is within repository boundary
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -n "$REPO_ROOT" && -n "$FILE_PATH" ]]; then
  RESOLVED_PATH=$(realpath "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
  if [[ "$RESOLVED_PATH" != "$REPO_ROOT"/* ]]; then
    echo '{"continue": true}'
    exit 0
  fi
fi

# Skip files larger than 1MB to avoid slow formatting
if [[ -f "$FILE_PATH" ]]; then
  FILE_SIZE=$(stat -c%s "$FILE_PATH" 2>/dev/null || echo "0")
  if [[ "$FILE_SIZE" -gt 1048576 ]]; then
    echo "{\"continue\": true, \"systemMessage\": \"Skipped formatting ${FILE_PATH} (file exceeds 1MB).\"}"
    exit 0
  fi
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
  *.bicep)
    if command -v bicep >/dev/null 2>&1; then
      LINT_OUTPUT=$(bicep lint "$FILE_PATH" 2>&1) || true
      if [[ -z "$LINT_OUTPUT" ]] || echo "$LINT_OUTPUT" | grep -q "^$"; then
        echo '{"continue": true}'
      else
        echo "{\"continue\": true, \"systemMessage\": \"bicep lint found issues in ${FILE_PATH}. Consider fixing them.\"}"
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
  *.js|*.mjs|*.cjs)
    if command -v npx >/dev/null 2>&1; then
      npx prettier --write "$FILE_PATH" >/dev/null 2>&1 || true
      echo "{\"continue\": true, \"systemMessage\": \"prettier applied to ${FILE_PATH}.\"}"
    else
      echo '{"continue": true}'
    fi
    ;;
  *)
    echo '{"continue": true}'
    ;;
esac
