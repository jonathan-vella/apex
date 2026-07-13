---
name: apex-requirements
description: "Structure a bounded APEX requirements task. Use for constraints, NFRs, compliance, budget, and scope."
---

## APEX Requirements

Use this skill only for an active requirements task.

## Prerequisites

- `apex/taskContext` returns a requirements task envelope.
- The interactive Requirements agent is active when user input may be needed.

## Workflow

1. Use the task envelope's required fields and existing values as the question plan.
2. Ask independent questions in small batches through `vscode/askQuestions`.
3. Record each field as supplied, unknown, or explicitly deferred with its owner.
4. Check workload scope, environment, target scope, NFRs, compliance, budget, recovery, operations, and IaC preference
   only when those fields are required by the envelope.
5. Submit the typed result only through `apex/stageArtifact` and `apex/completeTask`.

Do not choose architecture, SKUs, or implementation details while gathering requirements.

## Output

Return the kernel result plus any unresolved user-owned fields.
