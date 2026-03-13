<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Workflow Engine Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use

- Conductor determining the next step after a gate
- Resuming a workflow from `00-session-state.json`
- Validating that all steps have proper dependencies and outputs
- Understanding fan-out (parallel sub-steps) and conditional routing


## Core Concepts

### DAG Model

The workflow is a Directed Acyclic Graph (DAG) with:

| Concept     | Description                                                     |
| ----------- | --------------------------------------------------------------- |
| **Node**    | A unit of work (agent step, gate, validation, or fan-out)       |

> _See SKILL.md for full content._

## Workflow Graph

The full machine-readable DAG is in:
`templates/workflow-graph.json`

### Reading the Graph (Conductor Protocol)

```text
1. Load workflow-graph.json

> _See SKILL.md for full content._

## Reference Index

| Reference      | File                            | Content                      |
| -------------- | ------------------------------- | ---------------------------- |
| Workflow Graph | `templates/workflow-graph.json` | Full DAG for 7-step workflow |

