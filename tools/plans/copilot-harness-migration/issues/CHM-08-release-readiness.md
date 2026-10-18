## CHM-08: assemble owner readiness handoff

GitHub: [#770](https://github.com/jonathan-vella/apex/issues/770).
Requirements: R1 through R12. Priority: P0.
Depends on: CHM-07, CHM-17 and all applicable open predecessor packets in the current backlog.
Status: BLOCKED; owner plan approval and runtime/implementation evidence are outstanding.

### Objective and inputs

Return a truthful requirement-to-packet-to-evidence matrix for APEX #779 and `jonathan-vella/apex-docs#43`.
Use the final source/docs heads, actual remote checks, relevant reviewed input hashes, runtime observations,
negative tests, retirement caller closure and unresolved review-thread dispositions.
CHM-01/#769 and CHM-02/#771 are historical evidence, not final-candidate passes.

### Allowed scope and activities

Read candidate/evidence/issue/PR state; write a compact readiness report and update the existing PR summary.
Do not merge, enable auto-merge, close issues automatically, deploy, rewrite findings, restamp evidence or
repair production projects to obtain a green matrix.

1. Reconcile R1-R12 and every applicable packet with its actual tested revision and input scope.
2. Verify native VS Code Copilot E2E, consequential no-op approval boundary and current source checks.
3. Verify historical compatibility, active caller cleanup and required Azure-domain outcomes.
4. Verify actual docs build/review on its feature head; publication remains a separate forbidden action here.
5. Invalidate only affected evidence after changes and request targeted reruns.
6. Record unresolved findings, review threads, baseline failures, unknowns and required owner decisions.

### Acceptance and negative cases

- [ ] Every required outcome has current evidence; optional unknowns are explicitly separated.
- [ ] No source fixture, old capture, model label or self-authored form substitutes for runtime/owner evidence.
- [ ] Both PR heads/checks and review dispositions are current.
- [ ] Closed historical work is not reopened or credited as a fresh candidate run.
- [ ] No retired active caller, missing approval or unresolved must-fix is hidden.
- [ ] The recommendation is READY_FOR_OWNER_REVIEW or BLOCKED, with reasons and next action.

Test stale candidate/evidence, missing predecessor, unresolved review, docs/core drift and false green source-only
claims. Required missing/failed evidence returns BLOCKED.
Return the matrix, exact heads/checks, blockers and owner handoff.
This packet has no automatic merge, publishing, deployment or cleanup path, even when all checks pass.
