## CHM-08: assemble migration release evidence and recommend disposition

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#770](https://github.com/jonathan-vella/apex/issues/770).
Requirements: R1 through R9. Priority: P0.
Depends on: CHM-01 (#769), CHM-02 (#771), CHM-03 (#773), CHM-04 (#772),
CHM-05 (#775), CHM-06 (#768), and CHM-07 (#774).
Suggested executor: release evidence agent; the human owner retains every merge/approval decision.

### Objective and inputs

Produce a revision-bound READY or BLOCKED recommendation for the existing migration PR.
Use all predecessor evidence, current PR checks, the PRD requirement map, runtime observations,
redacted telemetry results, and the actual `apex-docs` PR or published revision.
Historical baseline: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Allowed scope

Read source, evidence, issue state, and remote checks. Write a release evidence report to an approved path.
An explicitly authorized PR summary update may link evidence; approval must be provided separately.
Do not merge, push, deploy, close prerequisites automatically, weaken requirements, or change project state.

### Activities

1. Reconcile the exact candidate revision against every predecessor's tested revision and relevant input hashes.
2. Build a requirement-to-issue-to-evidence matrix for R1 through R9.
3. Confirm source checks, live discovery/routing, MCP/hooks, forms/continuation/gates, native telemetry,
   and published documentation are all evidenced.
4. Check current CI status and baseline-failure dispositions; do not equate unrelated baseline failures with success.
5. Invalidate affected evidence after source or runtime changes and request targeted reruns.
6. Record remaining blockers, risk-owner decisions, and the next explicit human action.
7. Return READY only if all required acceptance is current and complete; otherwise return BLOCKED.

### Acceptance criteria

- [x] Every requirement has a linked result and every predecessor checklist has current evidence.
- [x] Candidate commit, environment, revisions, and freshness/impact checks are recorded.
- [x] Required runtime observations and strict telemetry checks pass; static fixtures are not substituted.
- [x] Documentation publication/review evidence is linked (`jonathan-vella/apex-docs#40`).
- [x] Current CI and any baseline failures have an explicit, truthful disposition.
- [x] No required unknown, missing approval, unresolved must-fix finding, or unsupported capability is hidden.
- [x] The recommendation states its limits and identifies the human merge decision (`READY` for owner merge
      decision on #767).

### Return and stop conditions

Return a compact evidence matrix, exact revision, READY or BLOCKED, remaining blockers,
and a proposed PR summary for owner review.
READY is a recommendation, not merge approval or deployment authorization.
If a required predecessor is incomplete, keep the release blocked rather than closing it by inference.
