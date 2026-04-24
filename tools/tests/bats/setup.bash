#!/usr/bin/env bash
# setup.bash — Common helpers for bats hook tests

HOOKS_DIR="${BATS_TEST_DIRNAME}/../../../.github/hooks"
REPO_ROOT="${BATS_TEST_DIRNAME}/../../.."

# Create temp log dirs for each test
setup() {
  export TEST_LOG_DIR=$(mktemp -d)
  export SKIP_SESSION_TELEMETRY=""
  export SKIP_GOVERNANCE_AUDIT=""
  export SKIP_LOGGING=""
  export BLOCK_ON_THREAT=""
  export GOVERNANCE_LEVEL="standard"
}

teardown() {
  rm -rf "$TEST_LOG_DIR"
}

# Validate output is parseable JSON
assert_json_valid() {
  local output="$1"
  echo "$output" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null
}

# Build mock JSON for hook stdin
mock_session_start() {
  echo '{"timestamp":"2026-01-01T00:00:00Z","sessionId":"test-001","cwd":"/workspace","source":"copilot"}'
}

mock_prompt() {
  local msg="${1:-deploy a web app to Azure}"
  python3 -c "import json, sys; print(json.dumps({'userMessage': sys.argv[1]}))" "$msg"
}

mock_session_end() {
  echo '{"sessionId":"test-001"}'
}

mock_tool_use() {
  local tool="${1:-run_in_terminal}"
  local input="${2:-ls -la}"
  python3 -c "import json, sys; print(json.dumps({'toolName': sys.argv[1], 'toolInput': sys.argv[2]}))" "$tool" "$input"
}
