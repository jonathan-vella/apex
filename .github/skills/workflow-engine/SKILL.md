---
name: workflow-engine
description: "Machine-readable workflow DAG for the multi-step agent pipeline. Defines node types, edge conditions, gates, and fan-out patterns. USE FOR: Orchestrator step routing, resume-from-graph, workflow validation. DO NOT USE FOR: Azure infrastructure, code generation, troubleshooting."
---

# Workflow Engine Skill

Provides a declarative, machine-readable workflow graph that the Orchestrator
reads instead of relying on hardcoded step logic.

## When to Use

- Orchestrator determining the next step after a gate
- Resuming a workflow via `apex-recall show <project> --json`
- Validating that all steps have proper dependencies and outputs
- Understanding fan-out (parallel sub-steps) and conditional routing

## Core Concepts

### DAG Model

The workflow is a Directed Acyclic Graph (DAG) with:

| Concept     | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| **Node**    | A unit of work (agent step, gate, validation, or fan-out)       |
| **Edge**    | A dependency between nodes with a condition                     |
| **Gate**    | A human approval point that blocks downstream nodes             |
| **Fan-out** | Parallel execution of independent sub-steps (e.g., Step 7 docs) |

### Node Types

| Type               | Description                              | Example                 |
| ------------------ | ---------------------------------------- | ----------------------- |
| `agent-step`       | A step executed by a specific agent      | Step 1: Requirements    |
| `gate`             | Human approval checkpoint                | Gate after Step 1       |
| `subagent-fan-out` | Parallel sub-step execution              | Step 7 doc generation   |
| `validation`       | Automated validation (lint, build, etc.) | Bicep lint after Step 5 |

### Edge Conditions

| Condition     | Trigger                                         |
| ------------- | ----------------------------------------------- |
| `on_complete` | Source node finished successfully               |
| `on_skip`     | Source node was skipped (e.g., optional Step 3) |
| `on_fail`     | Source node failed — routes to error handling   |

### IaC Routing

Edges from Step 3 → Step 4 are conditional on `decisions.iac_tool`:

- `iac_tool: "Bicep"` → routes to `step-4b` (IaC Planner)
- `iac_tool: "Terraform"` → routes to `step-4t` (IaC Planner)

This pattern repeats for Steps 5 and 6.

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
