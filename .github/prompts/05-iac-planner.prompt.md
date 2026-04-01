---
description: "Create an IaC implementation plan with governance constraints, dependency and runtime diagrams."
agent: "05-IaC Planner"
---

# Step 4 — IaC Implementation Plan

Create a comprehensive, machine-readable implementation plan based on the approved architecture.

## Prerequisites

- `agent-output/{project}/02-architecture-assessment.md` (Step 2 complete)
- `agent-output/{project}/04-governance-constraints.md/.json` (Step 3.5 complete)
- `00-session-state.json` with `decisions.iac_tool` set to "Bicep" or "Terraform"

## Variables

- `{project}`: project folder name under `agent-output/`

## Instructions

Read `agent-output/{project}/02-architecture-assessment.md` and `agent-output/{project}/04-governance-constraints.json`.

Generate the implementation plan in `agent-output/{project}/04-implementation-plan.md`, the dependency diagram in `agent-output/{project}/04-dependency-diagram.py` (with `04-dependency-diagram.png` output), and the runtime diagram in `agent-output/{project}/04-runtime-diagram.py` (with `04-runtime-diagram.png` output).
