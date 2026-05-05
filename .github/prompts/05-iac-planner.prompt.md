---
description: "Create an IaC implementation plan with governance constraints, dependency and runtime diagrams."
agent: "05-IaC Planner"
---

# Step 4 — IaC Implementation Plan

Create a comprehensive, machine-readable implementation plan based on the approved architecture.

<investigate_before_answering>
- The implementation plan is the contract that Steps 5 (IaC Code) and 6
  (Deploy) execute against. Before drafting it, confirm: (a) which IaC tool
  was decided (`Bicep` or `Terraform`); (b) what governance constraints
  apply at the target subscription scope; (c) which AVM modules are
  available for each resource type; (d) any dependencies that affect
  deployment order or parallelism.
- If governance constraints conflict with the approved architecture,
  surface the conflict and ask before drafting.
</investigate_before_answering>

<context>
- `{project}` is the folder under `agent-output/`.
- Read `agent-output/{project}/02-architecture-assessment.md` (Step 2 output).
- Read `agent-output/{project}/04-governance-constraints.json` (Step 3.5
  output) — these constraints always win over design preferences.
- Read `agent-output/{project}/00-session-state.json` for `decisions.iac_tool`
  (`Bicep` or `Terraform`).
- Read the relevant patterns skill:
  `.github/skills/azure-bicep-patterns/SKILL.md` OR
  `.github/skills/terraform-patterns/SKILL.md` based on the IaC tool.
- Read `.github/skills/python-diagrams/SKILL.md` for diagram generation.
</context>

<task>
1. Confirm prerequisites: Step 2 complete, Step 3.5 complete, `iac_tool` set.
2. Map every resource from the architecture assessment to a concrete AVM
   module (or justify a raw resource where AVM is unavailable).
3. Identify resource dependencies and produce a deployment order.
4. Draft the implementation plan in
   `agent-output/{project}/04-implementation-plan.md` (machine-readable
   structure: H2 sections, resource tables, parameter manifest).
5. Generate the dependency diagram:
   `agent-output/{project}/04-dependency-diagram.py` (and rendered
   `04-dependency-diagram.png`).
6. Generate the runtime diagram:
   `agent-output/{project}/04-runtime-diagram.py` (and rendered
   `04-runtime-diagram.png`).
7. Run challenger review per the complexity matrix (opt-in; default skip
   for Step 4 when `complexity == simple`).
8. Update `agent-output/{project}/00-session-state.json`: mark Step 4
   `complete`.
</task>

<rules>
- Governance constraints always win over design preferences.
- AVM-first: every resource must reference an AVM module unless explicitly
  justified.
- The plan must be machine-readable enough that Step 5 (IaC Code) can be
  executed without re-interpreting the architecture.
- Diagrams use the Python `diagrams` library; Draw.io is reserved for
  Step 3 design diagrams.
</rules>

<output_contract>
- `agent-output/{project}/04-implementation-plan.md` (resource manifest,
  deployment order, parameter contract)
- `agent-output/{project}/04-dependency-diagram.py` + `.png`
- `agent-output/{project}/04-runtime-diagram.py` + `.png`
- Updated `agent-output/{project}/00-session-state.json`
- Handoff: route control to Step 5 (`06b-Bicep CodeGen` OR
  `06t-Terraform CodeGen`) based on `decisions.iac_tool`.
</output_contract>
