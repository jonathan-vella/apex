---
description: "Discover Azure Policy constraints for the project subscription and produce governance constraint artifacts."
agent: "04g-Governance"
argument-hint: "Discover governance constraints for a project"
---

# Step 3.5 — Governance Discovery

Discover Azure Policy assignments, classify their effects, and produce governance constraint
artifacts before IaC planning begins.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to identify the project name, subscription
   ID, complexity, and confirm Step 2 is complete.
2. Read `agent-output/{project}/02-architecture-assessment.md` for the resource list and
   compliance requirements.
3. Read `.github/skills/azure-defaults/SKILL.digest.md` — Governance Discovery section, regions,
   tags, security baseline.
4. Read `.github/skills/azure-artifacts/SKILL.digest.md` — H2 template for
   `04-governance-constraints.md`.
5. Read the template:
   `.github/skills/azure-artifacts/templates/04-governance-constraints.template.md`.
6. Invoke the `governance-discovery-subagent` to query Azure Policy REST API (including
   management group-inherited policies) for the target subscription.
7. Classify each discovered policy by effect: `Deny`, `Audit`, `Modify`, `DeployIfNotExists`,
   `Append`, `Disabled`.
8. Map policy constraints to planned resources from the architecture assessment.
9. Identify any policy conflicts or blockers that would prevent deployment.
10. Save `agent-output/{project}/04-governance-constraints.md` (human-readable).
11. Save `agent-output/{project}/04-governance-constraints.json` (machine-readable, for IaC
    agents to consume).
12. Run adversarial review via `challenger-review-subagent` with
    `artifact_type=governance-constraints`, `review_focus=comprehensive`, `pass_number=1`.
13. Update `agent-output/{project}/00-session-state.json`: set `steps["3_5"].status = "complete"`.
14. Present findings summary and hand off to Step 4 (IaC Planning).
