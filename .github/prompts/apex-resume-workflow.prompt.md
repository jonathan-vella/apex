---
description: "Simplified resume: pick a project, then either tell me the next step or let me detect it from session state. Surfaces a handoff button — never auto-invokes."
agent: "01-Orchestrator"
---

# Resume Workflow (Simplified)

Pick the project to resume, then either tell me the next step or let me
read session state and confirm what I find. End by surfacing the matching
handoff button — never call `#runSubagent`.

# Goal

Resume the multi-step Azure platform engineering workflow with the
minimum number of round-trips: one question to pick the project, one
question to decide who names the next step (user vs detection), and one
confirmation if detection was used.

# Workflow

## Step 1 — Pick the project

List candidate projects:

```bash
ls -1 agent-output/ 2>/dev/null | grep -v '^README\.md$' | head -20
```

- If exactly one project folder with a `00-session-state.json` exists, use
  it and announce: `Resuming project: <name>`.
- Otherwise, call `vscode/askQuestions` with one question:
  - header: `project-pick`
  - question: `Which project do you want to resume?`
  - options: one per discovered folder; allow freeform input for projects
    not listed.

Stop if no `agent-output/<project>/00-session-state.json` exists for the
chosen name.

## Step 2 — Decide how to find the next step

Call `vscode/askQuestions` with one question:

- header: `next-step-mode`
- question: `Do you already know which step is next?`
- options:
  - `Yes — I'll type the step` (recommended when you remember the state)
  - `No — read session state and tell me what's next`
- allowFreeformInput: true

### Branch A — User types the step

If the user picks `Yes`, ask one follow-up via `vscode/askQuestions`:

- header: `next-step-value`
- question: `Which step is next?`
- options (label = handoff button label):
  - `Step 1: Gather Requirements`
  - `Step 2: Architecture Assessment`
  - `Step 3: Design Artifacts`
  - `Step 3.5: Governance Discovery`
  - `Step 4: Implementation Plan` (Bicep)
  - `Step 4: IaC Plan (Terraform)`
  - `Step 5: Generate Bicep`
  - `Step 5: Generate Terraform`
  - `Step 6: Deploy` (Bicep)
  - `Step 6: Deploy (Terraform)`
  - `Step 7: As-Built Documentation`
  - `🔍 Run Challenger Review`

Use the chosen label verbatim as the handoff button in Step 4 below.

### Branch B — Detect from session state

If the user picks `No`, read state via apex-recall (preferred) or the raw
JSON as a fallback:

```bash
apex-recall show <project> --json 2>/dev/null \
  || cat agent-output/<project>/00-session-state.json
```

Determine the next step using the table in `Graph Node → Handoff Button
Label` (below). Routing rules:

- `current_step.status == "in_progress"` → resume the same step.
- `current_step.status == "complete"` → next step in the DAG.
- `current_step.status == "skipped"` → follow the skip edge.
- IaC track (Bicep vs Terraform) comes from `decisions.iac_tool`. If it is
  missing for a Step 5/6 detection, ask the user once.

Then call `vscode/askQuestions` to confirm:

- header: `confirm-next-step`
- question: `Detected next step is "<label>". Continue?`
- options:
  - `Yes — surface this handoff` (recommended)
  - `No — let me pick a different step` (route back to Branch A)

## Step 3 — Show status

Print a one-block summary before the handoff:

```text
Project:      <name>
Current step: <step id> (<status>)
IaC tool:     <Bicep | Terraform | unset>
Next step:    <handoff button label>
```

## Step 4 — Surface the handoff button

Surface the matching handoff button from the `01-Orchestrator` agent's
`handoffs:` frontmatter and stop. Do **not** wrap the next agent in
`#runSubagent` — codex-tier orchestration would silently downgrade
higher-tier step agents (see VS Code [subagent cost-tier rule][tier]).

[tier]: https://code.visualstudio.com/docs/copilot/agents/subagents

# Success criteria

- One project resolved (auto-picked if singular, else user-picked).
- Next step is either user-typed (Branch A) or detected-and-confirmed
  (Branch B).
- Handoff button label matches one in the orchestrator's `handoffs:` list.
- No `#runSubagent` call; no auto-execution of the next agent.

# Constraints

- At least one `agent-output/<project>/00-session-state.json` must exist.
- Do not change earlier decisions (`decisions.iac_tool`, region, compliance).
- Do not re-run completed steps unless the user picks one explicitly.
- If a gate node requires approval, stop and tell the user before
  surfacing the handoff.

# Stop rules

- Stop if no projects are found under `agent-output/`.
- Stop if `00-session-state.json` is missing or fails JSON parse.
- Stop after surfacing the handoff button.
- If detection cannot resolve a label (custom/deprecated node), STOP and
  ask the user to pick from Branch A's option list.

## Graph Node → Handoff Button Label

| Detected node | Handoff button label                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `step-1`      | `Step 1: Gather Requirements`                                                                         |
| `step-2`      | `Step 2: Architecture Assessment`                                                                     |
| `step-3`      | `Step 3: Design Artifacts`                                                                            |
| `step-3_5`    | `Step 3.5: Governance Discovery`                                                                      |
| `step-4`      | `Step 4: Implementation Plan` (Bicep) **or** `Step 4: IaC Plan (Terraform)` per `decisions.iac_tool`  |
| `step-5b`     | `Step 5: Generate Bicep`                                                                              |
| `step-5t`     | `Step 5: Generate Terraform`                                                                          |
| `step-6b`     | `Step 6: Deploy`                                                                                      |
| `step-6t`     | `Step 6: Deploy (Terraform)`                                                                          |
| `step-7`      | `Step 7: As-Built Documentation`                                                                      |
| any gate      | `🔍 Run Challenger Review`                                                                            |
