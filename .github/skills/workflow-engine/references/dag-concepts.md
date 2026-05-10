# Workflow DAG — Core Concepts

> Loaded by `workflow-engine` SKILL.md. Defines node types, edge
> conditions, and IaC routing rules for the multi-step agent pipeline
> graph (`templates/workflow-graph.json`).

The workflow is a Directed Acyclic Graph (DAG) with:

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

## IaC Routing

Edges from Step 3 → Step 4 are conditional on `decisions.iac_tool`:

- `iac_tool: "Bicep"` → routes to `step-4b` (IaC Planner)
- `iac_tool: "Terraform"` → routes to `step-4t` (IaC Planner)

This pattern repeats for Steps 5 and 6.
