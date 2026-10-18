## CHM-05: verify MCP projection and retire deleted runtime hooks

GitHub: [#775](https://github.com/jonathan-vella/apex/issues/775).
Requirements: R2, R11. Priority: P0. Depends on: CHM-09.
Status: implementation authorized; owner intentionally retired repository agent runtime hooks.
The historical filename remains for link compatibility, not a requirement to provide hooks.

### Objective and inputs

Confirm required VS Code Copilot MCP projection and complete caller cleanup for the owner's hook deletions.
Use current tool contracts, `.vscode/mcp.json`, workspace/devcontainer settings and actual surviving tests.
Do not restore deleted scripts/manifests or build a replacement guardian.

### Allowed scope

Retired `.github/hooks/` files, their registrations, hook-only validators/tests/commands,
startup/CI references and truthful documentation.
Keep Git Lefthook checks, secret/dependency scanning, IaC security/governance and unrelated tooling.
No credentials, shared-service restart, Azure operation or protection change.

### Activities and validation

1. Preserve the exact intended runtime hook deletions and remove dangling registrations.
2. Retire runtime-only validator/Bats assertions; retain Git-hook tests under `test:git-hooks`.
3. Verify invalid/malformed configuration and enabled retired registrations still fail structural tests.
4. Observe required MCP tool projection without assuming authenticated operation success.
5. Disclose lost regex command/self-modification and advisory-result checks; native permissions are not
   claimed equivalent. Missing deleted-hook delivery is not a migration blocker.

Run `npm run lint:mcp-config`, `npm run validate:vscode`, `npm run test:git-hooks`
and focused devcontainer/lint/validator-runner tests.
Negative cases include stale registrations, malformed settings, broken npm caller and missing tool.
No destructive operation or hook-bypass demonstration is needed.

### Acceptance and evidence

- [x] Deleted runtime hooks remain absent with no active registration/caller.
- [x] Surviving Git hooks and unrelated security/build checks still run.
- [ ] Relevant projection is observed; authenticated operations not exercised stay explicitly unverified.
- [x] Advisory approval-token injection is removed by retiring the mutating hook, not by restoring its patch.
- [x] Source, tests, CI, settings and documentation agree; native-equivalence claims are absent.

Return actual paths, commands/exit codes, projected capabilities, limitations and review-thread evidence.
A rollback must not restore owner-deleted hooks without new authorization.
Required consequential permission failures block that action, not independent engineering.
No merge, auto-merge, cloud write/delete, credential switch or project-state repair.
