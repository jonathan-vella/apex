<!-- ref:effect-classification-v1 -->

# Effect Classification

`discover.py` emits only plan-relevant effects in `findings[]`. Audit/Disabled
effects are counted in `discovery_summary` but not expanded.

| Effect                              | Classification    | In `findings[]`? | Notes                                                                               |
| ----------------------------------- | ----------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `Deny` (resource/mixed predicates)  | `blocker`         | Yes              | Hard IaC/deployment blocker unless exempted or `DoNotEnforce`                       |
| `Deny` (pure `requestContext` auth) | `caller-identity` | Yes              | Caller sign-in requirement (`identity_only: true`); not an IaC resource constraint  |
| `DeployIfNotExists`                 | `auto-remediate`  | Yes              | Azure handles; plan must allow it                                                   |
| `Modify`                            | `auto-remediate`  | Yes              | Azure mutates resource at deploy                                                    |
| `Audit` / `AuditIfNotExists`        | (summary only)    | No               | Informational; count in `discovery_summary.audit_count`                             |
| `Disabled`                          | (summary only)    | No               | Ignored                                                                             |

## Caller-Identity (`requestContext().identity`) Rules

Policies such as **Multi Factor Authentication Enforcement - Write** and
**Multi Factor Authentication Enforcement - Delete** evaluate only
`requestContext().identity` claims (for example `idtyp`, `appid`, `acrs`,
`authnmethodsreferences`, or `objectidentifier`) with no resource `field`,
`type`, or ARM/Bicep property predicates. No Bicep or Terraform change can
satisfy or violate these policies — only signing in with a non-compliant caller
token triggers `RequestDisallowedByPolicy`.

`discover.py` and `collect-governance-baseline.ps1` inspect the resolved
`policyRule.if` tree:

- **Pure caller-identity `Deny` rules**: every condition branch evaluates only
  `requestContext().identity` expressions and constant/parameter values (zero
  `"field"` keys, zero `field()`/`resourceGroup()`/`subscription()`/`tenant()`/`policy()`/`deployment()`
  calls, and zero non-identity `requestContext()` properties such as
  `requestContext().apiVersion`). These emit `classification: "caller-identity"`,
  set `identity_only: true`, and increment
  `discovery_summary.caller_identity_count` instead of `blocker_count`.
- **Mixed or non-identity rules (fail-closed)**: any rule combining
  `requestContext().identity` with resource `type`, resource `field`s, scope
  functions, `requestContext().apiVersion`, or unrecognized condition shapes
  remains `classification: "blocker"` without `identity_only`.
- **Exemption / `DoNotEnforce`**: active covering exemptions or
  `enforcementMode: "DoNotEnforce"` downgrade `classification` to
  `"informational"` while retaining `identity_only: true` for provenance.

## Effective Parameters And Definitions

Referenced definitions and initiatives are fetched by their full resource IDs,
including management-group custom definitions and members of subscription or
management-group initiatives. An unrelated GET result cannot substitute for a
missing definition. Unresolved definitions, members, or effects produce
`PARTIAL` rather than silently disappearing from a `COMPLETE` result.

When resolving an ancestor management-group custom definition, initiative, or
assignment fails with HTTP `403` (for example when the caller has `Reader` on
the subscription and intermediate management groups, but lacks
`Microsoft.Authorization/policyDefinitions/read` or `policyAssignments/read` at
the tenant root management group), the collector records a structured entry in
`unresolved_scopes[]` (mirrored in `discovery_metadata.unresolved_scopes[]`)
with `reason: "ancestor_scope_forbidden"`, `scope`, `management_group`,
`surface`, `resource_id`, and `http_status: 403`. Downstream consumers can
distinguish expected ancestor management-group permission boundaries from
subscription-scope failures or inventory drift (`definition_not_found`,
`unresolved_effect`, `assignment_inventory_drift`, etc.).

Direct assignment values override definition defaults. For initiatives,
assignment values override initiative defaults, member bindings resolve against
those effective values, and member bindings override policy defaults. Exact
`[parameters('name')]` references resolve case-insensitively while emitted
parameter names retain their casing. Unsupported effect expressions remain
unresolved; the collector does not guess their effect.

## Exemption Downgrade

Only a valid `Waiver` or `Mitigated` exemption covering the target subscription
and initiative member can downgrade a Deny blocker to `informational`.
Assignment ID comparison is case-insensitive. A subscription-scope exemption,
or an exemption at the inherited assignment's own management-group scope,
provides coverage; a child resource-group scope, unrelated scope, resource
selector, or unproven ancestor does not establish subscription-wide coverage.
The finding retains its original `effect`. The selected `exemption` includes:

- `exemptionCategory` — `Waiver` or `Mitigated` (from Azure)
- `expiresOn` — ISO timestamp or `null` if never
- `description` — as recorded in Azure
- `policyDefinitionReferenceIds` — for initiative-member scoping
- `id`, `scope`, `resourceSelectors` — coverage provenance

All matching records are retained in `exemption_candidates`, in deterministic
order. Each is evaluated independently; one partial exemption cannot erase a
different member's valid exemption. Expiry must be absent/null or a valid
timezone-aware instant strictly after evaluation time. Expired, invalid, and
timezone-less expiry values never suppress a blocker. Cache reuse rechecks
applied exemptions even while the discovery timestamp remains inside its TTL.

`DoNotEnforce` assignments remain in findings as informational policy evidence;
their `enforcement_mode` is retained and they do not contribute an enforced
location allowlist.

## Allowed Locations

Location values come from the resolved policy condition, not a policy name or
category. `required_value` carries the effective list; `location_condition`,
`scope`, `resource_types`, `not_scopes`, `resource_selectors`, and
`policy_definition_reference_id` retain applicability and provenance.

Top-level `allowed_locations` intersects compatible, enforced subscription-wide
Deny allowlists, including inherited restrictions. Definition defaults do not
union with assignment overrides. Exempted and non-enforcing findings do not
contribute. A conditional, resource-specific, or differently scoped restriction
is retained per finding and prevents advertising a universal list.

An empty top-level list is not evidence of unrestricted placement: it can mean
no location policy, a disjoint intersection, or restrictions requiring scoped
interpretation. Inspect the retained findings to distinguish those cases.

Downstream Bicep/Terraform CodeGen agents already treat non-null `override`
fields as informational warnings; they apply the same logic to non-null
`exemption`.

## Defender Auto-Assignment Filter

`properties.metadata.assignedBy == "Security Center"` indicates Microsoft
Defender for Cloud auto-created this assignment. `discover.py` retains these by default
and evaluates their real effects. Reduce presentation noise after analysis, never by
claiming an unassessed assignment harmless. Legacy `--exclude-defender-auto` explicitly
retains the old filtered scope; its snapshot is not full-coverage evidence.

## Prior Art

- **EPAC** (`Enterprise-Azure-Policy-as-Code`) filters Defender auto-assignments
  by default in `Export-AzPolicyResources`.
- **Azure Resource Graph `PolicyResources` table** returns assignments without
  the MG-inheritance walk but misses management-group-inherited policies in a
  single query (would need a second MG-scope query). Kept as fallback only.
- **`az policy definition show` / `az policy assignment show`** are per-item
  calls; strictly slower than batched REST list. Not used.
