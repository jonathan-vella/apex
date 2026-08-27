---
description: "Generate architecture diagrams and Architecture Decision Records (ADRs). Optional step — can be skipped."
agent: "04-Design"
---

# Step 3 — Design Artifacts (Optional)

Generate visual architecture diagrams and formal ADRs based on the approved architecture.

<context>
- `{project}` is the folder under `agent-output/`.
- Read `agent-output/{project}/00-session-state.json` to confirm Step 2 is
  `complete`.
- Read `agent-output/{project}/02-architecture-assessment.md` for the
  approved architecture.
- Read `agent-output/{project}/01-requirements.md` for upstream context.
- Read `.github/skills/python-diagrams/SKILL.md` for architecture diagrams and
  charts.
- Read `.github/skills/azure-adr/SKILL.md` for ADR format and structure.
</context>

<task>
1. Confirm Step 2 is `complete` and approved.
2. Generate the architecture diagram source and renders:
  `agent-output/{project}/03-des-diagram.py`, `.png`, and `.svg`.
3. Generate the cost distribution chart:
   `agent-output/{project}/03-des-cost-distribution.py`.
4. Generate ADRs for key architecture decisions:
   `agent-output/{project}/03-des-adr-*.md` (one per decision).
5. Update `agent-output/{project}/00-session-state.json`: mark Step 3 as
   `complete` or `skipped` based on user choice.
</task>

<rules>
- This step is optional. If the user says "skip", mark Step 3 as `skipped`
  and proceed to Step 3.5 (Governance).
- All diagrams use the Python `diagrams`, `matplotlib`, or `graphviz` libraries
  through the shared `diagram_io.py` helper.
- ADRs must follow the template from the `azure-adr` skill.
- No challenger review is required for this step.
</rules>

<output_contract>

- `agent-output/{project}/03-des-diagram.py`, `.png`, and `.svg` (when not skipped)
- `agent-output/{project}/03-des-cost-distribution.py` and rendered output
- `agent-output/{project}/03-des-adr-*.md` (one ADR per major decision)
- Updated `agent-output/{project}/00-session-state.json` with Step 3
  `complete` or `skipped`
- Handoff: route control to Step 3.5 (Governance) per the workflow graph.
  </output_contract>
