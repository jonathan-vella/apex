#!/usr/bin/env bats
# session-telemetry-end.bats — Tests for session-end.sh

load setup

HOOK="$HOOKS_DIR/session-telemetry/session-end.sh"

@test "session-end exits 0" {
  run bash "$HOOK" <<< '{"sessionId":"test-001"}'
  [ "$status" -eq 0 ]
}

@test "SKIP_SESSION_TELEMETRY skips everything" {
  export SKIP_SESSION_TELEMETRY=true
  run bash "$HOOK" <<< '{"sessionId":"test-001"}'
  [ "$status" -eq 0 ]
}

@test "stop_hook_active returns immediately with continue" {
  run bash "$HOOK" <<< '{"sessionId":"test-001","stop_hook_active":true}'
  [ "$status" -eq 0 ]
  [[ "$output" == *'"continue"'* ]]
}

@test "session-end handles missing log file" {
  run bash "$HOOK" <<< '{"sessionId":"test-001"}'
  [ "$status" -eq 0 ]
}
