<!-- ref:challenger-selection-v1 -->

# Challenger Subagent Selection Rules

Selection rules for adversarial review passes in CodeGen agents (06b/06t).

> **Convention**: Agent `agents:` arrays list the `challenger-review-subagent`.
> All passes use the same subagent. The routing table below
> determines which lens runs each pass.

## Pass Routing Table

Model is determined by the `challenger-review-subagent` frontmatter (source of truth).

| Pass                 | Subagent                     | Lens                     | Condition                                                             |
| -------------------- | ---------------------------- | ------------------------ | --------------------------------------------------------------------- |
| 1                    | `challenger-review-subagent` | security-governance      | Always required for all complexities                                  |
| 2                    | `challenger-review-subagent` | architecture-reliability | Skip if pass 1 has 0 must_fix AND <2 should_fix                       |
| 3                    | `challenger-review-subagent` | cost-feasibility         | Skip if pass 2 has 0 must_fix                                         |
| Batch (complex only) | `challenger-review-subagent` | passes 2+3 combined      | Use instead of separate pass 2+3 for complex projects to save context |

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
