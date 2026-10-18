## Copilot harness migration delivery package

This is the proposed delivery plan for [APEX #779](https://github.com/jonathan-vella/apex/pull/779)
and [jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43).
The supported target is **Copilot inside VS Code only**, not Local, standalone CLI or cloud-agent execution.
The existing framework may be simplified or retired; preserving its roster/protocols is not the objective.

**OWNER PLAN APPROVAL PENDING.** The owner authorized this planning/issue/PR alignment and asked to approve
the revised plan before pilot or migration implementation. Neither repository may merge into `main` or enable
auto-merge. This package changes no production agent, permission, review gate, project state or Azure resource.

### Start here

- [Recovered historical plan](../../../.archive/pre-cpharness/migration-plan-2026-10-16.md): preserved verbatim.
- [Product requirements](prd.md): current scope, requirements, acceptance, and historical-plan corrections.
- [Backlog](backlog.md): actionable work, dependencies, priorities, and issue links.
- [Roadmap](roadmap.md): execution waves and release gates.
- [Issue specifications](issues/): self-contained packets suitable for assigning to a coding or validation agent.
- [Assessment adoption](assessment-adoption.md): research findings, proposed dispositions and evidence gaps.
- [Execution contract](execution-contract.md): Autopilot scope, human decisions, validation and rollback.
- [PR review register](review-register.md): feedback disposition without pretending planned fixes are delivered.

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

The current planning baseline is `ea8cb3821f6f6d435dacf967d38263a04d438d41`, on
`feat/copilot-harness-migration`. The historical initial migration baseline is
`ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`; #767 is historical, not the active delivery PR.
Existing implementation is evidence to evaluate, not an instruction to preserve it or reimplement it wholesale.
For regression attribution, also compare against the pre-migration parent `05c2ac85`;
the initial migration revision alone cannot prove a failure predates the migration.

- Historical PR reports of source and Python checks are not fresh validation of the replanned candidate.
- The initial migration CI stopped at Prettier for `tools/tests/integration/smoke-run.md`; CHM-01 is now closed.
- Live runtime acceptance remains incomplete; the companion documentation is a proposal, not publication.
- The PR reports existing Eventdesk validation failures and repository-link failures; their baseline status
  must be demonstrated, not assumed or silently waived.
- Unrelated local changes in `.devcontainer/devcontainer.json`, `agent-output/eventdesk/`, and
  `agent-output/nordic-foods/` must be preserved. They are not smoke fixtures or authorized cleanup targets.

Source inspection confirms the archive, canonical entry skills, routing definitions, readiness contract,
smoke procedure, and native-event tests exist. Existence is not proof of runtime behavior.

### Delegation protocol

After owner plan approval, select a dependency-ready packet and supply exact inputs, allowed paths, commands,
outputs, completion criteria and stop rules. Use native engineering/test workers sparingly for substantial
independent work, not the Azure production step pipeline to implement the migration itself.
The [execution contract](execution-contract.md) permits routine bounded engineering, tests, repair,
feature-branch commits/pushes and PR-comment handling without repeated permission prompts.
It does not permit consequential actions or owner approvals to be supplied by Autopilot.

Start with neutral, harmless capability tests and a representative no-cloud pilot.
Do not require every legacy worker to pass bespoke handshakes as a prerequisite to evaluating its retirement.
Keep writes disjoint and serialize shared-file fixes. Missing capabilities, conflicting edits and material
owner decisions stop the affected packet, not unrelated dependency-ready work.

Raw runtime logs stay local unless explicitly approved and redacted. Public issues must not contain secrets,
tokens, private project contents, or unredacted logs.

### Completion and publication

An issue is complete only when its acceptance checklist has evidence for the target revision.
Opening an issue, writing a document, or running a static fixture does not complete runtime acceptance.
New defects become bounded follow-up issues; do not turn this migration into unrelated project-state repair.

The delivery files' presence does not imply publication to `apex-docs`, merge approval, deployment permission,
or authorization to execute the backlog. The current owner decision is plan review before implementation.
GitHub issue bodies are self-contained so assignment does not depend on unpublished planning-file links.
