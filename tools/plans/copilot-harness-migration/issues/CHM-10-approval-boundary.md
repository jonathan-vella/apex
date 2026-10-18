## CHM-10: prove genuine consequential approval

GitHub: [#781](https://github.com/jonathan-vella/apex/issues/781).
Requirements: R2, R3, R11. Priority: P0. Depends on: CHM-03, CHM-05 and owner plan approval.
Status: proposed packet. Scope is harmless no-op execution, not deployment.

### Objective and inputs

Choose and prove the smallest genuine human approval boundary that native Autopilot cannot author itself.
Use actual VS Code Autopilot/tool behavior and current approval/risk/deploy contracts.
Ask the owner to choose protected execution/independent approval or a controlled non-Autopilot operator context.
Agent visibility, an environment flag, form result or reviewer verdict is not credential separation.

### Allowed changes and expected behavior

Isolated no-op action/approval fixtures and the bounded adapter needed to demonstrate the selected boundary.
Read deploy/diagnostic roles, `risk_gate.py`, risk schemas/evaluator and trust-contract docs.
No real credentials, Azure operations, production approval-policy change or protection bypass.
Routine implementation/testing runs autonomously after approval; actual authority choices stay human.

### Validation

Run `node --test tools/tests/scripts/test_risk_authorization.mjs` and
`python3 -m pytest tools/apex-recall/tests/test_risk_gate.py -q` on fixtures.
Then observe the actual no-op action allowed/denied by the independently controlled approval path.
Bind action, target, candidate/plan hash, approver provenance and expiry; use existing contracts where suitable.
Test missing/stale/tampered/expired/revoked/wrong-target approvals, model-generated "yes", decline,
cancellation, unrecognized freeform answer and engineering access to the same write path.
Invocation flags are tested as behavior metadata, not the only enforcement mechanism.

### Acceptance and evidence

- [ ] Owner-selected boundary and credential/access assumptions are explicit.
- [ ] An independent approval permits only the exact harmless scoped action.
- [ ] Autopilot cannot mint an equivalent approval or invoke an unrestricted parallel action path.
- [ ] Both deploy tracks have the same consequential outcome, with track-specific constraints preserved.
- [ ] Diagnostic/remediation side effects and their parent-mediated approval channel obey the same boundary.
- [ ] No lab exception or reviewer result becomes ordinary deployment authority.

Return contract, real no-op approval/denial evidence, tests and any weaker-assurance limitation.
Stop if isolation/actor provenance is unavailable; do not label prose separation enforced.
Rollback only introduced fixtures/adapter changes. No merge, auto-merge, deployment or cleanup authorization.
