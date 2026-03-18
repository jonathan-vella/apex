---
description: "Resume the multi-step workflow from where it left off by reading session state and routing to the correct agent."
agent: "01-Conductor"
model: "Claude Opus 4.6"
---

# Resume Workflow

Resume the multi-step Azure infrastructure workflow from the last checkpoint.

## Prerequisites

- At least one project folder exists under `agent-output/` with `00-session-state.json`
- The session state file contains `current_step` and step statuses

## Session State Detection

The agent reads `00-session-state.json` to determine:

- Which step to resume from (`current_step`)
- Whether to use Bicep or Terraform agents (`decisions.iac_tool`)
- Any in-progress sub-step checkpoints (`steps.{N}.sub_step`)

## Instructions

1. Scan `agent-output/` for project folders containing `00-session-state.json`.
2. If multiple projects exist, ask the user which project to resume.
3. Read `agent-output/{project}/00-session-state.json` to determine:
   - `current_step` — the step number to resume from.
   - `steps.{N}.status` — whether it is `pending`, `in_progress`, `complete`, or `skipped`.
   - `steps.{N}.sub_step` — the checkpoint within an in-progress step.
   - `decisions.iac_tool` — routes to Bicep or Terraform agents for Steps 4-6.
4. Read `.github/skills/workflow-engine/templates/workflow-graph.json` for the DAG model.
5. Follow the DAG to determine the next node:
   - If `complete` → follow `on_complete` edges → find next node.
   - If `in_progress` → resume from `sub_step` checkpoint.
   - If `pending` → execute this node.
   - If `skipped` → follow `on_skip` edges.
6. If the next node is a gate → present status to user and wait for approval.
7. Hand off to the correct agent for the next step.

## Constraints

- Do NOT re-execute completed steps unless the user explicitly requests re-run.
- Do NOT change decisions made in earlier steps (IaC tool, region, compliance).
- Always present the current workflow status before resuming.
