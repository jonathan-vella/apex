## Copilot harness migration delivery package

This is an engineering handoff for completing [PR #767](https://github.com/jonathan-vella/apex/pull/767).
It is not published product documentation, a runtime authorization, or a replacement for current repository rules.

### Start here

- [Recovered historical plan](../../../.archive/pre-cpharness/migration-plan-2026-10-16.md): preserved verbatim.
- [Product requirements](prd.md): current scope, requirements, acceptance, and historical-plan corrections.
- [Backlog](backlog.md): actionable work, dependencies, priorities, and issue links.
- [Roadmap](roadmap.md): execution waves and release gates.
- [Issue specifications](issues/): self-contained packets suitable for assigning to a coding or validation agent.

### Recovery provenance

Recovered on 2026-10-17 from recorded tools in historical session
`51a42cd0-6375-4cbf-8efd-6f4c911ef468`:

1. Use the successful full-file read at 2026-10-16 10:11:45.665 UTC.
2. Apply the successful final recorded edit at 2026-10-16 10:28:12.840 UTC.
3. Require exactly one occurrence of that edit's original section.
4. Persist the resulting UTF-8 bytes and verify the disk SHA-256 against the reconstructed content.

The recovered file contains 23,229 bytes. Its SHA-256 is:

```text
3cfe7c16a858af57ca5448c12e84b71d9a63c3594ac1a6b06dbd311210f45832
```

The historical path was recorded as `/home/vscode/.copilot/session-state/******/plan.md`.
The original local file was not available in this environment. This is an exact reconstruction of the last
recorded version, not a claim to restore unrecorded edits, the old live conversation, or background workers.
Do not format or modernize the recovered file; put corrections in the PRD.

### Baseline and evidence boundaries

The baseline is commit `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`, on
`feat/copilot-harness-migration`. PR #767 was open when inspected on 2026-10-17.
The implementation is already present; this package does not ask agents to repeat the migration wholesale.
For regression attribution, also compare against the pre-migration parent `05c2ac85`;
the initial migration revision alone cannot prove a failure predates the migration.

- The PR reports successful source and Python checks, but these are historical claims, not fresh validation.
- The main CI job stopped at Prettier for `tools/tests/integration/smoke-run.md`.
- The PR explicitly leaves live custom-agent acceptance and separate-repository documentation unfinished.
- The PR reports existing Eventdesk validation failures and repository-link failures; their baseline status
  must be demonstrated, not assumed or silently waived.
- Unrelated local changes in `.devcontainer/devcontainer.json`, `agent-output/eventdesk/`, and
  `agent-output/nordic-foods/` must be preserved. They are not smoke fixtures or authorized cleanup targets.

Source inspection confirms the archive, canonical entry skills, routing definitions, readiness contract,
smoke procedure, and native-event tests exist. Existence is not proof of runtime behavior.

### Delegation protocol

1. Select a dependency-ready backlog item. Read its full issue packet and current applicable instructions.
2. Give the agent the issue, target commit, objective, exact allowed paths, required inputs, and stop conditions.
3. Ordinary engineering work uses a repository coding or test-running agent, not an Azure production step agent.
   Agent roles in the backlog describe capabilities, not newly created custom-agent definitions.
4. Human-assisted tickets remain delegable: an agent prepares checks, gathers permitted evidence, and reports
   blockers; the interactive parent or operator owns runtime selection, questions, credentials, and approvals.
5. Only explicitly approved smoke work may exercise APEX workers. Follow the current
   [worker-readiness contract](../../../.github/skills/apex-workflow-engine/references/worker-readiness.md).
   Static allowlists, issue assignment, and the historical plan grant no execution permission.
6. Keep concurrent writes disjoint. CHM-03 and CHM-05 may collect evidence in parallel after CHM-02;
   serialize fixes touching shared definitions, hooks, or configuration.
7. Return changed paths, commit identity, exact commands and exit codes, evidence paths, acceptance results,
   and unresolved blockers. Use the named agent's existing output contract when one applies.
8. A missing input, unsupported runtime, failed readiness check, or approval boundary stops the affected work.
   The worker returns the blocker to its parent; it does not guess, replace models, or delegate around it.

Raw runtime logs stay local unless explicitly approved and redacted. Public issues must not contain secrets,
tokens, private project contents, or unredacted logs.

### Completion and publication

An issue is complete only when its acceptance checklist has evidence for the target revision.
Opening an issue, writing a document, or running a static fixture does not complete runtime acceptance.
New defects become bounded follow-up issues; do not turn this migration into unrelated project-state repair.

The delivery files are saved locally. Their presence does not imply a Git commit, push, publication to
`apex-docs`, merge approval, deployment permission, or authorization to execute the backlog.
GitHub issue bodies are self-contained so assignment does not depend on unpublished planning-file links.
