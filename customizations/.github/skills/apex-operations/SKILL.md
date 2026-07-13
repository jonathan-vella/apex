---
name: apex-operations
description: "Inspect and reconcile an APEX run. Use for preview explanation, inventory, or diagnosis."
---

## APEX Operations

Use this skill only in the interactive Operator agent.

## Prerequisites

- `apex/taskContext` identifies the exact operation and target.
- Required validation, authorization, freshness, and writer-epoch checks are kernel-controlled.

## Workflow

1. Use `apex/preview` only to read the current operator-created preview.
2. Present semantic changes, target, expiry, destructive actions, ignored or unevaluated items, and uncertainty.
3. Direct the user to `apex gate decide` and `apex deploy`; those trusted CLI ceremonies are not MCP tools.
4. Use `apex/reconcile` for indeterminate operations; do not repeat the side effect independently.
5. Use `apex/inventory` and `apex/diagnose` only for the active run selected by the kernel.
6. Report provider and kernel results without claiming transactional rollback.

## Output

Return the operation ID, state, evidence references, blockers, and kernel-provided next action.
