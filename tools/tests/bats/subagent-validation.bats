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

@test "SDK response accepts Challenger file-contract receipt without inline JSON" {
  run bash "$HOOK" <<< '{"agentName":"challenger-review-subagent","agentId":"probe","agentType":"custom","stopReason":"end_turn","response":"CHALLENGE COMPLETE\nfile_path: agent-output/fixture/challenge-findings-plan.json\noverall_assessment: APPROVED\nmust_fix_count: 0"}'
  [ "$status" -eq 0 ]
  assert_json_valid "$output"
  [[ "$output" != *"Warning"* ]]
}

@test "SDK Challenger receipt without a file is not approval-shaped" {
  run bash "$HOOK" <<< '{"agentName":"challenger-review-subagent","response":"CHALLENGE COMPLETE\noverall_assessment: APPROVED"}'
  [[ "$output" == *"Warning"* ]]
}

@test "SDK agentType fallback and validation response are inspected" {
  run bash "$HOOK" <<< '{"agentType":"terraform-validate-subagent","response":"No validation verdict was produced."}'
  [[ "$output" == *"Warning"* ]]
}

@test "SDK empty response does not use a stale legacy output" {
  run bash "$HOOK" <<< '{"agentName":"challenger-review-subagent","response":"","output":"{\"findings\":[{}]}"}'
  [[ "$output" == *"Warning"* ]]
}

@test "non-string SDK response emits an advisory instead of a parser failure" {
  run bash "$HOOK" <<< '{"agentName":"challenger-review-subagent","response":{"findings":[]}}'
  [ "$status" -eq 0 ]
  assert_json_valid "$output"
  [[ "$output" == *"Warning"* ]]
}

@test "SDK warning preserves the original response and uses the native output contract" {
  run bash "$HOOK" <<< '{"agentName":"terraform-validate-subagent","response":"original worker response"}'
  python3 -c 'import json,sys; d=json.loads(sys.argv[1]); assert d["decision"] == "allow"; assert d["modifiedResponse"].startswith("original worker response"); assert "systemMessage" not in d; assert "continue" not in d' "$output"
}

@test "tool-free readiness and pending input are not mistaken for completed reviews" {
  for response in 'WORKER_READY challenger-review-subagent nonce' 'WORKER_READY_ACK challenger-review-subagent nonce' 'USER_INPUT_REQUIRED request'; do
    run bash "$HOOK" <<< "{\"agentName\":\"challenger-review-subagent\",\"response\":\"$response\"}"
    [[ "$output" != *"Warning"* ]]
    [[ "$output" == *'"decision": "allow"'* ]]
  done
}
