<!-- ref:effect-classification-v1 -->

# Effect Classification

`discover.py` emits only plan-relevant effects in `findings[]`. Audit/Disabled
effects are counted in `discovery_summary` but not expanded.

| Effect                       | Classification   | In `findings[]`? | Notes                                                   |
| ---------------------------- | ---------------- | ---------------- | ------------------------------------------------------- |
| `Deny`                       | `blocker`        | Yes              | Hard blocker unless exempted                            |
| `DeployIfNotExists`          | `auto-remediate` | Yes              | Azure handles; plan must allow it                       |
| `Modify`                     | `auto-remediate` | Yes              | Azure mutates resource at deploy                        |
| `Audit` / `AuditIfNotExists` | (summary only)   | No               | Informational; count in `discovery_summary.audit_count` |
| `Disabled`                   | (summary only)   | No               | Ignored                                                 |

## Exemption Downgrade

When a `Microsoft.Authorization/policyExemptions` record matches an assignment,
the corresponding finding keeps its original `effect` but the `classification`
downgrades to `informational` and the `exemption` field is populated with:

- `exemptionCategory` — `Waiver` or `Mitigated` (from Azure)
- `expiresOn` — ISO timestamp or `null` if never
- `description` — as recorded in Azure
- `policyDefinitionReferenceIds` — for initiative-member scoping

Downstream Bicep/Terraform CodeGen agents already treat non-null `override`
fields as informational warnings; they apply the same logic to non-null
`exemption`.

## Defender Auto-Assignment Filter

`properties.metadata.assignedBy == "Security Center"` indicates Microsoft
Defender for Cloud auto-created this assignment. These are noisy and rarely
block customer workloads. `discover.py` excludes them by default (matches EPAC
behaviour) and logs each to stderr. Use `--include-defender-auto` to retain.

## Prior Art

- **EPAC** (`Enterprise-Azure-Policy-as-Code`) filters Defender auto-assignments
  by default in `Export-AzPolicyResources`.
- **Azure Resource Graph `PolicyResources` table** returns assignments without
  the MG-inheritance walk but misses management-group-inherited policies in a
  single query (would need a second MG-scope query). Kept as fallback only.
- **`az policy definition show` / `az policy assignment show`** are per-item
  calls; strictly slower than batched REST list. Not used.
