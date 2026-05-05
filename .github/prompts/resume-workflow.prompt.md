---
description: "Resume the multi-step workflow from where it left off by reading session state and routing to the correct agent."
agent: "01-Orchestrator"
---

# Resume Workflow

Resume the multi-step Azure platform engineering workflow from the last checkpoint.

# Goal

Read session state for an existing project under `agent-output/`, determine
the next workflow node from the DAG, and hand off to the correct agent —
without re-executing completed work or losing earlier decisions.

# Success criteria

- Correct project identified (auto-selected if only one; otherwise user-picked).
- `current_step`, step statuses, sub-step checkpoint, and `decisions.iac_tool`
  read from session state.
- Next workflow node resolved against
  `.github/skills/workflow-engine/templates/workflow-graph.json`.
- User shown the current workflow status before any agent invocation.
- Control handed to the correct agent for the next step (Bicep vs Terraform
  routing respected).

# Constraints

- At least one project folder exists under `agent-output/` with
  `00-session-state.json`.
- Read `agent-output/{project}/00-session-state.json` and the workflow graph
  on every resume — do not cache stale state.
- Routing rules:
  - `complete` → follow `on_complete` edges → find next node.
  - `in_progress` → resume from `sub_step` checkpoint.
  - `pending` → execute this node.
  - `skipped` → follow `on_skip` edges.
- Gate nodes require user approval before continuing.
- Do not re-execute completed steps unless the user explicitly asks.
- Do not change decisions made in earlier steps (IaC tool, region, compliance).

# Output

- A status summary printed for the user (project, current step, next agent).
- Handoff to the resolved agent for the next workflow node.

# Stop rules

- Stop and ask if multiple projects exist and the user did not specify one.
- Stop if `00-session-state.json` is missing or fails schema validation.
- Stop at any gate node that requires approval.
- Do not invent a `decisions.iac_tool` value when it is missing — ask the
  user (or route back to the relevant Step 4 agent).

## Graph Node → State Key Mapping

The workflow graph uses hyphenated node IDs; the session state JSON uses quoted string keys.
Step 3_5 (Governance) uses underscores in both systems to avoid `parseInt("3.5")` issues.

| Graph Node ID | State Steps Key | State review_audit Key | Agent                 | Condition                           |
| ------------- | --------------- | ---------------------- | --------------------- | ----------------------------------- |
| `step-1`      | `"1"`           | `step_1`               | 02-Requirements       | —                                   |
| `step-2`      | `"2"`           | `step_2`               | 03-Architect          | —                                   |
| `step-3`      | `"3"`           | (none — optional)      | 04-Design             | optional                            |
| `step-3_5`    | `"3_5"`         | `step_3_5`             | 04g-Governance        | —                                   |
| `step-4`      | `"4"`           | `step_4`               | 05-IaC Planner        | —                                   |
| `step-5b`     | `"5"`           | `step_5`               | 06b-Bicep CodeGen     | `decisions.iac_tool == "Bicep"`     |
| `step-5t`     | `"5"`           | `step_5`               | 06t-Terraform CodeGen | `decisions.iac_tool == "Terraform"` |
| `step-6b`     | `"6"`           | `step_6`               | 07b-Bicep Deploy      | `decisions.iac_tool == "Bicep"`     |
| `step-6t`     | `"6"`           | `step_6`               | 07t-Terraform Deploy  | `decisions.iac_tool == "Terraform"` |
| `step-7`      | `"7"`           | (none)                 | 08-As-Built           | —                                   |
