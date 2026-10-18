## CHM-14: simplify durable state behind compatible readers

GitHub: [#785](https://github.com/jonathan-vella/apex/issues/785).
Requirements: R5, R9. Priority: P1. Depends on: CHM-13.
Status: proposed implementation; no existing project-state mutation.

### Objective and inputs

Keep durable project choices, findings, reviewed input identities and real approval references while moving
routine session task tracking to native todos/SQL.
Use `tools/apex-recall`, state/risk schemas, handoff renderer, gate consumers and existing historical fixtures.
The native session store is not cross-project business authorization.

### Allowed scope and behavior

One API/responsibility slice at a time in recall source/docs/tests and directly dependent tools/readers.
Keep the facade initially; avoid two authoritative records.
Preserve atomic revision-safe writes, stale-evidence rejection, explicit recovery and committed-but-index-stale
handling. Search/index retirement needs demonstrated value/caller analysis, not an assumption.
Preserve externally trusted risk exception semantics unless separately approved.
`evaluate-risk-authorization.mjs` has a Python subprocess caller in `risk_gate.py`; it is not an npm orphan.

### Validation and negative cases

Run `python3 -m pytest tools/tests/test_apex_recall/ tools/apex-recall/tests/ -q` and
`node --test tools/tests/scripts/test_validate_session_state.mjs
tools/tests/scripts/test_session_handoff.mjs tools/tests/scripts/test_risk_authorization.mjs`.
Use synthetic old/new fixtures only.
Test partial write, revision conflict, committed/index-failed outcome, explicit recovery, stale review,
revoked/expired/wrong-scope approval and reopening a prerequisite.
No normal read may silently restore backups or elevate approval.

### Acceptance and evidence

- [ ] Durable state and session task data have distinct owners and scope.
- [ ] Historical reads and fixture round trips work; protected project digests are unchanged.
- [ ] Atomicity/conflict/recovery and approval trust tests pass.
- [ ] Unresolved findings survive; accepted decisions are not silently treated as closure.
- [ ] Each simplified command/view has caller/docs compatibility and rollback coverage.

Return API/data ownership map, fixture evidence, tests and revision/rollback boundary.
Stop on trust-boundary ambiguity, required destructive migration or production-state access.
No merge, auto-merge, counters reset, hash restamping or cloud actions.
