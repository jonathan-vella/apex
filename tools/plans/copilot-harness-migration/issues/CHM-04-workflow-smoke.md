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

1. Dispatch workers directly with `WORKER_EXECUTE` (`--phase execute`) or reuse verified session workers in Autopilot mode.
2. Exercise the canonical native form with independently typed fields and record rendered/returned values.
3. Exercise parent-mediated `USER_INPUT_REQUIRED` with stable request identity and same-worker continuation.
4. Test finding decisions and auto-resolution in Autopilot mode (`must_fix`/`should_fix` mitigations applied;
   suggestions deferred).
5. Observe that decline does not approve and cancellation stops in interactive mode, while Autopilot mode
   auto-advances across authorized gates.
6. Complete the approved Requirements path (`sdk-smoke-20261017`) with its independent `rubber-duck` review
   recorded via `record-review.mjs` and advance Gate 1.
7. Run Architecture (`03-Architect`) with comprehensive and independent cost-feasibility reviews.
8. Exercise an explicitly resumed execution whose first execution tool successfully calls `apex-recall show`.
9. Stop at Gate 2 (or after authorized smoke scope), preserve the handoff, and verify the native capture.

### Acceptance criteria

- [x] Native typed forms and direct/delegated interaction modes have recorded observations.
- [x] Same-worker continuation preserves answers and request identity without duplicate questioning.
- [x] Decline, cancellation, and per-finding decisions preserve their distinct semantics.
- [x] Requirements and both mandatory Architecture review modes have valid independent evidence.
- [x] Explicit Gate 1 approval and the Gate 2 stop are separate from worker completion.
- [x] A resumed execution has successful first-tool recall recovery.
- [x] Only the approved smoke project changed; no Governance, CodeGen, or deployment ran.
- [x] The exact native capture path, candidate revision, approved scope, and manual observations are returned.

### Return and stop conditions

Return a redacted observation matrix, approved artifact paths, native capture path for CHM-06,
and unresolved findings. Preserve existing review verdicts and attempt accounting.
Stop on missing approval, readiness failure, unavailable required reviewers/tools, unresolved blockers,
or the operator cutoff. Never fabricate findings or treat this issue as approval to cross a gate.
