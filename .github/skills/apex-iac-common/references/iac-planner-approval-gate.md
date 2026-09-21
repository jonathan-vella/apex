<!-- ref:iac-planner-approval-gate-v1 -->

# IaC Planner — Approval Gate (Phase 5)

Detailed prose for the 05-IaC Planner Phase 5 approval gate. The agent
references this file rather than inlining the full text.

Apply the canonical [review lifecycle](../../apex-azure-defaults/references/adversarial-review-protocol.md#review-lifecycle)
before the step-specific stages below. Verify proposed mitigations; automatic must-fix repair does not authorize redesign.

## Stage 1 — Auto-apply every `must_fix` (mandatory)

All `must_fix` findings would block deployment, violate the security
baseline, or break a hard governance constraint. They are **not
negotiable** and **must not** be presented as user choices.

For every `must_fix` finding across all passes:

1. Apply the `suggested_fix.proposed_edit` (formerly `suggested_mitigation`)
  to `04-implementation-plan.md` using available targeted editing tools,
  including `apply_patch`. Batch independent fixes where practical, preserve
  user work, and validate before dependent follow-up edits. Do NOT re-emit
  the plan via `create_file`; see the apex-azure-artifacts "Revision Workflow".
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
`must_fix` per adversarial-review-protocol section 2d and STOP before completion or forward handoff
while any remains unresolved. No unattended setting waives this gate.

## Stage 2 — Interactive `should_fix` decisions (same chat session)

Only `should_fix` findings carry trade-offs (cost vs reliability,
coverage vs ingestion, etc.) where the user must choose. Run the
**Per-Finding Decision Protocol** from
`.github/skills/apex-azure-defaults/references/adversarial-review-protocol.md`
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
- After the user replies, apply every Accepted finding's edit with available
  targeted editing tools (same revision workflow as Stage 1), then re-run the relevant challenger passes
  (`overwrite: true`) once to verify the should_fix edits did not
  introduce new `must_fix`. If they did, return to Stage 1 (within the
  2-iteration cap).
- **Checkpoint** (MANDATORY):
  `apex-recall checkpoint <project> 4 phase_5_should_fix_decided --json`.

## Stage 3 — Final proceed gate

Present the final aggregated summary (counts of accept/reject/defer/edit
for must_fix + should_fix) and the handoff to the appropriate CodeGen
agent (Bicep or Terraform based on `decisions.iac_tool`).

### Preserved confirming reviews

Resolve the review path before presenting approval. If a separately authorized default-mode comprehensive
confirmation was saved as `challenge-findings-plan-pass<N>.json` (N greater than 1), retain the original
`challenge-findings-plan.json` and use the confirming file explicitly at completion. Do not copy a clean review over
history, restamp stale hashes, infer the newest filename or switch to deep mode because its filename contains `pass2`.

Validate the selected review with `node tools/scripts/validate-challenger-findings.mjs --verify-cache <review-path>`.
After explicit human approval, complete with:

```bash
apex-recall complete-step <project> 4 \
  --plan-review agent-output/<project>/challenge-findings-plan-pass<N>.json \
  --plan-review-reason "<actual confirmation authorization and recorded approval reference>" --json
```

`transition --complete` accepts the same flags only when starting the next step is separately approved. The selector
is Step 4/default-comprehensive-only and validates the same-project file, pass, artifact, lens and strict freshness.
It records the selected filename, byte hash and reason in the completion write. Deep-review lens replacement remains
unsupported; stop for owner resolution instead of weakening that contract. Selection grants neither a review-budget
reset nor human approval. It cannot combine with a Governance selector or missing-review bypass.
New successful selections persist as `review-selection-v1` in `review_selections`; `show --json` exposes revalidated
`session.effective_reviews`. Legacy audit prose is never parsed into selection. Explicitly select it once through
the existing owner completion path; unchanged subsequent completion returns `already_applied`. Do not retry mutations
after `committed_but_index_stale`; repair the index with explicit `reindex` instead. Conflicts require rereading state.

If a tooling failure occurs after human approval, retain that approval and resume completion against unchanged
validated inputs without asking the same approval again. `plan_status=APPROVED` is not completed Step 4; require
successful `complete-step` before updating completion status or handing off to CodeGen. Keep reviewed plan/contract
bytes frozen; update only recall, the project index and compact handoff after successful completion.

### Post-completion handoff checks

Keep the canonical `00-handoff.md` headings: Completed Steps, Key Decisions, Open Challenger Findings (must_fix only),
Context for Next Step, Skill Context, Artifacts. Put locked inputs and review evidence under those sections; do not
replace them with custom Status, Locked Plan, Review Evidence or Next Action headings. Keep the handoff below 60 lines.
Editor diagnostics and a line-width scan do not verify this artifact contract. Run these explicit agent-safe checks
after the final README/handoff edit, from the verified workspace root:

Prefer `node tools/scripts/render-session-handoff.mjs --project <project> --owner "<exact agent name>" --operation
"<authorized scope>"` to preview the canonical handoff. `--write` is an explicit edit; replacing an existing handoff
requires `--expected-sha <current file SHA>`. Review user-owned content before authorizing replacement. Overflow or
unresolved selected evidence blocks rendering; reconcile the owner inputs instead of dropping blockers.

```bash
npm run check:h2-order -- <project> README.md
npm run check:h2-order -- <project> 00-handoff.md
test "$(wc -l < agent-output/<project>/00-handoff.md)" -lt 60
```

Inspect each exit result before claiming success. If handoff validation fails after successful completion, repair
only the handoff; do not rerun completion, reopen approval or edit reviewed inputs. Verify Step 5 remains pending
when the user requested a stop before CodeGen. Preserve selected-review paths and compare reviewed input hashes.

### Phase-aware final checks

Before approval, run the explicit-path contract, consistency, policy-map and environment-manifest validators from
the [pre-review feasibility gate](contract-emission-and-handoff.md#step-4--pre-review-feasibility-gate), plus current
review verification. Confirm valid Governance evidence separately. `validate:governance-trace -- --project <project>`
checks the full L0-L3 chain; it is not a Step 4 completion gate because L2 CodeGen and L3 Deploy do not exist yet.
Use `--through L1` for the explicit design-only trace; the default full-chain check remains required at its owner phase.
Do not call that full-chain failure a pass or add `--allow-legacy` to bypass missing future attestations.

Record executed review invocations separately from filename/pass labels: a later pass number is not the total
review count across revisions or sessions. Preserve existing audit entries and exhausted repair allowances; a
confirmation does not reset either. Reuse available unchanged skill content rather than repeatedly loading it.
For new invocations use `review-audit --attempt-id <id> --attempt-kind invocation --input-digest <sha256>
--attempt-outcome started` before dispatch, then record the actual terminal outcome with the same identity/input.
The command records evidence, not permission to invoke a worker. Unknown outcomes require owner reconciliation;
do not reuse the identity for changed inputs or infer a retry allowance. Existing historical counters remain history.

New reviews can obtain metadata with `validate-challenger-findings.mjs --metadata <primary> --supporting-input
<consumed-contract>`, repeating the supporting-input option for the complete consumed set. Include the emitted
`supporting_inputs` unchanged in the findings payload. Strict verification checks every declared supporting digest;
legacy reviews lacking this map do not gain that coverage automatically. Never restamp historical findings to migrate.
Resolve terminal working-directory problems using the verified workspace root before interpreting missing-file output.
For hash synchronization, use the entire tool-computed digest, not a displayed prefix or reconstructed value;
validate immediately and freeze only after every referenced hash matches.
