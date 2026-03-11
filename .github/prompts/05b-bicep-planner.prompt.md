---
description: "Create a Bicep implementation plan with governance constraints, dependency and runtime diagrams."
agent: "05b-Bicep Planner"
model: "Claude Opus 4.6"
---

# Step 4 — Bicep Implementation Plan

Create a comprehensive, machine-readable Bicep implementation plan based on the approved architecture.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm IaC tool is `Bicep` and
   Step 2 is complete.
2. Read `agent-output/{project}/02-architecture-assessment.md` for the approved architecture.
3. Read `agent-output/{project}/01-requirements.md` for requirements context.
4. Read `.github/skills/azure-artifacts/references/04-plan-template.md` and follow its H2
   structure exactly.
5. Read `.github/skills/azure-bicep-patterns/SKILL.md` for Bicep-specific patterns.
6. Invoke the `governance-discovery-subagent` to discover Azure Policy constraints.
7. Generate governance constraints: `agent-output/{project}/04-governance-constraints.md`
   and `agent-output/{project}/04-governance-constraints.json`.
8. Design module structure, parameter flow, and deployment phases.
9. Generate dependency diagram: `agent-output/{project}/04-dependency-diagram.py`.
10. Generate runtime diagram: `agent-output/{project}/04-runtime-diagram.py`.
11. Save the plan to `agent-output/{project}/04-implementation-plan.md`.
12. Run adversarial review passes per complexity matrix in session state.
13. Apply all `must_fix` findings and re-validate.
14. Update `agent-output/{project}/00-session-state.json`: mark Step 4 `complete`.

## Constraints

- AVM-first: always check `br/public:avm/res/{provider}/{resource}` before writing raw Bicep.
- Governance constraints from Azure Policy always override design preferences.
- All modules must accept `uniqueSuffix` and `tags` as parameters.
