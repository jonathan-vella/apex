<!-- ref:governance-discovery-v1 -->

# Governance Discovery Reference

## MANDATORY Gate

Governance discovery is a **hard gate**. If Azure connectivity is
unavailable or policies cannot be fully retrieved (including
management group-inherited), STOP and inform the user. Do NOT
proceed to implementation planning with incomplete policy data.

## Discovery Commands (Ordered by Completeness)

### 1. REST API (MANDATORY — includes MG-inherited policies)

```bash
SUB_ID=$(az account show --query id -o tsv)
az rest --method GET \
  --url "https://management.azure.com/subscriptions/\
${SUB_ID}/providers/Microsoft.Authorization/\
policyAssignments?api-version=2022-06-01" \
  --query "value[].{name:name, \
displayName:properties.displayName, \
scope:properties.scope, \
enforcementMode:properties.enforcementMode, \
policyDefinitionId:properties.policyDefinitionId}" \
  -o json
```

> [!CAUTION]
> `az policy assignment list` only returns subscription-scoped
> assignments. Management group policies (often Deny/tag enforcement)
> are invisible to it.
> **ALWAYS use the REST API above as the primary discovery method.**

### 2. Policy Definition Drill-Down

For each Deny/DeployIfNotExists policy:

```bash
# Built-in or subscription-scoped
az policy definition show --name "{guid}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect, \
conditions:policyRule.if}" -o json

# Management-group-scoped custom policies
az policy definition show --name "{guid}" \
  --management-group "{mgId}" \
  --query "{displayName:displayName, \
effect:policyRule.then.effect}" -o json

# Policy set definitions (initiatives)
az policy set-definition show --name "{guid}" \
  --query "{displayName:displayName, \
policyCount:policyDefinitions | length(@)}" -o json
```

### 3. ARG KQL (supplemental — subscription-scoped only)

```kusto
PolicyResources
| where type ==
  'microsoft.authorization/policyassignments'
| where properties.enforcementMode == 'Default'
| project name, displayName=properties.displayName,
  effect=properties.parameters.effect.value,
  scope=properties.scope
| order by name asc
```

## Discovery Workflow

```text
1. Verify Azure connectivity: az account show
2. REST API: Get ALL effective policy assignments
3. Compare count with Azure Portal (Policy > Assignments)
4. For each Deny/DeployIfNotExists: drill into definition
5. Check tag enforcement policies (names with 'tag'/'Tag')
6. Check allowed resource types and locations
7. Document ALL findings in 04-governance-constraints.md
```

## Common Policy Constraints

> [!NOTE]
> The governance constraints JSON output schema must include
> `bicepPropertyPath`, `azurePropertyPath`, and `requiredValue`
> fields for each Deny policy.

| Policy             | Impact                    | Solution                        |
| ------------------ | ------------------------- | ------------------------------- |
| Required tags      | Deploy fails without tags | Include all 4 required tags     |
| Allowed locations  | Resources rejected        | Use `swedencentral` default     |
| SQL AAD-only auth  | SQL password auth blocked | Use `azureADOnlyAuth: true`     |
| Storage shared key | Shared key access denied  | Use managed identity RBAC       |
| Zone redundancy    | Non-zonal SKUs rejected   | Use P1v4+ for App Service Plans |

## L0 Discovery Envelope (MANDATORY)

Every `04-governance-constraints.json` MUST carry a `discovery_metadata`
envelope. The envelope is the L0 attestation in the four-layer
governance stack — every downstream consumer (Planner, CodeGen, Deploy)
reads this object FIRST and STOPS if any field is missing or stale.

### Envelope shape

```jsonc
{
  "discovery_metadata": {
    "discovery_status": "COMPLETE",       // COMPLETE | PARTIAL | FAILED
    "discovered_at": "2026-05-11T11:15:08Z",
    "scope": {
      "subscription_id": "00000000-0000-0000-0000-000000000000",
      "management_groups": ["mg-root", "mg-prod"]
    },
    "api_versions": {
      "policyAssignments": "2022-06-01",
      "policyDefinitions": "2021-06-01",
      "policyExemptions": "2022-07-01-preview"
    },
    "page_counts": {
      "policyAssignments": 3,
      "policyDefinitions": 12,
      "policyExemptions": 1
    },
    "completeness_signature": "sha256:...",  // see below
    "ttl_days": 7
  },
  "policies": [ ... ],
  "findings": [ ... ]
}
```

### Field reference

| Field                     | Required | Notes                                                                                                    |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `discovery_status`        | yes      | `COMPLETE` allows downstream consumption; `PARTIAL`/`FAILED` blocks it.                                  |
| `discovered_at`           | yes      | ISO-8601 UTC timestamp at which the deterministic discovery completed.                                   |
| `scope.subscription_id`   | yes      | Target subscription ID. `"unknown"` when discovery ran offline against a fixture.                        |
| `scope.management_groups` | yes      | Ordered ancestry; empty array allowed only when the subscription has no MG ancestry.                     |
| `api_versions.*`          | yes      | API version actually used for each REST surface. Pin to the constants in `discover.py`.                  |
| `page_counts.*`           | yes      | Number of pages traversed per REST surface. Used by the end-of-discovery self-check (re-fetch page 1).   |
| `completeness_signature`  | yes      | `sha256:<hex>` of the stable-sorted hash of `(policy_id, effect, scope, params)` tuples.                 |
| `ttl_days`                | yes      | Staleness threshold. Default `7`. Downstream consumers compute `age_days = (now - discovered_at)/86400`. |

### Completeness signature

Algorithm (must be deterministic across runs):

1. Build a list of tuples `(policy_id, effect, scope, params)` for every
   entry in `findings[]`. Sort by `policy_id`.
2. Serialise each tuple as a compact JSON object with sorted keys.
3. Concatenate with `\n` separators.
4. `sha256` the result. Emit as `sha256:<hex>`.

This signature is the value the Planner records via
`apex-recall decide --key discovery_signature` at the start of Phase 1.
CodeGen and Deploy agents cross-check this signature against the
envelope on disk and STOP on mismatch.

### End-of-discovery self-check

After writing the envelope, `discover.py` MUST:

1. Re-fetch page 1 of `policyAssignments` (cheapest call).
2. Confirm the assignment count on that page matches what was recorded
   in `page_counts.policyAssignments` for page 1.
3. On mismatch → set `discovery_status: "PARTIAL"` and append a
   stderr warning naming the drifted REST surface.

### Refresh handoff is non-skippable

When invoked via `▶ Refresh Governance` from any downstream consumer,
04g-Governance MUST run a full re-discovery (`--refresh`), not a cache
hit. Stale-cache returns are the failure mode this rule prevents.

### Consumer protocol (Planner / CodeGen / Deploy)

1. Read `discovery_metadata` from disk.
2. STOP and traverse `▶ Refresh Governance` if any of:
   - File missing or `discovery_metadata` absent.
   - `discovery_status != "COMPLETE"`.
   - `age_days > ttl_days`.
   - `completeness_signature` differs from the cached
     `discovery_signature` decision.
   - `policies[]` is empty AND any `page_counts.*` > 0.
3. Otherwise proceed.

### Backward compatibility

Existing `04-governance-constraints.json` files without
`discovery_metadata` are accepted as `discovery_status: "PARTIAL"` by
consumer agents (warning only) for 30 days after rollout. After 30 days,
absence is a hard stop. Migration is non-destructive: re-run
04g-Governance with `--refresh`.
