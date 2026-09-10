---
name: workflow-engine
description: '**UTILITY SKILL** — Machine-readable workflow DAG for the multi-step agent pipeline. Defines node types, edge conditions, gates, and fan-out patterns. WHEN: "orchestrator step routing", "resume from graph", "workflow validation", "workflow DAG", "workflow gate", "fan-out pattern". USE FOR: orchestrator step routing, resume-from-graph, workflow validation. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting.'
---

# Workflow Engine Skill

Provides a declarative, machine-readable workflow graph that the Orchestrator
reads instead of relying on hardcoded step logic.

## When to Use

- Orchestrator determining the next step after a gate
- Resuming a workflow via `apex-recall show <project> --json`
- Validating that all steps have proper dependencies and outputs
- Understanding fan-out (parallel sub-steps) and conditional routing

## Rules

- **Forward DAG** — `edges` must be acyclic; refinement routes are declared separately in `return_edges`.
- **Source of truth is `templates/workflow-graph.json`** — the orchestrator reads this directly; do not encode workflow logic in agent prose
- **Gates are blocking** — a `gate` node halts downstream execution until human approval is recorded in session state
- **IaC routing** — `step-4` is the shared planner; select CodeGen and Deploy nodes using `decisions.iac_tool`.
- **Fan-out children execute in parallel** — Step 7 docs is the canonical example; do not serialize parallel children
- **Edge conditions** — follow the graph's declared conditions, including refinement returns; the schema allows a string or array.
- **Schema evolution** — bump `metadata.version` and follow `references/schema-evolution.md` rollback rules when changing the graph

## Prerequisites

Use the graph and `apex-recall show <project> --json` together. If the returned
`session` is empty, initialize or recover the project before routing.

## Steps

Orchestrator protocol for routing the next step:

1. **Load** `templates/workflow-graph.json`
2. **Read current state** — use `session.current_step`, `session.steps`, and `session.decisions` in the response.
3. **Resolve the node** — use the per-step status map to distinguish Design (`3`) from Governance (`3_5`);
   use `decisions.iac_tool` for the CodeGen and Deploy tracks. Do not derive a node ID from the numeric pointer alone.
4. **Check node status**:
   - `complete` → follow `on_complete` edges → find next node
   - `in_progress` → resume from `sub_step` checkpoint
   - `pending` → execute this node
   - `skipped` → follow `on_skip` edges
   - failed or blocked → stop and follow the applicable declared recovery or refinement route
5. **Apply edge and node conditions** — honor optional Design selection and the IaC track;
   do not execute every outgoing edge when alternatives are present.
6. **If next is a `gate`** — check its preconditions, present to the user, wait for approval, and record the decision.
7. **If next is a `subagent-fan-out`** — dispatch all children in parallel; collect results before continuing
8. **Repeat** until all nodes are complete or blocked

## Core Concepts

Forward execution and declared refinement returns are distinct. A shared
`step-4` plan feeds `step-5b` / `step-5t`, then `step-6b` / `step-6t`.
Approval gates remain blocking on both tracks.

Full node-type table, edge-condition matrix, and IaC routing rules in
[`references/dag-concepts.md`](references/dag-concepts.md).

## Workflow Graph

The full machine-readable DAG is in:
`templates/workflow-graph.json`

### Reading the Graph (Orchestrator Protocol)

Use [Steps](#steps) as the routing protocol. Response fields are documented in
[`show-schema.md`](../../../tools/apex-recall/docs/show-schema.md).

## Reference Index

| Reference                | File                                       | Content                                                 |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------- |
| Workflow Graph           | `templates/workflow-graph.json`            | Full DAG for the multi-step workflow                    |
| Orchestrator Handoff     | `references/orchestrator-handoff-guide.md` | Gate templates, IaC routing, delegation rules           |
| Subagent Integration     | `references/subagent-integration.md`       | Subagent matrix, pricing accuracy, review protocols     |
| Handoff Validation Rules | `references/handoff-validation-rules.md`   | B1a–B5 rule reference (`workflow-handoffs` PART)        |
| Track Parity Spec        | `references/track-parity-spec.md`          | B4 normalization spec for Bicep/Terraform parity        |
| Schema Evolution         | `references/schema-evolution.md`           | D1 versioning policy + D2 rollback (`metadata.version`) |

## Validation Surfaces

The workflow graph is enforced at three points:

| Validator                                                    | Rule registry                        | Scope                                         |
| ------------------------------------------------------------ | ------------------------------------ | --------------------------------------------- |
| `tools/scripts/validate-workflow-graph.mjs`                  | inline                               | Graph shape + schema                          |
| `tools/scripts/validate-agents.mjs --only=workflow-handoffs` | `WORKFLOW_HANDOFF_RULES`             | `handoffs[]` UI buttons + `agents[]` dispatch |
| `tools/scripts/validate-artifacts.mjs`                       | `ARTIFACT_HEADINGS["00-handoff.md"]` | Gate-companion file H2 sync                   |

`npm run validate:_node` includes these checks. For focused graph and handoff
checks, use `npm run validate:workflow-graph` and `npm run lint:workflow-handoffs`.
Artifact Markdown validation remains owned by the existing hooks and challenger review.
