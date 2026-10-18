## CHM-04: prove the representative no-cloud pilot

GitHub: [#772](https://github.com/jonathan-vella/apex/issues/772).
Requirements: R3, R4, R5, R10, R11. Priority: P0. Depends on: CHM-03, CHM-05, CHM-10.
Status: BLOCKED pending owner plan approval and prerequisite evidence.

### Objective and inputs

Prove the simpler lead/skill/reviewer architecture before changing the fleet.
Use CHM-03 native capabilities, CHM-05 relevant tool/hook results, CHM-10 no-op approval boundary,
fixed synthetic Azure-like requirements/plan inputs and a finite expected-output rubric.
The old Steps 1-2/handshake smoke contract is historical input, not the target acceptance standard.

### Allowed scope and expected behavior

Only isolated synthetic fixtures, a short optional lead, one on-demand domain skill, bounded independent
review and deterministic local validation. No Azure reads/writes, project-state mutation or real credentials.
The interactive parent owns material questions. A delegated task may return a small missing-input request.
Routine editing/testing/repair continues in native Autopilot; no compulsory WORKER_READY/log replay.

### Validation and negative cases

1. Run the finite task and test actual output shape, required content and allowed-path constraints.
2. Verify independent review can return blockers; never request APPROVED or zero findings.
3. Exercise missing input, malformed output, missing reviewer, stale input and accepted-but-unfixed finding.
4. Exercise bounded repair/retest, native continuation or explicit one-shot replacement, compaction and restart.
5. Test decline/cancel/no-answer and the independently approved no-op action from CHM-10.
6. Confirm no real project artifacts, write credentials or cloud actions were used.

Use native observations and deterministic fixture assertions.
Use existing parser/state tests only for code actually changed; a source fixture pass is not pilot acceptance.

### Acceptance and evidence

- [ ] The task meets its rubric without the numbered agent chain.
- [ ] Bounded native review/input/recovery paths work; all required negative cases are visible.
- [ ] Autopilot cannot self-authorize the consequential no-op action.
- [ ] Real result/capture scope and candidate inputs are recorded without fabricated events.
- [ ] Owner accepts the pilot before CHM-11 through CHM-16 implementation begins.

Return exact fixture revisions, outputs, observations, tests, gaps and proposed architecture corrections.
Remove only named fixtures after evidence preservation; preserve historical production contracts.
Stop on missing authority/capability, unresolved blocking findings or bounded recovery exhaustion.
No deployment, merge, auto-merge, credential switching or automatic issue closure.
