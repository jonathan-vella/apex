---
description: "Run an adversarial review against any agent-output artifact to find gaps and weaknesses."
agent: "10-Challenger"
model: "GPT-5.4"
argument-hint: "Provide the path to the artifact to challenge (e.g. agent-output/my-project/04-implementation-plan.md)"
---

# Adversarial Review

Challenge an Azure infrastructure artifact for untested assumptions, governance gaps,
WAF blind spots, and architectural weaknesses.

## Instructions

1. Accept the artifact path from the user (e.g. `agent-output/{project}/04-implementation-plan.md`).
2. Read the artifact and any related context files in the same project folder.
3. Read `agent-output/{project}/00-session-state.json` for complexity and review audit state.
4. Perform a comprehensive adversarial review covering:
   - Untested assumptions
   - Governance gaps
   - WAF pillar blind spots (Security, Reliability, Performance, Cost, Operations)
   - Architectural weaknesses
   - Missing requirements or ambiguities
   - Compliance gaps
5. Return structured findings with severity (`must_fix` / `should_fix` / `consider`),
   category, WAF pillar mapping, and specific recommendations.
6. Save findings to `agent-output/{project}/challenge-findings-{artifact-name}.json`.

## Constraints

- Be rigorous but fair — focus on real gaps that cause downstream problems.
- Do not flag minor style issues.
- Every `must_fix` finding must include a specific, actionable recommendation.
