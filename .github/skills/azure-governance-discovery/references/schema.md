<!-- ref:schema-v1 -->

# Output Schema

Full schema: [`schemas/governance-constraints.schema.json`](../../../../schemas/governance-constraints.schema.json)
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

| Field                  | Notes                                           |
| ---------------------- | ----------------------------------------------- |
| `discovery_status`     | `COMPLETE` \| `PARTIAL` \| `FAILED`             |
| `source`               | `azure-policy-rest-api`                         |
| `project`              | Passed via `--project`                          |
| `discovery_summary`    | Assignment totals, effect counts, filter counts |
| `assignment_inventory` | Flat list of discovered assignments for audit   |

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
