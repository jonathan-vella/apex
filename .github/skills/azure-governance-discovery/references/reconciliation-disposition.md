<!-- ref:reconciliation-disposition-v1 -->

# Governance Reconciliation Disposition Rule

Anti-ambiguity rule for 04g-Governance Phase 2.5 when the
`governance-reconciliation` review surfaces a `must_fix` finding that
conflicts with an approved architecture decision.

## When this rule fires

A reconciliation finding is `must_fix` AND references an approved
architecture decision (typically signalled by
`requires_step == "step-2"` on the finding).

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

## Non-architecture conflicts (governance-only `must_fix`)

For `must_fix` findings that do NOT reference an approved architecture
decision (i.e. the fix is contained in
`04-governance-constraints.md/.json`):

- Batch-fix in the governance artifact in one edit pass (single
  `multi_replace_string_in_file` call).
- Re-run the challenger with `overwrite: true` to confirm.

## Pointer back to agent

The 04g-Governance agent references this file from its Phase 2.5
section — the body of the agent does not re-derive the rule.
