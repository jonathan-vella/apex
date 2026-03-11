---
description: "Resume the 7-step workflow from where it left off by reading session state and routing to the correct agent."
agent: "01-Conductor"
model: "GPT-5.4"
---

# Resume Workflow

Resume the 7-step Azure infrastructure workflow from the last checkpoint.

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
