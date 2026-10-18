## CHM-01: resolve the migration CI formatting failure

**Historical completed packet:** GitHub #769 remains CLOSED.
Retain the original scope and evidence below; this is not fresh validation of the replanned candidate.
CHM-17 owns final source acceptance. Do not reopen this issue or replay its fix to advance the new plan.

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#769](https://github.com/jonathan-vella/apex/issues/769).
Requirements: R7. Priority: P0. Depends on: none.
Suggested executor: repository coding agent. Runtime or Azure work is not authorized.

### Objective and evidence

Restore the known failed formatting check without changing smoke acceptance semantics.
The main CI job at the migration baseline stopped at `npm run format:check`, reporting
`tools/tests/integration/smoke-run.md`.
Baseline commit: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Inputs

- Current repository instructions and formatting configuration.
- `tools/tests/integration/smoke-run.md`.
- The failed CI log for run `38897507084`.

### Allowed changes

Only formatter-owned changes to `tools/tests/integration/smoke-run.md`.
Do not change thresholds, approval boundaries, commands, formatter exclusions, or unrelated files.
Preserve all pre-existing local work. A further defect requires a separate scoped task.

### Activities

1. Confirm the current revision and inspect existing changes in the target file.
2. Reproduce the target formatting check using the installed project Prettier.
3. Run Prettier on that file only.
4. Run the focused formatting and Markdown checks.
5. Return the patch and evidence; do not commit, push, or rerun remote workflows without explicit authorization.

### Acceptance criteria

- [ ] Prettier reports no issue for the target file.
- [ ] Markdown lint passes for the target file.
- [ ] The patch changes formatting only and preserves every smoke threshold and human gate.
- [ ] Commands, exit codes, candidate revision, and changed paths are recorded.

### Validation and return

Use `npx --no-install prettier --check tools/tests/integration/smoke-run.md` and
`npx --no-install markdownlint-cli2 tools/tests/integration/smoke-run.md`.
Return changed paths, command results, and any remaining CI blocker.
CHM-02 owns the complete source acceptance result; this focused pass must not be reported as all CI green.
Stop if the target has conflicting user edits or the formatter would alter intended semantics.
