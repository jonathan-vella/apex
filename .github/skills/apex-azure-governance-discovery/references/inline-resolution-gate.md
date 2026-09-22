<!-- ref:inline-resolution-gate-v1 -->

# Inline Resolution Gate (Phase 2.7)

Mandatory protocol the 04g-Governance agent runs before challenger review
and the Approval Gate. Resolve RG tag keys/casing, allowed locations, and
RG/resource same-region requirements from policy evidence and user confirmation.
Reuse proven-current answers; ask unresolved topics together. Display names
are untrusted labels, not proof of policy semantics or authorization.

## Why this gate exists

Inherited management-group policies frequently surface in
`discover.py` output without their evaluated parameters, even when
`discovery_status == "COMPLETE"`. The most common gaps are:

- `JV-Enforce Resource Group Tags` — required tag keys and casing
- `JV - Allowed Locations` — allow-list of Azure regions
- `Resource Group and Resource locations should match` — same-region
  enforcement

Treating these as resolved-by-REST has caused Step 4 IaC plans to
emit incomplete tag sets, wrong-region resource groups, or
mismatched RG/resource locations — all of which fail at deployment
time. Bind confirmations to complete, current policy and architecture inputs.

## When the gate runs

- **Every invocation** of 04g-Governance — live, cached baseline, and
  `▶ Refresh Governance`.
- **Always before Phase 2.5** challenger review so it covers resolved artifacts.
- **Always before Phase 3** Approval Gate.

This is resolution, not a bypass: Phase 0.4 may reuse existing answers only
when all checks below pass. Review evidence has its own freshness checks.

### Same-session signature + TTL short-circuit

Even within a single live session, the Phase 2.7 prompt is skipped when:

1. `governance_gate_status.resolved_confirmations` already contains all
   three required topics from a prior pass in the same project, AND
2. The current completeness signature matches the confirmation snapshot
  captured **before discovery**. A newly written recall signature cannot
  attest old answers. Project, subscription, target region, relevant
  architecture inputs and discovery options must also match; missing
  binding evidence prevents reuse.
3. The envelope is COMPLETE with verified signature, valid unexpired exemptions,
  a timezone-aware timestamp and positive integer TTL, with
  `0 <= age_days <= discovery_metadata.ttl_days`.
4. No explicit refresh, signature drift or changed confirmation inputs occurred.

All checks must pass — signature match alone is insufficient
(upstream policy drift between refreshes would silently ride on a
stale confirmation). When the check passes, emit a single-line log:

```text
Phase 2.7 confirmations resolved from prior session (signature + TTL match)
```

If TTL is exceeded the prompt MUST be re-issued, even when the
signature has not changed — the locked S3 decision is single-clock:
confirmations age transitively with the snapshot they were recorded
against.

## Protocol

### Step 1: Compute defaults

Use `jq` against `agent-output/{project}/04-governance-constraints.json`:

```bash
jq '{
  tag_keys_discovered:
    (.tag_contract.required_tag_keys // .tag_contract.discovered_candidate_tags // []),
  target_region: (.location_constraints.target_region // null),
  allowed_locations_discovered: (.location_constraints.allowed_locations // []),
  related_assignments: (.location_constraints.related_assignments // [])
}' agent-output/{project}/04-governance-constraints.json
```

### Step 1a: Authoritative tag-key resolution (MANDATORY before Step 2)

Before presenting the `Required RG Tag Keys` question, reconcile tag
keys across ALL Tags-category policies in the discovery JSON. The
discovery script populates `findings[*].extracted_tag_keys` for every
Tags-category policy whose `policyRule` hard-codes tag keys (typical
of Deny policies); Modify policies still expose keys via
`assignment_parameters.tagName*`. **Deny-policy keys win** — they are
the enforcement contract. Modify-policy keys must be unioned (not
substituted) so resources satisfy both layers.

```bash
jq -r '
  .findings // []
  | map(select((.category // "" | ascii_downcase) == "tags"))
  | map({
      name: .display_name,
      effect: .effect,
      keys_from_rule: (.extracted_tag_keys // []),
      keys_from_params: (
        (.assignment_parameters // {})
        | to_entries
        | map(select(.key | test("^tagName"; "i")))
        | map(.value)
      )
    })
' agent-output/{project}/04-governance-constraints.json
```

Resolution rules:

1. Collect the **deny-policy key set** = union of `keys_from_rule`
   across all `effect: "deny"` Tags policies.
2. Collect the **modify-policy key set** = union of `keys_from_params`
   across all `effect: "modify"` Tags policies.
3. If the two sets are **identical**, `required_tag_keys` =
   deny-policy set.
4. If they **differ** (transcription drift, e.g. `technical-contact`
   vs `tech-contact`):
   - `required_tag_keys` = **union** of both sets.
   - Append a finding via `apex-recall finding <project> --add
     "Tag policy drift: deny=<list> modify=<list>; deployment must emit
     both sets to satisfy both layers." --json`.
   - Set `tag_contract.drift_detected = true` in the artifact JSON.
5. **NEVER** synthesise tag keys from parametric knowledge or
   abbreviate (`technical-contact` → `tech-contact`) — every key
   in `required_tag_keys` MUST trace back to either
   `extracted_tag_keys` or `assignment_parameters.tagName*` in the
   discovery JSON.

### Step 1b: Separate policy evidence from project choices

Before questions or review, trace each claimed location restriction to an effective assignment/definition,
resolved rule parameters, applicable scope and exemptions. Distinguish a policy-enforced restriction, an approved
project choice, and an unknown policy requirement in existing artifact prose and recall rationale.

- A deny rule for one region does not establish an allow-list for another. An empty extracted allow-list is not
  proof of unrestricted deployment; unresolved extraction or applicability remains unknown and blocks confirmation.
- User confirmation of the target region or same-region alignment is a project choice, not evidence that Azure
  Policy mandates it. Retain the approved choice without populating policy-derived fields from preference alone.
- For refreshed evidence, reconcile every prior finding ID with its actual source before spending another
  authorized review. Update all affected summaries together, including Network Policies and Plan Adaptations.
- Distinguish regional workload choices from policy-created resource locations and verified exceptions; do not
  turn a workload alignment decision into a blanket rule that contradicts policy-owned resources.

### Step 2: Resolve all topics, asking unresolved questions together

Use one `vscode_askQuestions` call for all currently unresolved topics. Reuse
only answers satisfying the checks above; changed region or policy inputs
invalidate affected answers. Discovered values are evidence, not pre-approved
choices. Include `Unknown — block` and exact freeform input for every question.
A COMPLETE empty-policy result still resolves every topic, including explicit
not-applicable answers; never invent enforced tags, locations or same-region rules.

| Header                  | Question                                                                    | Recommended option                              |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Required RG Tag Keys    | Which RG tag keys and exact casing are enforced by the effective policy evidence? | Exact discovered keys, never assumed casing |
| Target Region Allowed  | Is `{target_region}` allowed by the effective location rules for this subscription? | Evidence-backed allowed/not-allowed/unknown |
| RG/Resource Same Region | Do the effective rules require RG and regional resource locations to match? | Evidence-backed requirement or explicit not-applicable |

Each question must include freeform input so the user can paste an
exact answer that differs from the recommended option.

### Step 3: Apply resolved answers and validate

Use available editing tools, preserving user work and current schema/H2 structure.
The following JSON is illustrative and may be used only after all topics are
resolved and no other blocker remains. Never overwrite PARTIAL/FAILED discovery
or review blockers with READY_FOR_PLANNING. Conflicts with live policy remain
blocked; user preference cannot override an enforced rule. Required JSON updates:

```jsonc
{
  "governance_gate_status": {
    "status": "READY_FOR_PLANNING",
    "reason": "Current discovery and all required confirmations are resolved; no unresolved governance blocker remains.",
    "blocks_before": null,
    "resolved_confirmations": [
      { "topic": "required_resource_group_tags", "decision": "...", "decided_at": "<ISO-8601>" },
      { "topic": "allowed_locations", "decision": "...", "decided_at": "<ISO-8601>" },
      { "topic": "rg_resource_same_region", "decision": "...", "decided_at": "<ISO-8601>" },
    ],
  },
  "tag_contract": {
    "resolution_status": "CONFIRMED",
    "required_tag_keys": ["..."],
    "casing_guidance": "...",
    "planner_action": "Emit all required tag keys on the resource group; propagate to every taggable workload resource.",
  },
  "location_constraints": {
    "resolution_status": "CONFIRMED",
    "target_region": "...",
    "allowed_locations": ["..."],
    "rg_and_resource_locations_must_match": true,
    "planner_action": "Deploy all resources in the confirmed region. Set the resource group location and ensure every regional resource matches.",
  },
  "tags_required": [
    /* one entry per confirmed key */
  ],
  "allowed_locations": ["..."],
}
```

Required Markdown updates: Discovery Source counts, Required Tags
section, Network Policies section, and any caution banners that
previously said the gate was blocked.
The example's policy-derived values require evidence from Step 1b; do not copy its allow-list or `true`
co-location flag from a project preference. Confirmed project choices do not resolve missing policy evidence.

### Step 4: Record decisions in `apex-recall`

One `apex-recall decide --key … --value …` call per confirmation:

```bash
apex-recall decide <project> --key required_rg_tags        --value "<comma-separated keys (casing)>" --json
apex-recall decide <project> --key allowed_locations       --value "<region(s)> (confirmed against effective policy evidence)" --json
apex-recall decide <project> --key rg_resource_same_region --value "<true|false> (RG + regional resources)" --json
```

### Step 5: Handle "Unknown — block" answers

If the user picks `Unknown — block` for any question, keep
`governance_gate_status.status` as
`BLOCKED_PENDING_PARAMETER_RESOLUTION` and append the unresolved item
to `governance_gate_status.required_human_confirmations[]`. At the
Approval Gate, hide the `Proceed` option until the block is
resolved — only `Revise` and `Refresh governance` remain available.

### Step 6: Re-validate

```bash
python3 -m json.tool agent-output/{project}/04-governance-constraints.json > /dev/null
```

Artifact lint (H2 order, markdownlint) is owned by the lefthook
`artifact-validation` pre-commit hook and the `10-Challenger` review — do not
invoke `npm run lint:artifact-templates` or `markdownlint-cli2` here. See
[`agent-authoring.instructions.md`](../../../instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule).

### Step 7: Checkpoint And Review

```bash
apex-recall checkpoint <project> 3_5 phase_2_7_resolution --json
```

Run Phase 2.5 on the resolved artifact bytes, or reuse only a review whose
full cache inputs still match. Changes after review invalidate it. No-constraints
review skipping follows the graph only; it does not waive confirmation or approval.

## Anti-patterns

- Do NOT skip Phase 2.7 because `discover.py` reported the tag or
  location contracts as `CONFIRMED`. Inherited MG policy parameters
  are not reliably exposed via REST.
- Do NOT repeat proven-current answers or suppress a new question to meet a
  call budget. Batch unresolved topics; missing evidence requires recovery.
- Do NOT advance to Phase 3 without the
  `phase_2_7_resolution` checkpoint recorded.
- Do NOT silently accept `Unknown — block` answers without updating
  `governance_gate_status.required_human_confirmations[]` and
  hiding the `Proceed` option.
