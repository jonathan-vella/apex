---
description: "Gather Azure project requirements through structured discovery phases and produce 01-requirements.md."
agent: "02-Requirements"
argument-hint: "Describe the Azure workload or project you want to gather requirements for"
---

# Step 1 — Gather Requirements

Capture Azure project requirements for a new or existing project. This is a
one-shot discovery prompt: collect everything in a single round of structured
questions, then write the artifact.

<context>
- Read `agent-output/{project}/00-session-state.json` to identify the project
  and its current state. If no session state exists, create one from
  `.github/skills/azure-artifacts/templates/00-session-state.template.json`.
- Read `.github/skills/azure-artifacts/references/01-requirements-template.md`
  and replicate its H2 structure exactly.
- Read `.github/skills/azure-defaults/SKILL.md` for region, tag,
  naming, and security defaults.
- `{project}` is the folder name under `agent-output/`.
</context>

<task>
1. Identify the project from session state (or create state from template).
2. Use `askQuestions` to run all four structured discovery phases:
   - Phase 1 — Project identity (name, industry, company size, scenario,
     environments).
   - Phase 2 — Workload pattern detection (pattern, users, budget, data
     sensitivity, IaC tool).
   - Phase 3 — Service recommendations (tier, SLA, recovery objectives,
     Azure services).
   - Phase 4 — Security and compliance (frameworks, controls, authentication,
     region).
3. Generate `agent-output/{project}/01-requirements.md` populated with all
   discoveries, following the H2 template exactly.
4. Classify project complexity as `simple`, `standard`, or `complex` per the
   repo definitions.
5. Invoke `challenger-review-subagent` for one adversarial review pass.
6. Apply every `must_fix` finding and re-validate.
7. Update `agent-output/{project}/00-session-state.json`: mark Step 1
   `complete` and record the complexity classification.
</task>

<rules>
- Complete ALL 4 `askQuestions` phases before generating any document.
- Do NOT hardcode SKUs — leave sizing decisions to Step 2 (Architecture).
- EU data-residency constraints must cover external processors, not just
  Azure resources.
- Complexity classification must match the repo definitions in the template.
- This is a one-shot prompt: do NOT add an investigate-before-answering
  preamble; collect inputs, then produce the artifact.
</rules>

<output_contract>

- `agent-output/{project}/01-requirements.md` (H2 structure matches template)
- Updated `agent-output/{project}/00-session-state.json` with Step 1 complete
  and `decisions.complexity` set
- Findings file from challenger-review-subagent (when `must_fix` items exist)
- Handoff: hand control to Step 2 (Architecture) via the Orchestrator
  </output_contract>
