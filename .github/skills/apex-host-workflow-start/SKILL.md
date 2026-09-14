---
name: apex-host-workflow-start
description: "Start or resume an APEX workflow or named step in Agent Host after manual owner selection. Use /apex-host-workflow-start with an explicit operation; resume can discover the project. Not a model-routing substitute."
argument-hint: "operation project (resume [project] to recover)"
user-invocable: true
disable-model-invocation: true
---

# Host Workflow Start

## Prerequisites

Require an explicit operation; require a project except for `resume`, which may
discover candidates. Require the correctly selected named owner, its exact
configured model, and its permitted tools. A skill cannot bind them.
**STOP** and ask the user to select the owner if any routing evidence is missing.
Never execute a Sol step under MAI or dispatch it as a MAI subagent.

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
recovered status and the applicable gate or exact human handoff, then stop.
Never dispatch Sol or any step agent under MAI, or run specialist work inline.

This distinct Host slash name does not replace any Local prompt slash name.
Local `/apex-resume-workflow` is unchanged. Git commit and debug-log export
remain separate manual commands, not workflow-start operations.
Native discovery and execution remain manual and unverified. Do not enable
experimental nesting or context forks to make a transition work.
