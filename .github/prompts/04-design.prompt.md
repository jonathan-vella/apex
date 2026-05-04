---
description: "Generate architecture diagrams and Architecture Decision Records (ADRs). Optional step — can be skipped."
agent: "04-Design"
model: "Claude Sonnet 4.6"
---

# Step 3 — Design Artifacts (Optional)

Generate visual architecture diagrams and formal ADRs based on the approved architecture.

## Expected Variables

- `{project}` — Project name (folder under `agent-output/`)
- Architecture assessment at `agent-output/{project}/02-architecture-assessment.md`

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm Step 2 is complete.
2. Read `agent-output/{project}/02-architecture-assessment.md` for the approved architecture.
3. Read `agent-output/{project}/01-requirements.md` for context.
4. Read `.github/skills/drawio/SKILL.md` for architecture diagram conventions.
5. Read `.github/skills/python-diagrams/SKILL.md` if generating WAF/cost charts.
6. Read `.github/skills/azure-adr/SKILL.md` for ADR format and structure.
7. Generate architecture diagram: `agent-output/{project}/03-des-diagram.drawio`.
8. Generate cost distribution chart: `agent-output/{project}/03-des-cost-distribution.py`.
9. Generate ADRs for key architecture decisions: `agent-output/{project}/03-des-adr-*.md`.
10. Update `agent-output/{project}/00-session-state.json`: mark Step 3 `complete` or `skipped`.

## Constraints

- This step is optional. If user says "skip", mark Step 3 as `skipped` and proceed.
- Diagrams must use Draw.io format by default.
- Python `diagrams` library is for charts only (WAF/cost).
- ADRs must follow the template from the `azure-adr` skill.
- No challenger review is required for this step.
