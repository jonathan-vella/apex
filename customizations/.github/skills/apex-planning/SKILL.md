---
name: apex-planning
description: "Create APEX implementation intent. Use for resources, controls, dependencies, ownership, and bindings."
---

## APEX Planning

Use this skill only for an active planning task.

## Prerequisites

- The kernel projects accepted architecture and current governance inputs.
- The selected IaC track and target environment are present in the task envelope.

## Workflow

1. Keep implementation intent free of Bicep or Terraform syntax.
2. Define logical resources, controls, dependencies, identity, networking, diagnostics, outputs, and environment
   obligations.
3. Put modules, providers, API versions, variables, parameters, phases, backend, and stack ownership in the selected
   binding rather than neutral intent.
4. Trace every binding obligation to intent and projected policy requirements.
5. Submit the typed result only through `apex/stageArtifact` and `apex/completeTask`.

## Output

Return the kernel result and any architecture-rooted or user-owned blocker.
