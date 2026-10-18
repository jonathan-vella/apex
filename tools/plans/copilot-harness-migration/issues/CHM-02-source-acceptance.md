## CHM-02: reconcile source acceptance and baseline failures

**Historical completed packet:** GitHub #771 remains CLOSED.
Retain the original scope and evidence below; the 2026-10-18 PRD supersedes its future routing assumptions.
CHM-17 owns fresh source acceptance after simplification. A historical pass does not certify the new candidate.

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#771](https://github.com/jonathan-vella/apex/issues/771).
Requirements: R1, R2, R5, R7. Priority: P0. Depends on: CHM-01 (#769).
Suggested executor: validation agent. No production worker execution or project-state mutation.

### Objective and inputs

Produce current, revision-bound source acceptance evidence for the existing migration.
Use baseline commit `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`, CHM-01's result, current instructions,
`package.json`, `AGENTS.md`, native SDK contract tests, and the PR's historical validation claims.
Do not treat reported test totals as a fresh run.
Use pre-migration parent `05c2ac85` as well: the initial migration commit alone cannot prove
that a failure predates this migration.

### Allowed scope

Run existing validators and tests; write a redacted evidence report to a caller-approved output path.
Use safe isolated worktrees or snapshots for baseline comparisons.
Do not overwrite user work, restore project state, edit `00-session-state.json`, weaken checks,
or directly lint `agent-output/**`. Any production fix needs a separate bounded packet.

### Activities

1. Inventory current source and regression coverage for archive exclusions, canonical manual skills,
   registries, routing topology, leaf restrictions, native forms, hooks, and review/approval integrity.
2. Run focused checks first: agent/model/registry checks, MCP and VS Code validation, handoff,
   question-batching and review-ceiling checks, hooks, native SDK contracts, and affected Python tooling.
3. Escalate to `npm run validate:all` and the relevant test suites once the targeted checks establish readiness.
4. Run formatting and repository-link checks with bounded log capture.
5. Compare pre-migration, initial migration, and candidate snapshots with equivalent inputs,
   without mutating the preserved Eventdesk or Nordic Foods state. Record input hashes where applicable.
   Classify each as regression, independently reproduced baseline failure, unavailable prerequisite, or unknown.
   If equivalent project inputs cannot be obtained safely, retain an unknown classification.
6. Verify all candidate changes have appropriate coverage; return bounded follow-up tasks for actual gaps.

### Acceptance criteria

- [ ] Candidate revision, environment, commands, exit codes, and evidence paths are recorded.
- [ ] Source contract areas listed above have explicit pass/fail evidence.
- [ ] The reported Eventdesk failures and link failures have baseline evidence or remain unresolved.
- [ ] No migration-introduced failure is unexplained or silently waived.
- [ ] Non-green repository-wide results are clearly separated from passing migration-specific checks.
- [ ] Required checks that cannot run remain blocking, with their exact missing prerequisites.
- [ ] No existing user/project state was changed to obtain a pass.

### Validation and return

Use the existing `npm run` scripts; do not add a new validation framework.
Return a source acceptance matrix, commands and exit codes, baseline/candidate failure comparison,
and explicit prerequisites for CHM-03 and CHM-05.
Do not claim runtime readiness from static success. A required unresolved runtime-contract defect blocks handoff.
Pre-existing unrelated failures need a recorded owner disposition, not an invented green result.
