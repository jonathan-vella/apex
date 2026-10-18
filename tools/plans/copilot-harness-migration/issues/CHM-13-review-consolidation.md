## CHM-13: consolidate independent review and result integrity

GitHub: [#784](https://github.com/jonathan-vella/apex/issues/784).
Requirements: R5, R9, R11. Priority: P1. Depends on: CHM-15 and accepted pilot.
Status: proposed implementation; current mandatory review rules remain until approved replacement.

### Objective and inputs

Create one independent review path with actual relevant inputs, structured findings, meaningful freshness
and a small result receipt. Use automatic/manual reviewer contracts, recorder/findings/presence/ceiling tools,
decision schema and current recall gate consumers.
Ask the owner before changing the current separate architecture cost-feasibility review requirement.

### Allowed scope and behavior

Review callers and wrapper/leaf definitions; one-shot/adversarial/deep guidance; recorder/validators;
relevant schemas, state gate consumers, tests and registry references.
Deliver reader compatibility before writer migration if required.
Use native returned review results rather than compulsory exact log replay after pilot acceptance.
Retain optional incident provenance where justified; do not call agent-writable evidence tamper-proof.
Routine in-scope technical repairs can proceed with bounded revalidation; material risk choices remain human.

### Validation

Run `node --test tools/tests/scripts/test_record_review.mjs
tools/tests/scripts/test_review_presence.mjs tools/tests/scripts/test_mutable_review_inputs.mjs
tools/tests/scripts/test_step2_residue_presence.mjs` and affected recall completion/risk tests.
Test absent/stale/malformed review, leading approval request, unavailable reviewer, changed rubric,
relevant input change, irrelevant mutable state change, must-fix unresolved, accepted-but-unfixed finding,
budget exhaustion and historical manual consolidated batch output.
An advisory warning must not introduce approval/verdict tokens absent from the actual worker result.

### Acceptance and evidence

- [ ] Actual independent findings, closure and consequential authority remain separate.
- [ ] One result contract replaces duplicate paths without losing useful deep/cost checks.
- [ ] Review inputs exclude unrelated mutable parent-owned files.
- [ ] Historical readers, current unresolved findings and attempt accounting remain intact.
- [ ] PR #779 batch-output and advisory-payload feedback is fixed with negative-test evidence.

Return contract/reader matrix, tests, actual independent reviewer output and thread dispositions.
Rollback writers only with compatible readers. Stop rather than fabricate evidence, reset counters or bypass review.
No merge, auto-merge, project-history edits or deployment authorization.
