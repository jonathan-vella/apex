#!/usr/bin/env bats
# session-telemetry-start.bats — Tests for session-start.sh

load setup

HOOK="$HOOKS_DIR/session-telemetry/session-start.sh"

@test "session-start returns valid JSON" {
  run bash "$HOOK" <<< "$(mock_session_start)"
  assert_json_valid "$output"
}

@test "session-start emits systemMessage" {
  run bash "$HOOK" <<< "$(mock_session_start)"
  [[ "$output" == *"Session context:"* ]]
}

@test "SKIP_SESSION_TELEMETRY skips everything" {
  export SKIP_SESSION_TELEMETRY=true
  run bash "$HOOK" <<< "$(mock_session_start)"
  [ "$status" -eq 0 ]
  [[ -z "$output" ]]
}

@test "SKIP_GOVERNANCE_AUDIT skips governance log but emits systemMessage" {
  export SKIP_GOVERNANCE_AUDIT=true
  run bash "$HOOK" <<< "$(mock_session_start)"
  [[ "$output" == *"Session context:"* ]]
}

@test "SKIP_LOGGING skips session log but emits systemMessage" {
  export SKIP_LOGGING=true
  run bash "$HOOK" <<< "$(mock_session_start)"
  [[ "$output" == *"Session context:"* ]]
}
