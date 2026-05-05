---
description: "Run an adversarial review against any agent-output artifact to find gaps and weaknesses."
agent: "10-Challenger"
argument-hint: "Provide the path to the artifact to challenge (e.g. agent-output/my-project/04-implementation-plan.md)"
---

# Adversarial Review

Challenge an Azure platform engineering artifact for untested assumptions, governance gaps,
WAF blind spots, and architectural weaknesses.

# Goal

Produce a structured set of adversarial findings against a single
agent-output artifact, with actionable recommendations and severity tags
(`must_fix` / `should_fix` / `consider`).

# Success criteria

- The artifact has been read together with related context files in the
  same project folder.
- Findings cover assumptions, governance, all five WAF pillars,
  architectural weaknesses, requirements gaps, and compliance gaps.
- Every finding has a severity, category, WAF pillar mapping (where
  applicable), and a specific recommendation.
- Every `must_fix` finding includes an actionable next step (file/section
  to edit, value to change, evidence required).
- Findings saved to
  `agent-output/{project}/challenge-findings-{artifact-name}.json`.

# Constraints

- Target artifact file must exist under `agent-output/{project}/`.
- `agent-output/{project}/00-session-state.json` must exist with a complexity
  classification and review audit state.
- Auto-detect `artifact_type` from the filename. Supported types:
  `requirements`, `architecture`, `implementation-plan`,
  `governance-constraints`, `iac-code`, `cost-estimate`,
  `deployment-preview`. If auto-detection fails, prompt for explicit type.
- Be rigorous but fair — focus on real gaps that cause downstream problems.
- Do not flag minor style issues.

# Output

- `agent-output/{project}/challenge-findings-{artifact-name}.json` with the
  structured findings.
- A short summary returned to the user (top `must_fix` items + counts).

# Stop rules

- Stop and ask for the artifact path if the input is missing or ambiguous.
- Stop if the artifact file does not exist; do not invent content.
- Stop if `00-session-state.json` is missing — challenger review depends on
  complexity context.
- Do not produce findings for artifacts outside `agent-output/`.
