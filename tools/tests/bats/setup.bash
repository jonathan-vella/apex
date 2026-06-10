#!/usr/bin/env bash
# setup.bash — Common helpers for bats hook tests

HOOKS_DIR="${BATS_TEST_DIRNAME}/../../../.github/hooks"
REPO_ROOT="${BATS_TEST_DIRNAME}/../../.."

# Create a temp log dir for each test
setup() {
  export TEST_LOG_DIR=$(mktemp -d)
}

teardown() {
  rm -rf "$TEST_LOG_DIR"
}

# Validate output is parseable JSON
assert_json_valid() {
  local output="$1"
  echo "$output" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null
}

# Build mock JSON for a tool invocation (PreToolUse / PostToolUse stdin)
mock_tool_use() {
  local tool="${1:-run_in_terminal}"
  local input="${2:-ls -la}"
  python3 -c "import json, sys; print(json.dumps({'toolName': sys.argv[1], 'toolInput': sys.argv[2]}))" "$tool" "$input"
}
