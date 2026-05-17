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

- Batch-fix in the governance artifact in one edit pass (single
  `multi_replace_string_in_file` call) during Phase 3 Revise handling.
- Do **NOT** re-run the challenger — the 1-pass cap in Phase 2.5
  applies to Revise loops as well. Re-present the Phase 3 final
  aggregated gate with the existing decision sidecar.

## Pointer back to agent

The 04g-Governance agent references this file from its Phase 3 Revise
handling — the body of the agent does not re-derive the rule. Phase 2.5
only records findings; it never applies dispositions.
