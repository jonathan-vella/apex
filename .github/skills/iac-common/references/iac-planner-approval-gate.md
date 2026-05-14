<!-- ref:iac-planner-approval-gate-v1 -->

# IaC Planner — Approval Gate (Phase 5)

Detailed prose for the 05-IaC Planner Phase 5 approval gate. The agent
references this file rather than inlining the full text.

## Stage 1 — Auto-apply every `must_fix` (mandatory)

All `must_fix` findings would block deployment, violate the security
baseline, or break a hard governance constraint. They are **not
negotiable** and **must not** be presented as user choices.

For every `must_fix` finding across all passes:

1. Apply the `suggested_fix.proposed_edit` (formerly `suggested_mitigation`)
   to `04-implementation-plan.md` using a **single
   `multi_replace_string_in_file` call** that bundles every `must_fix`
   edit (do NOT re-emit the plan via `create_file`). See azure-artifacts
   skill "Revision Workflow".
2. Persist each in
   `agent-output/{project}/challenge-findings-plan-decisions.json` with
   `action: "accept"`,
   `note: "auto-applied (must_fix is mandatory)"`, following the sidecar
   schema in adversarial-review-protocol section 2a.
3. Re-run every executed challenger pass with `overwrite: true` to
   confirm the fixes landed (no new `must_fix` should remain). If any
   `must_fix` returns, **repeat Stage 1** for the new findings — up to a
   hard cap of 2 auto-fix iterations, then STOP and surface a chat
   warning listing the unresolved finding(s) so the user can intervene.
4. **Checkpoint** (MANDATORY):
   `apex-recall checkpoint <project> 4 phase_5_must_fix_applied --json`.

**Unattended mode (`APEX_UNATTENDED=1`)**: skip auto-apply; defer all
`must_fix` per adversarial-review-protocol section 2d (the unattended
orchestrator owns mandatory-fix handling for benchmark runs).

## Stage 2 — Interactive `should_fix` decisions (same chat session)

Only `should_fix` findings carry trade-offs (cost vs reliability,
coverage vs ingestion, etc.) where the user must choose. Run the
**Per-Finding Decision Protocol** from
`.github/skills/azure-defaults/references/adversarial-review-protocol.md`
on the remaining `should_fix` set only:

- **Sources merged for the panel** (per protocol section 2e): in this
  order — `challenge-findings-plan.json` (default single-pass) **or**
  `challenge-findings-plan-pass1.json` → `pass2.json` (deep-review path;
  omit passes that did not run), filtered to `severity == "should_fix"`
  only. `must_fix` are excluded because Stage 1 already resolved them.
- **Sidecar**: append (never overwrite) the same
  `agent-output/{project}/challenge-findings-plan-decisions.json` that
  Stage 1 created (`artifact_type: "plan"`).
- **Panel cap** (protocol section 2f): still 12 questions max; if
  `should_fix > 12`, auto-defer the overflow with the standard note.
- **Single batched `askQuestions` call** with one question per
  `should_fix`, four-option payload per protocol section 2g
  (recommended = `Defer` for `should_fix`).
- After the user replies, apply every Accepted finding's edit via a
  **single `multi_replace_string_in_file` call** (same revision workflow
  as Stage 1), then re-run the relevant challenger passes
  (`overwrite: true`) once to verify the should_fix edits did not
  introduce new `must_fix`. If they did, return to Stage 1 (within the
  2-iteration cap).
- **Checkpoint** (MANDATORY):
  `apex-recall checkpoint <project> 4 phase_5_should_fix_decided --json`.

## Stage 3 — Final proceed gate

Present the final aggregated summary (counts of accept/reject/defer/edit
for must_fix + should_fix) and the handoff to the appropriate CodeGen
agent (Bicep or Terraform based on `decisions.iac_tool`).
