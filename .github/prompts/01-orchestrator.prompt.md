---
description: "Kick off a new Azure platform engineering project through the full multi-step workflow with the Orchestrator agent."
agent: "01-Orchestrator"
argument-hint: "Describe the Azure platform engineering project you want to build end-to-end"
---

# Kick Off New Project

Start a new Azure platform engineering project using the multi-step agentic workflow.

# Goal

Initialize a new project workspace under `agent-output/{project}/` with session
state and an initial handoff, then route control to Step 1 (Requirements).

# Success criteria

- `agent-output/{project}/` exists and contains a populated
  `00-session-state.json` and `00-handoff.md`.
- Session state has `project`, `region` (default `swedencentral`), and `branch` set.
- The user has approved the project name and scope.
- Control is handed to the `02-Requirements` agent.

# Constraints

- No prior project artifacts required (this is the entry point).
- `{project}` is kebab-case derived from user description, max 30 chars.
- Read `.github/skills/azure-defaults/SKILL.digest.md` for region, naming,
  and security defaults.
- Read `.github/skills/workflow-engine/templates/workflow-graph.json` for the DAG model.
- Initialize session state from
  `.github/skills/azure-artifacts/templates/00-session-state.template.json`.
- Require human approval at every workflow gate before advancing steps.

# Output

- `agent-output/{project}/00-session-state.json` (initialized from template)
- `agent-output/{project}/00-handoff.md` (initial context for Step 1)
- Handoff: invoke the `02-Requirements` agent with the project name.

# Stop rules

- Stop and ask the user if the project name is ambiguous, conflicts with an
  existing folder under `agent-output/`, or exceeds 30 chars after kebab-casing.
- Stop if `00-session-state.template.json` is missing — do not fabricate state.
- Do not advance past Step 1 handoff in this prompt; the Orchestrator agent
  controls subsequent gates.
