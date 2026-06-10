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

@test "accepts validate-subagent with a verdict" {
  run bash "$HOOK" <<< '{"subagentName":"bicep-validate-subagent","output":"Lint PASS. Verdict: APPROVED. All AVM checks green and naming compliant."}'
  [ "$status" -eq 0 ]
  [[ "$output" != *"Warning"* ]]
}

@test "warns validate-subagent missing a verdict" {
  run bash "$HOOK" <<< '{"subagentName":"terraform-validate-subagent","output":"I reviewed the configuration and it generally looks fine to me overall here."}'
  [ "$status" -eq 0 ]
  [[ "$output" == *"verdict"* ]] || [[ "$output" == *"Warning"* ]]
}

# The verdict requirement is scoped to the *-validate-subagent family: a name
# that merely contains "validate" must not trigger the verdict warning.
@test "non-validator name containing 'validate' is not warned for a verdict" {
  long=$(python3 -c "print('x' * 150)")
  run bash "$HOOK" <<< "{\"subagentName\":\"validated-output-agent\",\"output\":\"$long\"}"
  [ "$status" -eq 0 ]
  [[ "$output" != *"verdict"* ]]
}

