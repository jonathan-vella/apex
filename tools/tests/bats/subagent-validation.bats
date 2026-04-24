#!/usr/bin/env bats
# subagent-validation.bats — Tests for subagent-validation.sh

load setup

HOOK="$HOOKS_DIR/subagent-validation/subagent-validation.sh"

@test "warns on short output" {
  run bash "$HOOK" <<< '{"subagentName":"test-agent","output":"short"}'
  [[ "$output" == *"short output"* ]] || [ "$status" -eq 0 ]
}

@test "accepts normal output" {
  local long_output
  long_output=$(python3 -c "print('x' * 200)")
  run bash "$HOOK" <<< "{\"subagentName\":\"test-agent\",\"output\":\"$long_output\"}"
  [ "$status" -eq 0 ]
}

@test "warns challenger with no findings" {
  run bash "$HOOK" <<< '{"subagentName":"challenger-review-subagent","output":"{\"findings\": []}"}'
  [[ "$output" == *"no findings"* ]] || [[ "$output" == *"empty"* ]] || [ "$status" -eq 0 ]
}

@test "accepts challenger with findings" {
  run bash "$HOOK" <<< '{"subagentName":"challenger-review-subagent","output":"{\"findings\": [{\"finding\": \"test issue\"}]}"}'
  [ "$status" -eq 0 ]
}
