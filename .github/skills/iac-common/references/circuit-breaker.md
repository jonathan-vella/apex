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
2. Write finding to `open_findings` in `00-session-state.json`:
   ```json
   {
     "type": "circuit_breaker",
     "failure_category": "{category}",
     "consecutive_count": 3,
     "last_error": "{error message}",
     "timestamp": "{ISO}"
   }
   ```
3. Set step status to `blocked` in session state
4. Increment `claim.retry_count` for the affected step
5. Notify via PR comment (if in PR context)
6. Present findings to user and wait for guidance

## Escalation Protocol

When the circuit breaker trips:

```text
1. Log the failure pattern to session state event_log
2. Set steps.{N}.status = "blocked"
3. Add finding to open_findings[]
4. Present to user:
   "⚠️ Circuit breaker triggered: {failure_category}
    {consecutive_count} consecutive failures detected.
    Last error: {last_error}
    Action: Manual intervention required."
5. Wait for user decision:
   a. Reset and retry (clears retry_count, tries again)
   b. Skip step (marks as skipped, advances)
   c. Abort workflow (marks as blocked, halts)
```

## Deploy Agent Integration

Before starting any deployment:

1. **Read this document** for failure taxonomy awareness
2. **Track retry count** — increment `claim.retry_count` on each failure
3. **Check for anomaly patterns** after each operation
4. **Apply stopping rule**: same error 3 times → halt, write blocked finding

### Stopping Rule (MANDATORY)

> If a deployment command returns the same error 3 consecutive times,
> HALT and write a `blocked` finding. Do NOT retry further.
> Present the error pattern to the user for manual intervention.
