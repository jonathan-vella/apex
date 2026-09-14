<!-- ref:circuit-breaker-v1 -->

# Circuit Breaker — Deploy Safety

Anomaly detection and circuit breaker rules for deploy agents (07b, 07t)
and the Orchestrator.

## Failure Taxonomy

| Category           | Description                                              | Example                              |
| ------------------ | -------------------------------------------------------- | ------------------------------------ |
| `build_error`      | IaC compilation fails (bicep build / terraform validate) | Syntax error in module               |
| `validation_error` | Pre-deploy validation fails                              | What-if shows policy violation       |
| `deployment_error` | Azure deployment fails                                   | Resource creation fails due to quota |
| `empty_response`   | Agent returns no changes or no output                    | Codegen produces empty file          |
| `timeout`          | Operation exceeds expected duration                      | Deployment hangs for >10 minutes     |
| `auth_expired`     | Azure CLI token expires mid-operation                    | `az deployment` returns 401          |

## Anomaly Patterns

| Pattern             | Detection                                     | Threshold |
| ------------------- | --------------------------------------------- | --------- |
| Empty response loop | Agent returns no changes 3+ consecutive times | 3         |
| What-if oscillation | Alternating add/delete of the same resource   | 2 cycles  |
| Timeout cascade     | 3+ consecutive timeouts                       | 3         |
| Error repetition    | Same error message 3+ consecutive times       | 3         |
| Auth failure loop   | Token refresh fails 2+ times                  | 2         |

## Circuit Breaker Rules

**After 3 consecutive failures of the same type:**

1. **HALT** — do NOT retry further
2. Record finding via `apex-recall finding <project> --add "circuit_breaker: {category} - {error message} (3 consecutive failures)" --json`
3. Checkpoint the blocked phase via `apex-recall`; never edit session JSON directly
4. Track the attempt count in the active loop and persist a finding; do not invent state fields
5. Notify via PR comment only when that external write is authorized
6. Present findings to user and wait for guidance

## Escalation Protocol

When the circuit breaker trips:

```text
1. Record the failure pattern through apex-recall finding
2. Checkpoint the blocked phase through apex-recall checkpoint
3. Preserve all unresolved findings and completed evidence
4. Present to user:
   "⚠️ Circuit breaker triggered: {failure_category}
    {consecutive_count} consecutive failures detected.
    Last error: {last_error}
    Action: Manual intervention required."
5. Wait for user decision:
   a. proceed-with-substitute: propose a substitute for explicit approval and owner reconciliation
   b. change-region: propose a region change for explicit approval and refreshed evidence
   c. abort: halt and return control to the user
```

Follow [Bounded retry](../SKILL.md#bounded-retry). Neither substitution nor a
region change authorizes immediate apply: update approved inputs through their
owners, rerun affected checks/reviews, and obtain evidence-bound approval.
No skip-step or reset bypass is permitted. Policy, governance and budget
violations stop immediately; stricter operation-specific retry limits prevail.

## Deploy Agent Integration

Before starting any deployment:

1. **Read this document** for failure taxonomy awareness
2. **Track retry count** in the active loop and record failure evidence through `apex-recall`
3. **Check for anomaly patterns** after each operation
4. **Apply stopping rule**: same error 3 times → halt, write blocked finding

### Stopping Rule (MANDATORY)

> If a deployment command returns the same error 3 consecutive times,
> HALT and write a `blocked` finding. Do NOT retry further.
> Present the error pattern to the user for manual intervention.
