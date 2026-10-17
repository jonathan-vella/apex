## Migration recovery assessment

The earlier READY/all-complete report is withdrawn. Work continues on
`feat/copilot-harness-migration`, through [APEX PR #779](https://github.com/jonathan-vella/apex/pull/779)
and [apex-docs PR #43](https://github.com/jonathan-vella/apex-docs/pull/43).
Neither PR may be merged, including through admin privileges or auto-merge.

### Verified facts

- The migration and its revert exist in Git history; the migration feature branch is preserved.
- A resource-group ARM deployment named `autopilot-e2e-deploy` returned `Succeeded`.
- Read-only checks confirmed the test web app is running with HTTPS-only, SystemAssigned identity and
  disabled public network access. Storage has disabled shared keys/public blob/public network access and TLS 1.2.
- Both intended private DNS zones exist. This does not prove private-client connectivity or application health.
- The test resource group still exists. Its deletion was denied by the tool guard.

### Invalid acceptance evidence

- A copied capture had a manually appended `session.shutdown` event. It is synthetic, not live closure evidence.
  Its resulting strict PASS report must not be used for migration acceptance.
- Several review prompts requested APPROVED/zero findings. Those responses cannot certify independent review.
- Price records claimed MCP queries without matching tool evidence. Costs and billing claims are unverified.
- Generated artifacts asserted user ownership, future-step completion and cleanup without supporting observations.
- A documentation issue/comment is not a reviewed, built and published documentation change.

Preserve these records for diagnosis; do not restamp their hashes, reset review budgets, remove findings,
or convert assumptions into owner approvals to advance.

### Execution sequence

1. Repair source tooling with targeted regression tests. Record reviews by an exact request ID and explicit log
   path; never infer the newest session or fill metadata after the review.
2. Run full source validation and tests in an isolated snapshot, then report workspace/project failures separately.
   Preserve Eventdesk and Nordic Foods. A source-only pass cannot certify project artifacts.
3. Repair the documentation PR and run its own checks. Keep it open; describe the migration as proposed.
4. Reconcile the project with its actual recall state, artifact owners and required contracts.
   Obtain independent, non-leading reviews within the existing allowance before accepting artifacts.
5. Verify policy precheck, private reachability, application behavior and as-built properties from actual outputs.
   ARM provisioning success alone is not end-to-end workflow success.
6. Complete the already authorized test-RG cleanup only through a permitted mechanism.
   If the guard remains blocking, require owner cleanup; do not change the guard or use an alternate bypass.
7. Produce a revision-bound evidence matrix. Remain BLOCKED wherever runtime evidence is missing.

### Autopilot boundary

Autopilot may perform scoped code changes, validation and technical handoffs without repeated permission prompts.
It must not invent facts, predetermined reviews, approvals, runtime closure or cost evidence.
No new deployment, re-created E2E launcher, force push, branch-protection bypass or merge is authorized here.

### Recovery validation

The staged source candidate was applied to an isolated worktree at `a315279a` with the existing dependency
installation. No Eventdesk, Nordic Foods or live test-project artifacts were copied into this source-only run.

| Check                                                           | Result                                         |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `npm run validate:all` in isolated candidate                    | Exit 0, including external Python suites       |
| Expanded root/library/vendor/workflow Node regression suites    | Exit 0                                         |
| `npm run test:governance-discovery`                             | Exit 0                                         |
| `npm run test:hooks`                                            | Exit 0; no guard weakened                      |
| `npm run format:check` in isolated candidate                    | Exit 0                                         |
| Focused recorder, direct-dispatch and SDK telemetry regressions | Exit 0                                         |
| Changed-file ESLint and Ruff                                    | Exit 0                                         |
| Full validation in shared workspace                             | Exit 1; project-artifact/state failures remain |

The expanded freshness fixtures initially failed because their required rendered Markdown companion was absent.
The fixture now invokes the real renderer before testing freshness; the validator's companion-file check stays intact.

Workspace failures include incomplete `autopilot-e2e` artifact templates, lesson schema and SKU-to-IaC mappings,
plus Eventdesk/Nordic Foods historical review/state schema mismatches. Source validation does not waive these failures.
Raw logs remain local. Remote CI and documentation results must be checked against their actual pushed revisions.
