## CHM-05: verify VS Code MCP projection and supplementary hooks

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#775](https://github.com/jonathan-vella/apex/issues/775).
Requirement: R2. Priority: P1. Depends on: CHM-02 (#771).
Suggested executor: human-assisted environment validation agent.

### Objective and inputs

Verify actual MCP and hook behavior in the supported VS Code SDK runtime rather than inferring it from files.
Use CHM-02's source results, `.vscode/mcp.json`, `.devcontainer/configure-mcp.mjs`,
`tools/scripts/validate-mcp-config.mjs`, current hook configuration, and the installed runtime.
Baseline commit: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Prerequisites and allowed scope

The operator approves read-only MCP probes, target Azure scope if applicable, and any runtime reload.
Inspect configuration and record redacted evidence; use caller-approved temporary fixtures for hook tests.
Existing `.devcontainer/devcontainer.json` changes are user work, not permission to edit.
Do not change credentials, add registrations, restart shared services, or alter production configuration.
Issue assignment alone does not authorize authenticated probes.

### Activities

1. Run existing MCP and VS Code configuration validators.
2. Observe actual projection and discoverability of GitHub, ARM CostManagement, and Azure MCP tools.
3. Run a benign approved read for each required capability; record the operation, scope, and result without secrets.
4. Confirm the effective configuration source and absence of duplicate live registrations.
   Do not create root `.mcp.json` parity just because the historical plan proposed it.
5. Record observed supported pre/post-tool hook behavior using permitted harmless operations.
   Cover denied cases through existing isolated fixtures, not destructive commands or real hook self-modification.
6. Confirm runtime approval/review enforcement does not depend on a file-based `SubagentStop` hook.
7. Return environment evidence and narrowly scoped corrective tasks for any demonstrated gap.

### Acceptance criteria

- [x] Existing configuration validators pass or exact blockers are recorded.
- [ ] Required MCP capabilities are observed in the installed VS Code runtime.
- [ ] Approved benign calls succeed for each required GitHub, ARM pricing and Azure MCP capability.
- [x] No duplicate registrations or unapproved credential/configuration changes were introduced.
- [ ] Hook tests distinguish supported observations, fixture coverage, and unavailable runtime surfaces.
- [x] Missing `SubagentStop` behavior is not misrepresented as an approval/review enforcement guarantee.
- [ ] CHM-04 receives a verified prerequisite matrix or an explicit blocking result.

Bicep/Pylance calls and static configuration tests do not substitute for the required
ARM pricing and Azure MCP live operations. The earlier closure is withdrawn.

### Validation and return

Use `npm run lint:mcp-config`, `npm run validate:vscode`, and relevant existing hook tests.
Return candidate revision, installed runtime/environment, tool projection results, hook observations,
exact commands and exit codes, and any unresolved prerequisite.
Stop for missing authentication, unavailable tools, conflicting registrations, or required configuration changes;
request the specific approval through the interactive parent rather than switching identity or bypassing checks.
