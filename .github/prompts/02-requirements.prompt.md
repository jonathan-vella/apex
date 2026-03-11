---
description: "Gather Azure infrastructure requirements through structured discovery phases and produce 01-requirements.md."
agent: "02-Requirements"
model: "Claude Opus 4.6"
argument-hint: "Describe the Azure workload or project you want to gather requirements for"
---

# Step 1 — Gather Requirements

Capture Azure infrastructure requirements for a new or existing project.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to identify the project and current state.
   If no session state exists, create one from the template.
2. Use `askQuestions` to run 4 structured discovery phases:
   - **Phase 1**: Project identity (name, industry, company size, scenario, environments).
   - **Phase 2**: Workload pattern detection (pattern, users, budget, data sensitivity, IaC tool).
   - **Phase 3**: Service recommendations (tier, SLA, recovery objectives, Azure services).
   - **Phase 4**: Security and compliance (frameworks, controls, authentication, region).
3. Read `.github/skills/azure-artifacts/references/01-requirements-template.md` and replicate
   its H2 structure exactly.
4. Read `.github/skills/azure-defaults/SKILL.digest.md` for defaults (region, tags, naming, security).
5. Generate `agent-output/{project}/01-requirements.md` with all discoveries populated.
6. Classify project complexity (`simple` / `standard` / `complex`).
7. Invoke the `challenger-review-subagent` for adversarial review (1 pass for Step 1).
8. Apply all `must_fix` findings and re-validate.
9. Update `agent-output/{project}/00-session-state.json`: mark Step 1 `complete`.

## Constraints

- Complete ALL 4 questioning phases via `askQuestions` before generating any document.
- Do NOT hardcode SKUs — leave sizing to Step 2 (Architecture).
- EU data residency constraints must cover external processors, not just Azure resources.
- Complexity classification must match the repo definitions in the template.
