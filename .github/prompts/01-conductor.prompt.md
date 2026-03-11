---
description: "Kick off a new Azure infrastructure project through the full 7-step workflow with the Conductor agent."
agent: "01-Conductor"
model: "GPT-5.4"
argument-hint: "Describe the Azure infrastructure project you want to build end-to-end"
---

# Kick Off New Project

Start a new Azure infrastructure project using the 7-step agentic workflow.

## Instructions

1. Ask the user to describe their project requirements in natural language.
2. Create the project folder under `agent-output/{project}/`.
3. Initialize `agent-output/{project}/00-session-state.json` from the template
   at `.github/skills/azure-artifacts/templates/00-session-state.template.json`.
4. Populate the session state with the project name, region (`swedencentral`), and branch.
5. Create `agent-output/{project}/00-handoff.md` with initial context.
6. Hand off to Step 1 (Requirements) by invoking the `02-Requirements` agent.

## Constraints

- Read `.github/skills/azure-defaults/SKILL.digest.md` for region, naming, and security defaults.
- Read `.github/skills/workflow-engine/templates/workflow-graph.json` for the DAG model.
- All outputs go to `agent-output/{project}/`.
- Require human approval at every gate before advancing steps.
