## CHM-03: verify native VS Code Copilot capabilities

GitHub: [#773](https://github.com/jonathan-vella/apex/issues/773).
Requirements: R1, R3, R4. Priority: P0. Depends on: CHM-09 and owner plan approval.
Status: execution authorized; native lifecycle observations are partial, not full discovery/attachment acceptance.
The filename is retained for link compatibility, not to require the old handshake mechanism.

### Objective and inputs

Establish the actual Copilot session target, discovery, context attachment, native task lifecycle and
interaction behavior before choosing replacements. Use the current source revision, installed runtime/tool
contracts and official VS Code documentation, not Local/CLI assumptions or model labels.
Research did not establish a clean room, exact active SDK version or delegated instruction attachment.

### Allowed changes and execution

Use an owner-scoped neutral temporary folder outside source and production projects.
Allow harmless scratch agents/skills/instructions and reads/writes inside that fixture only.
No APEX project initialization, Azure calls, credentials, shared configuration changes or migration edits.
After plan approval, run routine fixture work in native Autopilot without repetitive confirmations.
Record unavailable metadata as UNKNOWN; no attestation framework or legacy-fleet handshake campaign.

### Activities and validation

1. Record observable VS Code client/server, Copilot extension/SDK identifiers and actual session target.
2. Test agent/skill discovery and instruction attachment with distinct harmless markers; test parent and worker separately.
3. Exercise sync result and actual task handle; continue a same-task worker only when supported.
4. Test one-shot noncontinuation explicitly, returning a precise blocker or fresh bounded task as appropriate.
5. Observe harmless Autopilot question auto-answer, interactive freeform/decline/cancel behavior and denied tool/write.
6. Record real native results and limited redacted evidence; do not append events or infer permissions from YAML.

Use native tools and fixture assertions, not `verify-worker-ready` without required arguments.
Historical parser regressions, if affected, use `node --test tools/tests/scripts/test_worker_ready.mjs`
and `python3 -m pytest tools/tests/scripts/test_sdk_events.py -q`; these do not substitute for runtime probes.

### Acceptance and completion evidence

- [ ] Copilot inside VS Code is observed; required capabilities and exact unknowns are recorded.
- [ ] Parent/worker attachment and actual lifecycle/continuation outcomes are distinguished.
- [ ] Missing tool, denied write, invalid/freeform answer, decline and cancellation have negative-case evidence.
- [ ] Autopilot mode is not inferred from an environment flag or prompt.
- [ ] No source, production project, Azure resource or shared runtime configuration was changed.

Return revision, fixture scope, commands/results, native observations, blockers and cleanup of named fixtures.
Retain historical readers; no production rollback needed. Stop on permissions, unsupported target or conflicting work.
No merge, auto-merge, deployment, credential switching or automatic issue closure.
