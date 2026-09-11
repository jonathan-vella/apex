<!-- ref:dag-concepts-v1 -->

# Workflow DAG — Core Concepts

> Loaded by `apex-workflow-engine` SKILL.md. Defines node types, edge
> conditions, and IaC routing rules for the multi-step agent pipeline
> graph (`templates/workflow-graph.json`).

The forward `edges` form a Directed Acyclic Graph (DAG). Separately declared
`return_edges` route revisions back to the owning step without changing that invariant.

| Concept     | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| **Node**    | A unit of work (agent step, gate, validation, or fan-out)       |
| **Edge**    | A dependency between nodes with a condition                     |
| **Gate**    | A human approval point that blocks downstream nodes             |
| **Fan-out** | Parallel execution of independent sub-steps (e.g., Step 7 docs) |

## Node Types

| Type               | Description                              | Example                 |
| ------------------ | ---------------------------------------- | ----------------------- |
| `agent-step`       | A step executed by a specific agent      | Step 1: Requirements    |
| `gate`             | Human approval checkpoint                | Gate after Step 1       |
| `subagent-fan-out` | Parallel sub-step execution              | Step 7 doc generation   |
| `validation`       | Automated validation (lint, build, etc.) | Bicep lint after Step 5 |

## Edge Conditions

| Condition     | Trigger                                         |
| ------------- | ----------------------------------------------- |
| `on_complete` | Source node finished successfully               |
| `on_skip`     | Source node was skipped (e.g., optional Step 3) |
| `on_fail`     | Source node failed — routes to error handling   |
| `on_refine` | Revision returns to the owning step |
| `on_architecture_must_fix` | Findings require architecture revision |
| `on_must_fix_governance_conflict` | Findings require governance conflict resolution |

The schema accepts a condition string or an array of allowed conditions.
Evaluate node conditions as well as edge conditions; outgoing alternatives
are not unconditional fan-out. Gate preconditions and human approval still apply.

## IaC Routing

Governance approval leads to the shared `step-4` IaC Planner for both tracks.
After plan approval, `decisions.iac_tool` selects the conditional nodes:

- Bicep: `step-5b` CodeGen, then `step-6b` Deploy.
- Terraform: `step-5t` CodeGen, then `step-6t` Deploy.

The session map keys are `5` and `6`, not track-specific graph IDs.
Design (`3`) and Governance (`3_5`) share a numeric current-step pointer;
use `session.steps` and the recorded decisions to disambiguate resume routing.
