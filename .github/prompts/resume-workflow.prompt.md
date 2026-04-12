---
description: "Resume the multi-step workflow from where it left off by reading session state and routing to the correct agent."
agent: "01-Orchestrator"
model: "GPT-5.4"
---

# Resume Workflow

Resume the multi-step Azure platform engineering workflow from the last checkpoint.

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

## Graph Node → State Key Mapping

The workflow graph uses hyphenated node IDs; the session state JSON uses quoted string keys.
Step 3_5 (Governance) uses underscores in both systems to avoid `parseInt("3.5")` issues.

| Graph Node ID | State Steps Key | State review_audit Key | Agent                  | Condition                          |
| ------------- | --------------- | ---------------------- | ---------------------- | ---------------------------------- |
| `step-1`      | `"1"`           | `step_1`               | 02-Requirements        | —                                  |
| `step-2`      | `"2"`           | `step_2`               | 03-Architect           | —                                  |
| `step-3`      | `"3"`           | (none — optional)      | 04-Design              | optional                           |
| `step-3_5`    | `"3_5"`         | `step_3_5`             | 04g-Governance         | —                                  |
| `step-4`      | `"4"`           | `step_4`               | 05-IaC Planner         | —                                  |
| `step-5b`     | `"5"`           | `step_5`               | 06b-Bicep CodeGen      | `decisions.iac_tool == "Bicep"`    |
| `step-5t`     | `"5"`           | `step_5`               | 06t-Terraform CodeGen  | `decisions.iac_tool == "Terraform"`|
| `step-6b`     | `"6"`           | `step_6`               | 07b-Bicep Deploy       | `decisions.iac_tool == "Bicep"`    |
| `step-6t`     | `"6"`           | `step_6`               | 07t-Terraform Deploy   | `decisions.iac_tool == "Terraform"`|
| `step-7`      | `"7"`           | (none)                 | 08-As-Built            | —                                  |
