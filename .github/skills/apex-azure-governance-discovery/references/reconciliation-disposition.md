<!-- ref:reconciliation-disposition-v1 -->

# Governance Reconciliation Disposition Rule

Anti-ambiguity rule for 04g-Governance **Phase 3 Revise handling**
when the user has `Accept`ed (via the Per-Finding Decision Protocol
`askQuestions` panel) a `governance-reconciliation` `must_fix` finding
that conflicts with an approved architecture decision.

> **Phase 2.5 never auto-routes.** This rule fires only after the user
> has chosen `Accept (apply mitigation)` for the finding in Phase 3.
> If the user picks `Reject`, `Defer`, or `Edit`, none of the steps
> below run — the sidecar decision is the audit trail.

## When this rule fires

All of the following must hold:

1. The finding came from the Phase 2.5 `governance-reconciliation`
   challenger pass.
2. `severity == "must_fix"`.
3. `requires_step == "step-2"` (the finding references an approved
   architecture decision).
4. The user selected `Accept (apply mitigation)` for the finding in
   the Phase 3 Per-Finding Decision Protocol panel.

## Required disposition

**Do NOT self-edit** `02-architecture-assessment.md`. Instead, follow
this three-step escalation:

1. **Record the conflict** via apex-recall:

   ```bash
   apex-recall decide <project> \
     --key governance_trace.reconciliation_status \
     --value escalated_to_step-2 \
     --rationale "Reconciliation must_fix vs approved architecture: <finding_id>" \
     --step 3_5 \
     --json
   ```

2. **Emit a typed handoff** to `03-Architect` with:
   - The constraint citation (policy display name + scope).
   - The `must_fix` finding ID (so apex-recall traceability matches).
   - The required architecture revision (which decision the conflict
     invalidates).

   Use the `step-3_5 → step-2` return_edge declared in
   `workflow-graph.json` with
   `condition: on_must_fix_governance_conflict`.

3. **Gate-2_5 stays closed** until Architect re-approves and
   reconciliation re-runs APPROVED. Do NOT advance the workflow;
   surface the conflict to the user and stop.

## Non-architecture conflicts (governance-only Accepted `must_fix`)

For user-`Accept`ed `must_fix` findings that do NOT reference an
approved architecture decision (i.e. the fix is contained in
`04-governance-constraints.md/.json`):

- Apply compatible accepted fixes with available editing tools, preserving user changes and generated-envelope
   ownership. A deterministic extraction defect must be corrected in its owning discovery code and regenerated
   from verified policy evidence; do not hand-edit a generated envelope from a suggested replacement alone.
- Any changed review input invalidates the previous review. Keep Gate-2_5 closed; acceptance is not verified closure.
   The one-pass cap still applies: request a human handoff to `10-Challenger` and the owning agent to resolve the
   review-budget conflict. Do not re-present Proceed against stale evidence, add an automatic pass or reset retries.
- A `must_fix` required at Step 3.5 cannot be deferred to Planner through a decision note. Reject/Defer/Edit do not
   waive blockers. Custom guidance must satisfy the actual finding; managed identity does not replace anonymous-access controls.
- Before completion, require current review evidence with no unresolved `must_fix`. Derive the Governance handoff's
   open findings from the Governance review, not copied Architecture status. After closure and approval, resolve the
   Planner destination from the registry: `05-IaC Planner`. While the review allowance is exhausted, the immediate
   owner is `10-Challenger`. Downstream ownership/cost reconciliation is not evidence of completed remediation.

## Final handoff checklist

Apply on both completed and blocked handoffs. Preserve all required headings while keeping `00-handoff.md` below
60 lines; trim duplicated background and inventory entries, not blocker IDs, approval limits or evidence references.
Put verification status inside existing sections, not new H2 sections that expand the handoff. Carry the actual
latest review path and prior finding IDs, including any successor ID and its unchanged severity.

- **Structure**: explicitly check `04-governance-constraints.md`, README and handoff headings; the project-only
   H2 command defaults to Requirements and does not validate Governance. Check JSON and decision-sidecar shapes separately.
- **Review freshness**: run the current review's `--verify-cache` check. A schema-only findings check is not freshness.
   Expected stale evidence in a blocked recovery must be reported as stale, never relabeled passed.
   Run it independently of formatting checks so an unrelated failure cannot short-circuit the evidence result.
   For untracked artifacts, `git diff --check` has no content coverage; do not report it as artifact validation.
   Validate edited prose directly, preserve existing unrelated formatting, and report remaining formatting issues separately.
- **Blocker closure**: compare every Governance must-fix ID with current independent review evidence. Retain IDs
   as awaiting verification until closure is verified. Accepted dispositions alone cannot remove them.
- **Routing**: the immediate owner must match the current blocker. An exhausted review budget requires human
   `10-Challenger` selection; `05-IaC Planner` is only the later destination after closure and approval.
   When corrections remain, return to `04g-Governance` first to finalize them against evidence; only then request
   explicitly authorized verification of frozen bytes. Do not alternate owners merely to rediscover known corrections.
- **Consistency**: do not emit "None" in open findings when Governance still has unverified must-fix findings.
   Do not copy Architecture's review outcome into Governance's open-findings section.
   Reconcile Key Decisions as well as verification prose; a corrected paragraph cannot override a contradictory summary.
- **Evidence recovery**: query `apex-recall show` directly or a captured existing result with its actual schema.
   Never probe an invented file and suppress errors with `|| true`. Missing/truncated context remains unresolved;
   recover the required fields, and distinguish absent fields from values selected at the wrong JSON level.
   Decisions, open findings and per-step status live under `.session`, not at the root. Use the
   [canonical show schema](../../../../tools/apex-recall/docs/show-schema.md), not fallback chains guessing field locations.
   Prior recall confirmations are historical assertions, not policy evidence. If a current reviewed correction
   supersedes them, label the stale entries explicitly in the approval summary and return their reconciliation to
   the owning agent through `apex-recall`; preserve decision history and human approvals. Do not reintroduce a
   policy allow-list or co-location mandate from stale recall when current reviewed evidence establishes neither.
- **Command outcomes**: check the final exit status, not an earlier `OK` in a chained command. A failed length test
   means Structure FAIL even if headings passed. An absent success marker or empty output is not a pass.
   Compare before/after byte hashes for preservation claims; a post-edit hash alone establishes no baseline.

Agent-safe structural commands, run from the workspace root:

```bash
npm run check:h2-order -- <project> 04-governance-constraints.md
npm run check:h2-order -- <project> README.md
npm run check:h2-order -- <project> 00-handoff.md
test "$(wc -l < agent-output/<project>/00-handoff.md)" -lt 60
```

Run strict review verification before presenting the approval gate, using the explicitly selected review path:

```bash
node tools/scripts/validate-challenger-findings.mjs --verify-cache <selected-findings-path>
```

`--verify-cache` belongs to this Node validator, not `apex-recall show`, `complete-step` or `transition`.
The completion commands invoke strict validation internally; schema validation and an artifact SHA comparison alone
do not verify the complete review cache contract. Reuse the successful result while its inputs remain unchanged.
If a required reference read returns no content, recover the named section rather than assuming it was loaded.

Report `Structure: PASS/FAIL`, `Review freshness: CURRENT/STALE/UNAVAILABLE`, and
`Blocker closure: VERIFIED/AWAITING VERIFICATION` independently. Never replace those outcomes with a blanket
"governance validation passed". Do not complete or advance when required evidence is stale or closure unverified.

### Completing with a later authorized review

Once current independent evidence verifies closure, return to `04g-Governance` for the separate human approval gate.
Do not request another review merely because the default Pass 1 is historical. Preserve reviewed bytes, earlier
passes and decisions. Record approval outside the reviewed artifact; a status-badge edit would invalidate the review.

After explicit completion approval, select the actual authorized later pass with `--governance-review` and
`--governance-review-reason`. Both `complete-step` and `transition --complete` support these Step 3.5-only flags;
use transition only when starting the next step is also approved. Example from the workspace root:

```bash
apex-recall complete-step <project> 3_5 \
   --governance-review agent-output/<project>/challenge-findings-governance-constraints-pass<N>.json \
   --governance-review-reason "<authorization reference and reason for using the corrected-input review>" --json
```

The file must be a canonical later-pass file in the same project, not a symlink. Its pass number, artifact, lens,
findings and strict freshness must validate; the original Pass 1 must remain present. Selection is not a missing-review
bypass, does not renew review allowances, and does not establish human approval. Successful completion appends the
selected filename, pass, byte hash and reason to the existing decision log in the same state write.
No newest-file inference or review copying is allowed. Repeated completion commands must explicitly select the review
again; the audit entry does not silently replace default review resolution.

## Pointer back to agent

The 04g-Governance agent references this file from its Phase 3 Revise
handling — the body of the agent does not re-derive the rule. Phase 2.5
only records findings; it never applies dispositions.
