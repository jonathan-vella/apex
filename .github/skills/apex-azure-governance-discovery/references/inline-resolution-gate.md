<!-- ref:inline-resolution-gate-v1 -->

# Inline Resolution Gate (Phase 2.7)

Mandatory protocol the 04g-Governance agent runs after the challenger
review and before the Approval Gate. Three inherited policy parameters
are always confirmed inline with the user in the same chat session
because REST often does not expose them reliably for management-group
inherited assignments.

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
time. Asking inline once, every time, eliminates this class of
failure.

## When the gate runs

- **Every invocation** of 04g-Governance — live, cached baseline, and
  `▶ Refresh Governance`.
- **Always after Phase 2.5** challenger review.
- **Always before Phase 3** Approval Gate.

The only valid bypass is the Phase 0.4 resume short-circuit, which
already verified that the three resolutions exist in
`governance_gate_status.resolved_confirmations` **and** the snapshot
they were recorded against is still trusted (signature + TTL match).

### Same-session signature + TTL short-circuit

Even within a single live session, the Phase 2.7 prompt is skipped when:

1. `governance_gate_status.resolved_confirmations` already contains all
   three required topics from a prior pass in the same project, AND
2. `discovery_metadata.completeness_signature` from the current
   envelope equals `decisions.discovery_signature` in the apex-recall
   snapshot, AND
3. `age_days = (now - discovery_metadata.discovered_at) / 86400 <=
   discovery_metadata.ttl_days` (default 7).

All three checks must pass — signature match alone is insufficient
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
  target_region: (.location_constraints.target_region // "swedencentral"),
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

### Step 2: Ask all three questions in a single `vscode_askQuestions` call

The three questions MUST appear together in one chat-session prompt.
Do not split across turns. The discovered values are presented as the
recommended option; the user can pick an alternative or paste freeform
text.

| Header                  | Question                                                                    | Recommended option                              |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| Required RG Tag Keys    | Which resource group tag keys must Step 4 emit, and in what casing?         | Use all N discovered lowercase, hyphenated keys |
| swedencentral Allowed   | Is `{target_region}` allowed by `JV - Allowed Locations` for this sub?      | Yes — `{target_region}` is allowed              |
| RG/Resource Same Region | Must the resource group and all regional resources stay in the same region? | Yes — enforce same region                       |

Each question must include freeform input so the user can paste an
exact answer that differs from the recommended option.

### Step 3: Apply answers in a single multi-replace

Bundle every artifact edit into one `multi_replace_string_in_file`
call. Required JSON updates:

```jsonc
{
  "governance_gate_status": {
    "status": "READY_FOR_PLANNING",
    "reason": "Live discovery completed and the three outstanding manual confirmations were resolved by the project owner.",
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

### Step 4: Record decisions in `apex-recall`

One `apex-recall decide --key … --value …` call per confirmation:

```bash
apex-recall decide <project> --key required_rg_tags        --value "<comma-separated keys (casing)>" --json
apex-recall decide <project> --key allowed_locations       --value "<region(s)> (confirmed by JV - Allowed Locations)" --json
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

### Step 7: Checkpoint

```bash
apex-recall checkpoint <project> 3_5 phase_2_7_resolution --json
```

## Anti-patterns

- Do NOT skip Phase 2.7 because `discover.py` reported the tag or
  location contracts as `CONFIRMED`. Inherited MG policy parameters
  are not reliably exposed via REST.
- Do NOT split the three questions across multiple
  `vscode_askQuestions` calls or chat turns. They must appear
  together so the user can answer them in the same chat session.
- Do NOT advance to Phase 3 without the
  `phase_2_7_resolution` checkpoint recorded.
- Do NOT silently accept `Unknown — block` answers without updating
  `governance_gate_status.required_human_confirmations[]` and
  hiding the `Proceed` option.
