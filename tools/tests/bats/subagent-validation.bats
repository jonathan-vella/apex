#!/usr/bin/env bats
# subagent-validation.bats — Tests for subagent-validation.sh

load setup

HOOK="$HOOKS_DIR/subagent-validation/subagent-validation.sh"

@test "warns on short output" {
  run bash "$HOOK" <<< '{"subagentName":"test-agent","output":"short"}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"short output"* ]] || [[ "$output" == *"Warning"* ]]
}

@test "accepts normal output" {
  local long_output
  long_output=$(python3 -c "print('x' * 200)")
  run bash "$HOOK" <<< "{\"subagentName\":\"test-agent\",\"output\":\"$long_output\"}"
  [ "$status" -eq 0 ]
}

@test "warns challenger with no findings" {
  run bash "$HOOK" <<< '{"subagentName":"challenger-review-subagent","output":"{\"findings\": []}"}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"no findings"* ]] || [[ "$output" == *"empty"* ]] || [[ "$output" == *"Warning"* ]]
}

@test "accepts challenger with findings" {
  run bash "$HOOK" <<< '{"subagentName":"challenger-review-subagent","output":"{\"findings\": [{\"finding\": \"test issue\"}]}"}'
  [ "$status" -eq 0 ]
}
