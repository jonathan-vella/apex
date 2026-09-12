---
name: apex-host-workflow-start
description: "Start an APEX workflow or named step in Agent Host after manual owner selection. Use /apex-host-workflow-start with an operation and project; not a model-routing substitute."
argument-hint: "Operation (fresh, requirements, architecture, design, governance, plan, bicep-codegen, terraform-codegen, bicep-deploy, terraform-deploy, as-built, diagnose, challenge) and project"
user-invocable: true
disable-model-invocation: true
---

# Host Workflow Start

## Prerequisites

Require an explicit operation and project, the correctly selected named owner,
its exact configured model, and its permitted tools. A skill cannot bind them.
**STOP** and ask the user to select the owner if any routing evidence is missing.
Never execute a Sol step under MAI or dispatch it as a MAI subagent.

## Procedure

Read [apex-workflow-engine](../apex-workflow-engine/SKILL.md) and its
[workflow entry procedure](../apex-workflow-engine/references/workflow-entry.md).
Resolve the requested operation to its exact owner before consequential work.
Follow the required inputs, activities, outputs, reviews, and human gates there.
Return a blocker instead of inheriting an unknown model or widening tools.

This distinct Host slash name does not replace any Local prompt slash name.
Native discovery and execution remain manual and unverified. Do not enable
experimental nesting or context forks to make a transition work.
