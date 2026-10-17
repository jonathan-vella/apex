---
name: apex-workflow-start
description: "Start or resume an APEX workflow in the VS Code Copilot SDK harness. Use /apex-workflow-start with an explicit operation; resume can discover the project. Requires the owning agent and verified worker routing, not an inherited model."
argument-hint: "operation project (resume [project] to recover)"
user-invocable: true
disable-model-invocation: true
---

# Workflow Start

## Prerequisites

Require an explicit operation; require a project except for `resume`, which may
discover candidates. Require the correctly selected named owner, its exact
configured model, and its permitted tools. A skill cannot bind them.
**STOP** and ask the user to select the owner if any routing evidence is missing.
The operator selects Auto separately in the runtime; never perform specialist
work inline or bypass the verified worker handshake.

## Procedure

Read [apex-workflow-engine](../apex-workflow-engine/SKILL.md) and its
[workflow entry procedure](../apex-workflow-engine/references/workflow-entry.md).
Resolve the requested operation to its exact owner before consequential work.
Follow the required inputs, activities, outputs, reviews, and human gates there.
Return a blocker instead of inheriting an unknown model or widening tools.

For `resume`, require the selected owner `01-Orchestrator` and its configured
`MAI-Code-1.1-Flash` model. Follow the [shared resume procedure](../apex-workflow-engine/references/workflow-entry.md#resume).
Use a supplied project without reconfirmation; otherwise discover candidates
and ask only when ambiguous. Empty recall never authorizes a fresh start.
Preserve missing-input recovery, reviews, checkpoints and approvals. Present
recovered status and the applicable human gate. After approval, Orchestrator
may dispatch only the exact approved owner through
[worker readiness](../apex-workflow-engine/references/worker-readiness.md).
Never run specialist work inline or substitute models.

Git commit and debug-log export remain separate manual skills, not workflow
operations. Archived Local prompt names are not entry points. Custom-agent
runtime acceptance must be demonstrated; static checks do not certify discovery,
model routing or permissions. Do not enable experimental skill context forks.
