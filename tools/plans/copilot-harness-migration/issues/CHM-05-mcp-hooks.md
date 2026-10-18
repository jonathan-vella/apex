## CHM-05: verify projected tools and supplementary hooks

GitHub: [#775](https://github.com/jonathan-vella/apex/issues/775).
Requirements: R2, R11. Priority: P0. Depends on: CHM-09 and owner plan approval.
Status: re-scoped; earlier configuration passes are not live capability acceptance.

### Objective and inputs

Determine which MCP tools and hook events the actual VS Code Copilot adapter exposes for the pilot/target.
Read `.vscode/mcp.json`, settings, `.devcontainer/configure-mcp.mjs`, hook manifests/scripts and actual tool contracts.
SDK/CLI hook docs apply through official VS Code linkage; event delivery still requires installed-version evidence.

### Allowed scope and behavior

Configuration inspection and harmless isolated hook/tool fixtures only.
Do not add root `.mcp.json`, duplicate registrations, change credentials/restart shared services or call Azure.
Tool projection may be recorded without an authenticated operation; mark an untested operation unverified.
Add live read-only cloud probes later only with explicit target/scope permission.
After plan approval, bounded permitted inspection/fixtures run autonomously.

### Validation

Run `npm run lint:mcp-config`, `npm run validate:vscode` and `npm run test:hooks`.
Observe relevant harmless pre/post/stop events on the selected runtime, including deny, crash and timeout.
Distinguish configured, unit-tested, observed and unavailable surfaces.
Inspect advisory response handling: a missing verdict must not gain an approval token from warning text.
Verify actual supported output fields before choosing a warning fix; do not assume `systemMessage` support.

### Acceptance and negative cases

- [ ] Required pilot/target tools have actual projection evidence and operation-level limitations.
- [ ] No duplicate registration or unapproved configuration/credential change exists.
- [ ] Hook delivery/deny/error/timeout outcomes are observed or explicitly blocking for a required capability.
- [ ] Regex guards, fail-open timeout and advisory SubagentStop are not represented as approval security boundaries.
- [ ] Missing/failed verdict remains invalid after any advisory handling.

Negative cases: missing server/tool, denied scratch write, malformed payload, hook failure/timeout,
missing verdict and unavailable stop event. No destructive commands are necessary.
Any demonstrated source fix needs a precise changed-path slice and targeted hook tests before dependent work.

Return candidate/environment, capability matrix, commands/exit codes and genuine observations.
Rollback only introduced fixture/config changes, never shared user work.
Stop on authentication, authority or unapproved runtime changes. No cloud writes, merge or auto-merge.
