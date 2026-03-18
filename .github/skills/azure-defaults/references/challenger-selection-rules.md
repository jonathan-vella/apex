<!-- ref:challenger-selection-v1 -->

# Challenger Subagent Selection Rules

Selection rules for adversarial review passes in CodeGen agents (06b/06t).

## Pass Routing Table

| Pass                 | Subagent                           | Model         | Lens                     | Condition                                                             |
| -------------------- | ---------------------------------- | ------------- | ------------------------ | --------------------------------------------------------------------- |
| 1                    | `challenger-review-subagent`       | GPT-5.4       | security-governance      | Always required for all complexities                                  |
| 2                    | `challenger-review-codex-subagent` | GPT-5.3-Codex | architecture-reliability | Skip if pass 1 has 0 must_fix AND <2 should_fix                       |
| 3                    | `challenger-review-codex-subagent` | GPT-5.3-Codex | cost-feasibility         | Skip if pass 2 has 0 must_fix                                         |
| Batch (complex only) | `challenger-review-batch-subagent` | GPT-5.3-Codex | passes 2+3 combined      | Use instead of separate pass 2+3 for complex projects to save context |

## Conditional Skip Rules

- Skip pass 2 if pass 1 has 0 `must_fix` and <2 `should_fix`
- Skip pass 3 if pass 2 has 0 `must_fix`
- For `simple` complexity: 1 pass only (comprehensive)
- For `standard`: up to 3 passes per review matrix
- For `complex`: use batch subagent for passes 2+3

## Invocation

Set `artifact_type = "iac-code"` and rotate `review_focus` per pass.
Write results to `challenge-findings-iac-code-pass{N}.json`.
Fix any `must_fix` items, re-validate, re-run failing pass.
