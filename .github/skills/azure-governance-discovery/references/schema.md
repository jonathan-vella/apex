<!-- ref:schema-v1 -->

# Output Schema

Full schema: [`tools/schemas/governance-constraints.schema.json`](../../../../tools/schemas/governance-constraints.schema.json)
(`schema_version: governance-constraints-v1`).

`discover.py` emits a minimal envelope that conforms to the schema's required
fields and additionally writes:

## Required Top-Level Fields

| Field             | Type                          | Notes     |
| ----------------- | ----------------------------- | --------- |
| `schema_version`  | `"governance-constraints-v1"` | Constant  |
| `subscription_id` | string (GUID or `"unknown"`)  |           |
| `discovered_at`   | ISO 8601 timestamp            |           |
| `findings[]`      | array                         | See below |

## Additional Envelope Fields

| Field                       | Notes                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `discovery_status`          | `COMPLETE` \| `PARTIAL` \| `FAILED`                                                         |
| `source`                    | `azure-policy-rest-api`                                                                     |
| `project`                   | Passed via `--project`                                                                      |
| `discovery_summary`         | Assignment totals, effect counts, filter counts                                             |
| `assignment_inventory`      | Flat list of discovered assignments for audit                                               |
| `member_policy_index`       | Lowercase IDs of every policy definition resolved (incl. initiative members and audit-only) |
| `residual_drift_acceptance` | Optional operator-authored block; see below                                                 |

### `member_policy_index` (read by L3 policy precheck)

Authoritative reference set for the L3 subagent. Includes every
`policy_definition_id` discovered in this run regardless of effect —
Deny, DeployIfNotExists, Modify, Audit, AuditIfNotExists, Manual,
Disabled. Sorted, lowercase, deduplicated.

The L3 subagent compares live `az policy state list` IDs against this
index to suppress false-positive drift caused by initiative member
policies that `findings[]` filters out (findings[] only carries Deny +
auto-remediate effects). Without this index L3 typically reports
hundreds of phantom "missing" entries on any subscription with MCSB,
ALZ, or MCAPSGov initiative assignments. See
[`iac-common/references/policy-precheck-contract.md`](../../iac-common/references/policy-precheck-contract.md)
Phase 3 step 1.

### `residual_drift_acceptance` (operator-authored, optional)

Operator's informed-consent acceptance of non-blocking drift between
the constraints envelope and live Azure Policy state. Shape:

```jsonc
{
  "accepted_effects": ["audit", "auditIfNotExists", "deployIfNotExists", "modify", "manual", "disabled"],
  "accepted_by": "user:<entra-principal-id-or-email>",
  "accepted_at": "2026-05-13T10:00:00Z",
  "expires_at": "2026-05-20T10:00:00Z",
  "rationale": "Non-blocking drift expected from initiative member policies and compliance re-evaluation timestamps.",
}
```

Authoring rules:

- `accepted_effects[]` must not include `deny`. Deny-effect drift is
  always BLOCKING.
- `expires_at` is required — acceptances are time-boxed. Default
  TTL: 7 days (aligns with the envelope TTL).
- `accepted_by` records who authorised the proceed (a user principal,
  not the agent).
- The L3 subagent reads this block but never writes it. Updates flow
  through `04g-Governance` or hand-edit the constraints JSON; record
  the same decision with `apex-recall decide` for audit.

## Per-Finding Fields

| Field                   | Required                    | Notes                                                                                           |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| `policy_id`             | Yes                         | Policy definition id                                                                            |
| `display_name`          | Yes                         |                                                                                                 |
| `effect`                | Yes                         | One of `deny`, `audit`, `auditIfNotExists`, `append`, `modify`, `deployIfNotExists`, `disabled` |
| `scope`                 | No                          | Assignment scope                                                                                |
| `azurePropertyPath`     | For blockers/auto-remediate | Dot-separated, camelCase                                                                        |
| `bicepPropertyPath`     | For blockers/auto-remediate | `{resourceType}::{path}`                                                                        |
| `terraformPropertyPath` | No                          | Reserved for Step 4                                                                             |
| `required_value`        | For blockers/auto-remediate | Value required by the policy                                                                    |
| `resource_types`        | No                          |                                                                                                 |
| `classification`        | Yes                         | `blocker` \| `auto-remediate` \| `informational`                                                |
| `category`              | Yes                         | From `properties.metadata.category`, default `"Uncategorized"`                                  |
| `exemption`             | Nullable                    | Populated when a `policyExemptions` record matches                                              |
| `override`              | Nullable                    | Human-authored waiver; unchanged contract                                                       |

The schema's `additionalProperties: true` at both envelope and finding levels
means `classification`, `category`, `exemption`, and `assignment_inventory`
are accepted without a schema bump.
