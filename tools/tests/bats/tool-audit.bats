#!/usr/bin/env bats
# tool-audit.bats — Tests for tool-audit.sh

load setup

HOOK="$HOOKS_DIR/tool-audit/tool-audit.sh"

@test "logs tool usage and returns continue" {
  run bash "$HOOK" <<< '{"toolName":"read_file","toolResult":{"success":true}}'
  [ "$status" -eq 0 ]
  [[ "$output" == *'"continue"'* ]]
}

@test "handles empty stdin gracefully" {
  run bash "$HOOK" <<< ""
  [ "$status" -eq 0 ]
  [[ "$output" == *'"continue"'* ]]
}

@test "handles invalid JSON stdin" {
  run bash "$HOOK" <<< "not-json"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"continue"'* ]]
}
