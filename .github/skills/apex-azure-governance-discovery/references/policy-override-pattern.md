<!-- ref:policy-override-pattern-v1 -->

# Policy Override Pattern

Structured-override contract emitted by 04g-Governance when a user
requests an override of a `deny`-effect policy finding (for example,
"deploy to a region blocked by `JV - Allowed Locations`"). Consumed
by `06b-Bicep CodeGen`, `06t-Terraform CodeGen`, and their deploy
counterparts.

## Why a structured override

The governance agent must not silently drop a finding when the user
requests an override and must not hard-gate the deployment. Instead,
it emits a structured `override` object that downstream agents
treat as an auditable, expiring waiver.

## Override object shape

Attach to the finding inside `04-governance-constraints.json`:

```json
{
  "policy_id": "<policy definition or assignment id>",
  "original_effect": "deny",
  "override": {
    "requested_at": "<ISO-8601 timestamp>",
    "requested_by": "<user principal or 'unknown' for non-interactive>",
    "reason": "<one-line justification; must not be empty>",
    "issue_link": "<GitHub issue or ADR URL; required>",
    "expiry": "<ISO-8601 date, max +90 days from requested_at>"
  }
}
```

## Consumer requirements (06b / 06t and deploy counterparts)

1. Treat findings with a non-null `override` as informational
   warnings, not blockers.
2. Emit a banner comment in generated IaC:
   `// OVERRIDE <policy_id> until <expiry> — see <issue_link>`.
3. Refuse to proceed if `reason` or `issue_link` is empty, or if
   `expiry` is in the past. Re-prompt the user or halt.

Findings without an `override` field continue to hard-gate as before.

## Schema

The full shape of `04-governance-constraints.json` is defined in
[`tools/schemas/governance-constraints.schema.json`](../../../../tools/schemas/governance-constraints.schema.json)
(`schema_version: governance-constraints-v1`). Future validator
upgrades will enforce this contract via AJV.
