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
  "schema_version": "policy-precheck-v1",
  "project": "{project}",
  "checked_at": "2026-05-11T11:15:08Z",
  "status": "CLEAN" | "DRIFT" | "BLOCKED" | "FAILED",
  "live_policies_missing_from_constraints": [
    {
      "policy_definition_id": "/providers/.../policyDefinitions/...",
      "display_name": "...",
      "effect": "deny",
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
    "envelope_status": "FRESH"
  }
}
```

### `status` values

| Status    | Meaning                                                                                            | Parent agent action                         |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `CLEAN`   | All four sub-checks passed; live state aligns with envelope.                                       | Proceed to deploy.                          |
| `DRIFT`   | `live_policies_missing_from_constraints` OR `live_policies_newer_than_envelope` non-empty.         | `▶ Refresh Governance` handoff.             |
| `BLOCKED` | `policies_that_will_block_deploy` non-empty OR `what_if_summary.policy_violations_in_what_if > 0`. | Route per drift matrix (CodeGen / Planner). |
| `FAILED`  | Subagent could not complete (auth, missing files, what-if error). Includes `reason` field.         | Halt; surface to user.                      |

### Compact summary returned to parent

```text
POLICY PRECHECK RESULT
Status: {CLEAN|DRIFT|BLOCKED|FAILED}
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

1. Parse `{constraints_path}` and build a set of
   `policy_definition_id` values from the `findings[]` array.
2. For each live policy:
   - If `policy_definition_id` not in constraints set → add to
     `live_policies_missing_from_constraints`.
   - If live `lastModified` (or `time`) is newer than
     `discovery_metadata.discovered_at` from the envelope → add to
     `live_policies_newer_than_envelope`.

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

Combine all signals into the JSON shape above. Map status:

- Any entry in `policies_that_will_block_deploy` OR
  `what_if_summary.policy_violations_in_what_if > 0` → `BLOCKED`.
- Else any entry in `live_policies_missing_from_constraints` OR
  `live_policies_newer_than_envelope` OR
  `envelope_status != "FRESH"` → `DRIFT`.
- Else → `CLEAN`.

Write to `output_path`. Return the compact summary block. Stop.

## Boundaries

- Read-only — do not modify constraints, IaC, or run apply.
- Do not auto-refresh the envelope; surface `DRIFT` and let the parent
  invoke `▶ Refresh Governance`.
- Do not retry on transient API errors more than once with
  exponential backoff; bubble up `FAILED` after that.
- Match the JSON shape exactly; deviating field names break the parent
  parser.
