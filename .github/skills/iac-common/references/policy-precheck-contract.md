<!-- ref:policy-precheck-contract-v1 -->

# Policy Precheck Subagent Contract (L3)

I/O contract for `policy-precheck-subagent`. Deploy agents (07b-Bicep
Deploy, 07t-Terraform Deploy) MUST invoke this subagent BEFORE running
`az deployment ... create` or `terraform apply`. The subagent is the
only layer in the four-layer governance stack that talks to the live
Azure Policy API, so it is the only layer that catches "discovery was
wrong" failures.

## Inputs

The parent deploy agent supplies:

| Field              | Type   | Required | Description                                                                             |
| ------------------ | ------ | -------- | --------------------------------------------------------------------------------------- |
| `project`          | string | yes      | APEX project slug.                                                                      |
| `iac_tool`         | string | yes      | `bicep` or `terraform`.                                                                 |
| `template_path`    | string | yes      | For Bicep: path to `main.bicep`. For Terraform: working directory.                      |
| `parameter_file`   | string | bicep    | Path to `main.bicepparam`. Not used for Terraform.                                      |
| `target_scope`     | string | yes      | `resourceGroup` \| `subscription` \| `managementGroup`.                                 |
| `resource_group`   | string | rg-scope | Resource group name. Required when `target_scope == resourceGroup`.                     |
| `subscription_id`  | string | yes      | Target subscription ID. Used to query live policy state.                                |
| `location`         | string | yes      | Deploy region (for sub-scope what-if).                                                  |
| `constraints_path` | string | yes      | Path to `agent-output/{project}/04-governance-constraints.json`.                        |
| `phase`            | string | no       | Bicep phase label or Terraform `deployment_phase` value (when phased).                  |
| `output_path`      | string | yes      | Where to write the JSON result (e.g. `agent-output/{project}/06-policy-precheck.json`). |

If any required field is missing, return
`{"status":"FAILED","reason":"missing_input:<field>"}` and stop — do
not guess defaults.

## Outputs

The subagent writes a single JSON document at `output_path` and returns
a compact summary (≤15 lines) to the parent agent. JSON shape:

```jsonc
{
  "schema_version": "policy-precheck-v2",
  "project": "{project}",
  "checked_at": "2026-05-11T11:15:08Z",

  // ── GATE FIELDS ─────────────────────────────────────────────────
  // `deploy_gate` is the authoritative apply decision. Deploy agents
  // MUST read this field — not `status` — when deciding whether to
  // invoke `az deployment ... create` or `terraform apply`.
  "deploy_gate": "PROCEED" | "BLOCK",
  "deploy_gate_reason": "no blocking policies, no what-if violations",

  // `status` is the observed-state classification. It is informational
  // and may co-exist with `deploy_gate=PROCEED` (e.g. INFORMATIONAL).
  "status": "CLEAN" | "INFORMATIONAL" | "BLOCKED" | "FAILED",

  // `drift_signal` separates noise from gating concerns. Severity is
  // BLOCKING only when a deny-effect policy is actually missing or
  // a what-if violation is detected. Audit/auditIfNotExists/modify/
  // deployIfNotExists/manual entries are INFORMATIONAL at most.
  "drift_signal": {
    "severity": "NONE" | "INFORMATIONAL" | "BLOCKING",
    "missing_from_constraints_count": 0,
    "newer_than_envelope_count": 0,
    "accepted_by_residual_drift_policy": true,
    "details": "456 missing entries are child policy IDs inside already-captured initiatives; effect distribution: audit=88, auditIfNotExists=114, manual=242, deployIfNotExists=9, modify=3"
  },

  // ── EVIDENCE ────────────────────────────────────────────────────
  "live_policies_missing_from_constraints": [
    {
      "policy_definition_id": "/providers/.../policyDefinitions/...",
      "display_name": "...",
      "effect": "audit",
      "scope": "...",
      "discovered_at_live": "2026-05-10T08:00:00Z"
    }
  ],
  "live_policies_newer_than_envelope": [
    {
      "policy_definition_id": "...",
      "live_lastModified": "2026-05-11T09:00:00Z",
      "envelope_discovered_at": "2026-05-09T12:00:00Z"
    }
  ],
  "policies_that_will_block_deploy": [
    {
      "policy_definition_id": "...",
      "display_name": "...",
      "effect": "deny",
      "matrix_row_present": true,
      "violating_resource_id": "...",
      "violating_property_path": "...",
      "what_if_diagnostic": "..."
    }
  ],
  "what_if_summary": {
    "creates": 12,
    "updates": 3,
    "destroys": 0,
    "replaces": 0,
    "policy_violations_in_what_if": 0
  },
  "attestation": {
    "envelope_signature": "sha256:...",
    "envelope_discovered_at": "...",
    "envelope_ttl_days": 7,
    "envelope_age_days": 1.2,
    "envelope_status": "FRESH",
    "residual_drift_acceptance_present": true,
    "residual_drift_acceptance_expires_at": "2026-05-20T00:00:00Z"
  }
}
```

### `deploy_gate` derivation (deterministic, no ambiguity)

`deploy_gate` is computed by the subagent using this exact rule, in order:

1. Render or REST-stage failure → `deploy_gate=BLOCK`, `status=FAILED`.
2. `policies_that_will_block_deploy` non-empty OR
   `what_if_summary.policy_violations_in_what_if > 0` →
   `deploy_gate=BLOCK`, `status=BLOCKED`.
3. `attestation.envelope_status == "STALE"` → `deploy_gate=BLOCK`,
   `status=INFORMATIONAL`, route to `▶ Refresh Governance`. Envelope
   freshness is the only non-policy gate.
4. `drift_signal.severity == "INFORMATIONAL"` AND
   `drift_signal.accepted_by_residual_drift_policy == true` →
   `deploy_gate=PROCEED`, `status=CLEAN`.
5. `drift_signal.severity == "INFORMATIONAL"` AND not accepted →
   `deploy_gate=PROCEED`, `status=INFORMATIONAL`. Deploy is not auto-
   blocked; the parent surfaces the drift summary to the user as
   informational context only.
6. Otherwise → `deploy_gate=PROCEED`, `status=CLEAN`.

> **Why a separate `deploy_gate`** — the prior contract conflated
> observed-state (status) with the apply decision. A subscription with
> initiative assignments (MCSB, MCAPSGov, ALZ) always shows hundreds of
> child policy IDs in live state that are absent from the constraints
> envelope's `findings[]` because findings only carries Deny + DeployIfNotExists +
> Modify. That noise is unavoidable and non-gating, but the legacy
> contract returned `DRIFT` → routing matrix → `▶ Refresh Governance` →
> indefinite loop. `deploy_gate` makes the apply decision a single
> boolean derived from real blockers only.

### `status` values

| Status          | Meaning                                                            | `deploy_gate` |
| --------------- | ------------------------------------------------------------------ | ------------- |
| `CLEAN`         | No blockers, no informational drift OR drift accepted via policy.  | `PROCEED`     |
| `INFORMATIONAL` | Non-blocking drift observed (audit/modify/DINE/AINE/manual noise). | `PROCEED`     |
| `BLOCKED`       | Deny-effect policy missing OR what-if policy violation detected.   | `BLOCK`       |
| `FAILED`        | Subagent could not complete (auth, render, REST). `reason` field.  | `BLOCK`       |

> Envelope `STALE` produces `status=INFORMATIONAL` + `deploy_gate=BLOCK`
>
> - `▶ Refresh Governance` handoff. The envelope is the input contract,
>   not policy state.

### Legacy `DRIFT` status (deprecated)

`schema_version: policy-precheck-v1` JSON files emitted before this
revision may set `status=DRIFT`. Treat `DRIFT` as `INFORMATIONAL` unless
`policies_that_will_block_deploy` is non-empty, in which case treat as
`BLOCKED`. The validator
[`validate-policy-precheck.mjs`](../../../../tools/scripts/validate-policy-precheck.mjs)
flags `DRIFT` with no `deploy_gate` field as legacy and recommends a
re-run.

### Compact summary returned to parent

```text
POLICY PRECHECK RESULT
Deploy gate: {PROCEED|BLOCK}
Status: {CLEAN|INFORMATIONAL|BLOCKED|FAILED}
Reason: {short rationale}
Drift severity: {NONE|INFORMATIONAL|BLOCKING}
Drift accepted: {true|false}
Live missing from constraints: N
Live newer than envelope: N
What-if violations: N
Envelope: {FRESH|STALE|MISSING}
Output: {output_path}
```

## Workflow

### Phase 1 — Render the deployment

- **Bicep**: `bicep build {template_path} --stdout > /tmp/{project}-rendered.json`.
- **Terraform**: `cd {template_path} && terraform plan -out=/tmp/{project}.tfplan -var="deployment_phase={phase}" && terraform show -json /tmp/{project}.tfplan > /tmp/{project}-rendered.json`.

If either step fails, status `FAILED`, reason
`render_failed:<exit_code>`.

### Phase 2 — Query live policy state

```bash
# Resource-group-scoped deploy
az policy state list \
  --resource-group {resource_group} \
  --top 5000 \
  --query "[].{id:policyDefinitionId, name:policyDefinitionName, effect:policyDefinitionAction, time:timestamp}" \
  -o json > /tmp/{project}-live-policies.json

# Subscription-scoped deploy
az policy state list \
  --subscription {subscription_id} \
  --top 5000 \
  --query "[].{id:policyDefinitionId, name:policyDefinitionName, effect:policyDefinitionAction, time:timestamp}" \
  -o json > /tmp/{project}-live-policies.json
```

Cache the result for ≤ 5 minutes keyed by
`{subscription_id}+{resource_group}+{target_scope}`; never reuse
across deploy invocations.

### Phase 3 — Cross-check live vs constraints

1. Parse `{constraints_path}` and build a set of reference policy IDs.
   Use BOTH sources, in this order:
   - `envelope.member_policy_index[]` (if present) — the complete set
     of every policy definition ID discovered, including
     audit / auditIfNotExists / modify / deployIfNotExists / manual /
     disabled effects. This is the authoritative match set.
   - `envelope.findings[].policy_id` — fallback for older envelopes
     without `member_policy_index`. Note that `findings[]` only contains
     blocker + auto-remediate effects, so falling back will produce
     noisy "missing" entries for non-blocking live policies. Recommend
     refreshing governance to pick up `member_policy_index`.
2. Parse `envelope.residual_drift_acceptance` (if present). The shape is:

   ```jsonc
   {
     "accepted_effects": ["audit", "auditIfNotExists", "deployIfNotExists", "modify", "manual", "disabled"],
     "accepted_by": "user:<principal>",
     "accepted_at": "2026-05-13T10:00:00Z",
     "expires_at": "2026-05-20T10:00:00Z",
     "rationale": "Operator informed consent: non-blocking drift expected from initiative member policies and compliance re-evaluation timestamps.",
   }
   ```

   The acceptance is valid when `expires_at > now`. Operators write
   this block via `04g-Governance` (recommended) or by hand-editing
   the constraints JSON. It is read-only to this subagent.

3. For each live policy:
   - If `policy_definition_id` not in the reference set →
     add to `live_policies_missing_from_constraints`.
   - If live `lastModified` (or `time`) is newer than
     `discovery_metadata.discovered_at` → add to
     `live_policies_newer_than_envelope`.
4. Classify drift severity:
   - `BLOCKING` if any `missing_from_constraints` entry has
     `effect == "deny"`. (These rows also populate
     `policies_that_will_block_deploy` after what-if confirms them.)
   - `INFORMATIONAL` if all missing entries have non-deny effects
     (audit / auditIfNotExists / modify / deployIfNotExists / manual /
     disabled), OR all entries are `newer_than_envelope` timestamp
     churn.
   - `NONE` if both lists are empty.
5. Set `drift_signal.accepted_by_residual_drift_policy = true` when:
   - `residual_drift_acceptance` is present and unexpired, AND
   - every drift entry's `effect` is in `accepted_effects`.

### Phase 4 — What-if validation

- **Bicep**:

  ```bash
  az deployment {target_scope} what-if \
    {scope-args} \
    --template-file {template_path} \
    --parameters {parameter_file} \
    --validation-level Provider \
    --no-pretty-print \
    -o json > /tmp/{project}-whatif.json
  ```

- **Terraform**: reuse the plan from Phase 1; ARM policy violations
  surface as provider errors in `terraform-plan-subagent` output. Read
  the prior plan output if available; otherwise rerun
  `terraform plan -detailed-exitcode`.

Parse the response for ARM policy diagnostics
(`Microsoft.Authorization/policyAssignments`). Each violation adds an
entry to `policies_that_will_block_deploy` with the violating resource
ID, property path, and the raw diagnostic.

### Phase 5 — Envelope freshness

Read `discovery_metadata` from `{constraints_path}` and compute:

- `envelope_age_days = (now - discovered_at) / 86400`.
- `envelope_status`:
  - `MISSING` if `discovery_metadata` absent.
  - `STALE` if `envelope_age_days >= ttl_days`.
  - `FRESH` otherwise.

### Phase 6 — Emit JSON

Combine all signals into the JSON shape above. Derive `deploy_gate`
and `status` using the **exact rule sequence** documented in
`deploy_gate` derivation above. Pseudocode:

```text
if render_failed or rest_failed:
    deploy_gate = "BLOCK"; status = "FAILED"
elif policies_that_will_block_deploy or policy_violations_in_what_if > 0:
    deploy_gate = "BLOCK"; status = "BLOCKED"
elif envelope_status == "STALE":
    deploy_gate = "BLOCK"; status = "INFORMATIONAL"
    # route to ▶ Refresh Governance
elif drift_signal.severity == "INFORMATIONAL" and drift_signal.accepted_by_residual_drift_policy:
    deploy_gate = "PROCEED"; status = "CLEAN"
elif drift_signal.severity == "INFORMATIONAL":
    deploy_gate = "PROCEED"; status = "INFORMATIONAL"
else:
    deploy_gate = "PROCEED"; status = "CLEAN"
```

Write `schema_version: "policy-precheck-v2"` to `output_path`. Return
the compact summary block. Stop.

## Boundaries

- Read-only — do not modify constraints, IaC, or run apply.
- Do not auto-refresh the envelope; surface `DRIFT` and let the parent
  invoke `▶ Refresh Governance`.
- Do not retry on transient API errors more than once with
  exponential backoff; bubble up `FAILED` after that.
- Match the JSON shape exactly; deviating field names break the parent
  parser.
