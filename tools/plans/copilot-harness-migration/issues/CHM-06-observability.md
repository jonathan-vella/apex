## CHM-06: verify native SDK telemetry and scoped log export

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#768](https://github.com/jonathan-vella/apex/issues/768).
Requirement: R6. Priority: P1. Depends on: CHM-04 (#772).
Suggested executor: telemetry validation agent; operator assistance is required if capture must be resumed or closed.

### Objective and inputs

Validate the existing profiler, strict smoke verifier, budget checker, and scoped export against the approved
real native capture from CHM-04. Use the exact session path and candidate revision, current
`tools/tests/integration/smoke-run.md`, native-event tests, and export/redaction guidance.
Historical baseline: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Allowed scope

Read the approved capture and write reports or redacted exports only to caller-approved evidence paths.
No project-state mutation, global newest-session discovery, unapproved log publication, or fabricated capture.
Production parser fixes require a separately scoped issue; keep raw runtime logs local.

### Activities

1. Verify the capture's exact workspace/session identity and relation to CHM-04.
2. Run existing native-event, profiler, smoke, export, and readiness-attribution regression tests.
3. Run profiler, strict smoke verification, and strict review-budget verification against the exact log path.
4. Check authoritative usage is counted once and tool/worker execution is attributed to matching calls and parents.
5. Verify shutdown followed by later resume reopens capture regardless of misleading event timestamps;
   incomplete root or operations cannot pass.
6. Verify scoped export and redaction retain required evidence without including unrelated sessions or secrets.
7. Map automated results to manual observations from CHM-04 and report disagreements explicitly.

### Acceptance criteria

The reported strict PASS is withdrawn: its copied capture contained a manually appended shutdown.
It is a synthetic test input, not evidence of native session closure.

- [ ] Native format, exact workspace/session scope, and genuine closed root capture are established.
- [ ] Every observed call has input/output usage; authoritative usage is counted once.
- [ ] Incomplete operations, unattributed usage and non-benign failures remain non-passing.
- [ ] `ask_user` count is at most 20 in the capture.
- [ ] First execution input is at most 45,000 tokens for every attributed execution.
- [ ] Default-mode review requests are attributed and within the existing allowance.
- [ ] Every explicitly resumed execution includes successful first-tool recall recovery.
- [ ] Profiler, strict smoke and strict budget checks pass on unchanged native capture.
- [ ] Export/redaction scope is verified; raw logs are not posted to GitHub.

### Validation and return

Run `npm run profile:debug-log -- <exact-events-path> --json`,
`npm run smoke:verify -- <exact-events-path> --strict`, and
`npm run validate:review-ceiling -- --budget <exact-events-path> --strict`.
Return commands, exit codes, redacted reports, threshold measurements, and blockers.
Missing evidence is UNKNOWN and non-passing, not zero or a skipped success.
Automated telemetry does not certify review validity, complete billing, approval, or deployment.
