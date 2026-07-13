---
title: "Use the vNext Workflow"
description: "Route work through APEX specialists, constrained workers, logical gates, and linked promotions."
sidebar:
  order: 3
---

Use the visible `APEX` agent as the preferred entry point. It reads `apex/status` and `apex/nextTask`, reports the
kernel-owned state, and offers a direct handoff to the specialist that owns the next interactive decision.

## Work Through Direct Handoffs

Interactive specialists remain visible because they can ask the user questions and may use a higher model tier:

- **APEX Requirements** gathers missing outcomes and constraints with `vscode/askQuestions`.
- **APEX Architect** resolves architecture, cost, availability, and risk decisions with the user.
- **APEX Planner** resolves implementation choices and produces the typed intent, binding, and environment inputs.
- **APEX Operator** handles preview, approval, deployment, recovery, and other user-authorized operations.

APEX hands work directly to these specialists. They are not subagents, and a handoff does not itself mutate workflow
state. Only a successful MCP operation accepted by the kernel changes the run.

## Keep Workers Noninteractive

CodeGen, Reviewer, and Validator are hidden autonomous workers. A specialist may invoke them only through declared
subagent edges. Workers do not ask the user, do not receive general shell or Azure tools, and must return a typed
`needs_input` result when their bounded task cannot proceed. Their configured model tier does not exceed the invoking
interactive path; higher-tier work uses a direct handoff instead.

## Pass the Logical Gates

The kernel opens gates only after required artifacts, validation, and review results are accepted:

| Gate | Decision | What approval binds |
| ---- | -------- | ------------------- |
| Requirements | Confirm the workload contract | Requirements, SKU decisions, review, and accepted-risk scope |
| Architecture and Cost | Confirm the proposed design | Architecture, cost, governance reconciliation, and review |
| Implementation Plan | Confirm the delivery contract | Intent, IaC binding, environment inputs, and review |
| Deployment Preview | Authorize the exact operation | Current preview, validation, target, head, and writer epoch |

Rejecting or invalidating an input returns the run to the earliest affected work. Deployment Preview is the approval
ceremony for the exact preview; there is no second generic confirmation after it.

## Promote Without Reusing Environment State

Run `apex promote --environment <name> --target <scope>` to create a linked run. Requirements, Architecture and Cost,
and Implementation Plan may be inherited as immutable attestations only when complete dependency hashes and accepted
risk scopes still match. The first mismatch reopens the affected gate.

Environment-specific artifacts are never inherited. Every promoted run requires a fresh preview, Deployment Preview
decision, deployment, inventory, and evidence for its own Azure scope.

Use the [operations guide](./operations/) for commands and the [security model](./security/) for authority boundaries.
