<!-- ref:preflight-policy-checks-v1 -->

# Preflight Policy Checks — Deploy Agent Detail

Per-policy preflight rules and jq snippets used by the deploy agents
([`07b-bicep-deploy`](../../../agents/07b-bicep-deploy.agent.md) and
[`07t-terraform-deploy`](../../../agents/07t-terraform-deploy.agent.md))
during their Preflight Validation Workflow.

---

## Step 2 — Bicep/Terraform skip-validation shortcut

When `apex-recall show <project> --json` confirms
`steps.5.status == "complete"` and the IaC files have not changed since
Step 5, the deploy agent may skip the Step 2 `bicep build` /
`terraform validate` call to avoid redundant work. The generated
`deploy.ps1` / `deploy.sh` should include a `-SkipValidation` switch
for this purpose.

### Canonical jq query (single-step status)

Keys in `session.steps` are **strings** — no `tonumber` coercion:

```bash
apex-recall show <project> --json \
  | jq -r '.session.steps["5"].status // "missing"'
```

Returns `"complete"`, `"pending"`, or `"missing"` — never errors on an
absent step.

### Multi-step status reads

For multi-step status reads (e.g. checking both Steps 5 and 6):

```bash
apex-recall show <project> --json \
  | jq '.session.steps
        | to_entries[]
        | select(.key == "5" or .key == "6")
        | {step: .key, status: .value.status, sub_step: .value.sub_step}'
```

Full schema reference:
[`tools/apex-recall/docs/show-schema.md`](../../../../tools/apex-recall/docs/show-schema.md).

## L3 precheck routing matrix (Step 5.6)

Cross-reference with
[`governance-drift-routing.md`](governance-drift-routing.md) (L3 rows)
for the full handoff destinations.

| `Deploy gate` | `Status`        | Action                                                                                          |
| ------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| `PROCEED`     | `CLEAN`         | Proceed to Deployment Execution.                                                                |
| `PROCEED`     | `INFORMATIONAL` | Proceed; surface drift signal to user as informational only.                                    |
| `BLOCK`       | `INFORMATIONAL` | STOP — envelope is STALE. Traverse `▶ Refresh Governance`.                                      |
| `BLOCK`       | `BLOCKED`       | If violating policy has a matrix row → `↩ Fix Deployment Issues` to CodeGen; otherwise `▶ Refresh Governance` + `↩ Return to Step 4`. |
| `BLOCK`       | `FAILED`        | STOP, surface the precheck error to the user; do not deploy.                                    |

## Deprecation scan regex (Step 5)

When parsing what-if / plan output:

```text
deprecated|sunset|end.of.life|no.longer.supported|classic.*not.*supported|retiring
```

If matched, STOP and report — defer the deprecation handling decision
to the user before continuing.
