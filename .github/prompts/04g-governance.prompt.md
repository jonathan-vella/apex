---
description: "Discover Azure Policy constraints for the project subscription and produce governance constraint artifacts."
agent: "04g-Governance"
argument-hint: "Discover governance constraints for a project"
---

# Step 3.5 — Governance Discovery

Discover Azure Policy assignments, classify their effects, and produce governance constraint
artifacts before IaC planning begins.

# Goal

Produce machine-readable and human-readable governance constraints for the
project subscription so the IaC Planner can design within policy boundaries.

# Success criteria

- `agent-output/{project}/04-governance-constraints.md` and `.json` exist and
  cover every effective policy assignment at the target subscription scope
  (including management group-inherited).
- Each policy is classified by effect (`Deny`, `Audit`, `Modify`,
  `DeployIfNotExists`, `Append`, `Disabled`).
- Conflicts and blockers between architecture and policy are explicitly listed.
- Adversarial review pass (1 pass) has run and `must_fix` findings are addressed.
- Session state has `steps["3_5"].status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json` to identify the project,
  subscription ID, and complexity; confirm Step 2 is complete.
- Read `agent-output/{project}/02-architecture-assessment.md` for the resource
  list and compliance requirements.
- Read `.github/skills/azure-defaults/SKILL.md` (Governance Discovery
  section, regions, tags, security baseline).
- Read `.github/skills/azure-artifacts/SKILL.md` for the H2 template.
- Read template
  `.github/skills/azure-artifacts/templates/04-governance-constraints.template.md`.
- Use `.github/skills/azure-governance-discovery/scripts/discover.py` (invoke
  via `run_in_terminal`) to query Azure Policy REST API.
- Map every policy constraint to planned resources from the architecture
  assessment.
- Run adversarial review via `challenger-review-subagent` with
  `artifact_type=governance-constraints`, `review_focus=comprehensive`,
  `pass_number=1`.

# Output

- `agent-output/{project}/04-governance-constraints.md` (human-readable)
- `agent-output/{project}/04-governance-constraints.json` (machine-readable;
  consumed by Step 4 IaC Planner)
- Updated `agent-output/{project}/00-session-state.json`
- Handoff: present findings summary and route to Step 4 (IaC Planning).

# Stop rules

- Stop if subscription ID is missing from session state — do not guess.
- Stop if `discover.py` cannot reach the Azure Policy REST API; report the
  error and do not synthesize policies.
- Stop if architecture assessment is missing or empty — Step 2 must be
  complete before governance discovery runs.
- Do not advance to Step 4 if blocking policy conflicts remain unresolved.
