---
name: apex-host-resume-workflow
description: "Resume an APEX project in Agent Host with 01-Orchestrator selected. Use /apex-host-resume-workflow for recovery, checkpoints, and pending approval gates."
argument-hint: "Existing project name, or leave blank to discover candidates"
user-invocable: true
disable-model-invocation: true
---

# Host Resume Workflow

## Prerequisites

Require the selected owner `01-Orchestrator` with its exact configured model
`MAI-Code-1.1-Flash` and permitted tools. A skill does not bind agent/model/tools.
**STOP** and ask the user to select that owner if selection cannot be verified.

## Procedure

Read [apex-workflow-engine](../apex-workflow-engine/SKILL.md), then follow the
[shared resume procedure](../apex-workflow-engine/references/workflow-entry.md#resume).
Preserve missing-input recovery, required reviews, checkpoints and approvals.
Present status and the exact human handoff or applicable gate, then stop.
Never dispatch Sol or any step agent under MAI, or run specialist work inline.

The Host slash name is deliberately distinct from Local `/apex-resume-workflow`.
Native Host discovery and execution remain manual and unverified; no context
forks, experimental nesting, tool widening, or implicit model inheritance.
