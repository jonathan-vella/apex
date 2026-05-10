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

- **DAG only** — the workflow is a Directed Acyclic Graph; no cycles, no back-edges
- **Source of truth is `templates/workflow-graph.json`** — the orchestrator reads this directly; do not encode workflow logic in agent prose
- **Gates are blocking** — a `gate` node halts downstream execution until human approval is recorded in session state
- **IaC routing is conditional on `decisions.iac_tool`** — Step 3 → Step 4 / 5 / 6 routes to `*-b` (Bicep) or `*-t` (Terraform)
- **Fan-out children execute in parallel** — Step 7 docs is the canonical example; do not serialize parallel children
- **Edge conditions** — use exactly one of `on_complete`, `on_skip`, `on_fail` per edge; ambiguity is a validation error
- **Schema evolution** — bump `metadata.version` and follow `references/schema-evolution.md` rollback rules when changing the graph
- **Validation is enforced at three points** — graph shape (`validate-workflow-graph.mjs`), handoff buttons (`validate-agents.mjs --only=workflow-handoffs`), and gate-companion H2 sync (`validate-artifacts.mjs`)

## Steps

Orchestrator protocol for routing the next step:

1. **Load** `templates/workflow-graph.json`
2. **Read current state** — `apex-recall show <project> --json` → `current_step`
3. **Find the matching node** in the graph
4. **Check node status**:
   - `complete` → follow `on_complete` edges → find next node
   - `in_progress` → resume from `sub_step` checkpoint
   - `pending` → execute this node
   - `skipped` → follow `on_skip` edges
5. **Apply IaC routing** when present — read `decisions.iac_tool` and pick the `*-b` or `*-t` branch
6. **If next is a `gate`** — present to user, wait for approval, record decision in session state
7. **If next is a `subagent-fan-out`** — dispatch all children in parallel; collect results before continuing
8. **Repeat** until all nodes are complete or blocked

## Core Concepts

The workflow is a Directed Acyclic Graph (DAG): **nodes** (agent-step, gate,
subagent-fan-out, validation), **edges** with conditions (`on_complete`, `on_skip`,
`on_fail`), **gates** (human approvals), and **fan-out** (parallel sub-steps such as Step 7
doc generation). IaC routing edges from Step 3 forward conditionally branch on
`decisions.iac_tool` (Bicep → `step-4b`, Terraform → `step-4t`); the pattern repeats for
Steps 5 and 6.

Full node-type table, edge-condition matrix, and IaC routing rules in
[`references/dag-concepts.md`](references/dag-concepts.md).

## Workflow Graph

The full machine-readable DAG is in:
`templates/workflow-graph.json`

### Reading the Graph (Orchestrator Protocol)

```text
1. Load workflow-graph.json
2. Run `apex-recall show <project> --json` → current_step
3. Find the node matching current_step in the graph
4. Check node status:
   - complete → follow on_complete edges → find next node
   - in_progress → resume from sub_step checkpoint
   - pending → execute this node
   - skipped → follow on_skip edges
5. If next node is a gate → present to user, wait for approval
6. If next node is a fan-out → execute children in parallel
7. Repeat until all nodes are complete or blocked
```

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

Run all three together via `npm run validate:_node` (CI) or
`npm run lint:workflow-handoffs` (focused).
