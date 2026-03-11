---
description: "Generate architecture diagrams and Architecture Decision Records (ADRs). Optional step — can be skipped."
agent: "04-Design"
model: "GPT-5.3-Codex"
---

# Step 3 — Design Artifacts (Optional)

Generate visual architecture diagrams and formal ADRs based on the approved architecture.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm Step 2 is complete.
2. Read `agent-output/{project}/02-architecture-assessment.md` for the approved architecture.
3. Read `agent-output/{project}/01-requirements.md` for context.
4. Read `.github/skills/azure-diagrams/SKILL.md` for diagram generation conventions.
5. Read `.github/skills/azure-adr/SKILL.md` for ADR format and structure.
6. Generate architecture diagram: `agent-output/{project}/03-des-diagram.py` and render PNG.
7. Generate cost distribution chart: `agent-output/{project}/03-des-cost-distribution.py`.
8. Generate ADRs for key architecture decisions: `agent-output/{project}/03-des-adr-*.md`.
9. Update `agent-output/{project}/00-session-state.json`: mark Step 3 `complete` or `skipped`.

## Constraints

- This step is optional. If user says "skip", mark Step 3 as `skipped` and proceed.
- Diagrams must use the `diagrams` Python library (already installed).
- ADRs must follow the template from the `azure-adr` skill.
- No challenger review is required for this step.
