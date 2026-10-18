---
name: apex-workflow-start
description: "Start or resume APEX work in VS Code Copilot. Select the interactive Orchestrator or domain owner, recover current project evidence, collect missing decisions and use native tasks without UI handoff or readiness rituals."
argument-hint: "operation project (resume [project] to recover)"
user-invocable: true
disable-model-invocation: true
---

# Workflow Start

## Prerequisites

Use the Copilot session target inside VS Code. A skill inherits actual caller tools/model;
it cannot change the selected role, grant permission or establish human approval.
Use the Orchestrator for end-to-end coordination or directly select the requested domain owner.
If the requested owner is already active, continue there; never ask the user to select the same role again.
Direct Requirements, Architect, Design and Governance ask missing material questions through native `ask_user`.
Delegated tasks return the form to their interactive parent.

## Procedure

Resolve the requested operation and project. Supplied explicit values need no repeated confirmation;
ambiguous operation/project requires a native question. No guessed new project on an empty recall result.
Read [workflow entry](../apex-workflow-engine/references/workflow-entry.md) and
[workflow engine](../apex-workflow-engine/SKILL.md) only for relevant domain prerequisites.
Recover `apex-recall show <project> --json`, existing summary/artifacts and real review/approval evidence.
Never read/write state JSON directly or infer completion from numbered files.

Use [native task lifecycle](../apex-workflow-engine/references/worker-readiness.md)
for authorized delegation and actual results. No handoff-button, handshake or log-path prerequisite.
Missing tool/input/approval returns a precise blocker; do not widen scope or substitute model/owner.
Decline/cancellation never approve; Autopilot form answers are not independent human authorization.
For resume preserve findings, checkpoints, current source evidence and actual invocation allowances.
For an explicit start/new-project request, initialization alone is not completion:
the active Orchestrator dispatches `02-Requirements` and mediates its missing discovery questions.
Only an explicit initialization-only request stops at the verified session record.
Existing pending work is resumed, never reinitialized to recover this startup path.

Git commit and debug-log export remain their separate manual skills.
Archived Local prompts are history, not active entry points. Do not enable experimental skill forks
or restore retired runtime hooks. Static checks do not certify actual native tool enforcement.
