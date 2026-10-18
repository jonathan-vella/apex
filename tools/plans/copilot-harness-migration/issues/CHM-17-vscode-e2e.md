## CHM-17: accept final VS Code Copilot E2E and source candidate

GitHub: [#788](https://github.com/jonathan-vella/apex/issues/788).
Requirements: R1 through R12. Priority: P0. Depends on: CHM-05, CHM-06, CHM-16.
Status: proposed final runtime gate; no real-Azure deployment is included.

### Objective and inputs

Verify the resulting target, not the historical roster or initial pilot.
Use exact source revision, actual installed client/SDK/tool metadata, accepted replacement contracts,
CHM-06 evidence handling, current source tests and independent no-op approval boundary.
Historical CHM-01/CHM-02 completion and previous green CI do not satisfy this candidate gate.

### Allowed scope and expected behavior

Fresh owner-scoped synthetic project/evidence storage outside existing production projects;
approved temporary fixture changes and existing local validation commands only.
Run a genuinely new Copilot target session in VS Code, with routine work in native Autopilot.
No Azure calls/write credentials, retired E2E launcher, existing project-state repair or fabricated capture.

### Validation and negative cases

1. Exercise actual entry/skill discovery, finite authoring, deterministic validation and independent review.
2. Exercise missing input, malformed output, unavailable reviewer/tool, denied action and stale review.
3. Prove the no-op consequential action needs independent approval; decline/cancel never grants it.
4. Exercise compaction/restart, supported continuation and one-shot recovery without losing decisions/findings.
5. Verify required Azure-domain outcomes with local fixtures: security, SKU/AVM, policy and cost provenance.
6. Run targeted source suites, then `npm run validate:all`, relevant expanded tests and current remote CI.
   Use equivalent safe snapshots for baseline comparison; do not alter untracked project evidence.
7. Verify retired routes stay inactive and historical compatibility readers still work.

### Acceptance and evidence

- [ ] Final revision and actual VS Code Copilot mode are recorded; unknown versions are not invented.
- [ ] Positive/negative behavior, source validation and true independent approval observations are linked.
- [ ] Required failures/unknowns remain BLOCKED; optional usage is UNKNOWN, not a false zero.
- [ ] Workspace/project baseline failures are disclosed with attribution or unresolved status.
- [ ] No cloud side effects, fabricated events, predetermined review or historical evidence repair occurred.
- [ ] CHM-07/CHM-08 receive the actual source head, capture scope, tests, checks and remaining blockers.

Return source/runtime evidence matrix and owner handoff; rerun affected observations after fixes.
Clean up only named fixtures, preserving raw evidence locally. Stop for permission, capability or bounded-repair failure.
No merge, auto-merge, publication, deployment or cleanup permission is implied by acceptance.
