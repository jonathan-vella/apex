## CHM-04: exercise native forms, continuation, reviews, and human gates

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#772](https://github.com/jonathan-vella/apex/issues/772).
Requirements: R3, R4, R5. Priority: P0. Depends on: CHM-03 (#773), CHM-05 (#775).
Suggested executor: human-assisted workflow validation agent.

### Objective and inputs

Execute the current non-deploying Steps 1-2 smoke procedure in
`tools/tests/integration/smoke-run.md`, collecting actual runtime observations and a native session capture.
Use verified routing from CHM-03, verified environment prerequisites from CHM-05, current graph/review rules,
and a recorded candidate revision. Historical baseline: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Prerequisites and allowed writes

Obtain fresh operator approval for a dedicated smoke project, Azure read scope if needed, costs/budget,
and a cutoff. The operator selects `01-Orchestrator`; only that interactive parent dispatches main workers.
Allow only that approved project's artifacts, `apex-recall` state, and caller-approved evidence storage.
Do not use or reset Eventdesk, Nordic Foods, or another existing project's state.
Do not advance into Governance, CodeGen, or deployment.

### Activities

1. Recheck current worker readiness before any execution; prior-session readiness is not transferable.
2. Exercise the canonical native form with independently typed fields and record rendered/returned values.
3. Exercise parent-mediated `USER_INPUT_REQUIRED` with stable request identity and same-worker continuation.
4. Test finding decisions including accept, reject, defer, edit/freeform, skipped input, and cancellation.
   Use isolated control cases; never mark real blockers resolved merely to continue testing.
5. Observe that decline does not approve and cancellation stops. Test directly selected step interaction separately.
6. Complete the approved Requirements path with its independent review and a separate Gate 1 decision.
7. After explicit approval and verified readiness, run Architecture with comprehensive and independent
   cost-feasibility reviews. Check stale/missing review and must-fix blocking behavior using safe fixtures.
8. Exercise an explicitly resumed execution whose first execution tool successfully calls `apex-recall show`.
9. Stop at Gate 2, preserve the handoff, and close the selected capture. A later resume requires another closure.

### Acceptance criteria

- [ ] Native typed forms and direct/delegated interaction modes have recorded observations.
- [ ] Same-worker continuation preserves answers and request identity without duplicate questioning.
- [ ] Decline, cancellation, and per-finding decisions preserve their distinct semantics.
- [ ] Requirements and both mandatory Architecture review modes have valid independent evidence.
- [ ] Explicit Gate 1 approval and the Gate 2 stop are separate from worker completion.
- [ ] A resumed execution has successful first-tool recall recovery.
- [ ] Only the approved smoke project changed; no Governance, CodeGen, or deployment ran.
- [ ] The exact native capture path, candidate revision, approved scope, and manual observations are returned.

### Return and stop conditions

Return a redacted observation matrix, approved artifact paths, native capture path for CHM-06,
and unresolved findings. Preserve existing review verdicts and attempt accounting.
Stop on missing approval, readiness failure, unavailable required reviewers/tools, unresolved blockers,
or the operator cutoff. Never fabricate findings or treat this issue as approval to cross a gate.
