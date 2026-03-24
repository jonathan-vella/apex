---
description: "Perform a WAF assessment and generate cost estimates based on completed requirements."
agent: "03-Architect"
---

# Step 2 — Architecture Assessment

Resume the multi-step workflow at Step 2. Evaluate requirements against all 5 WAF pillars and produce
cost estimates.

## Prerequisites

- `agent-output/{project}/01-requirements.md` must exist (Step 1 complete)
- `agent-output/{project}/00-session-state.json` with `steps.1.status = "complete"`

## Variables

- `{project}`: project folder name under `agent-output/`

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to identify the project name, IaC tool,
   region, complexity, and current step.
2. Read `agent-output/{project}/01-requirements.md` for the full requirements from Step 1.
3. Read `.github/skills/azure-artifacts/references/02-architecture-template.md` and follow its
   H2 structure exactly.
4. Read `.github/skills/azure-defaults/SKILL.digest.md` for region, naming, security baseline,
   and AVM-first rules.
5. Evaluate requirements against all 5 WAF pillars (Security, Reliability, Performance, Cost,
   Operations).
6. Recommend specific Azure services and SKUs justified by requirements, budget, and complexity.
7. Use the Azure Pricing MCP tools to generate real cost estimates for both steady-state and
   peak-season usage.
8. Identify architecture trade-offs and document them with WAF pillar impact.
9. Save the assessment to `agent-output/{project}/02-architecture-assessment.md`.
10. Save the cost estimate to `agent-output/{project}/03-des-cost-estimate.md`.
11. Run adversarial review passes per the complexity matrix in session state
    (standard = 2 passes, complex = 3 passes).
12. Apply all `must_fix` findings and re-validate.
13. Update `agent-output/{project}/00-session-state.json`: mark Step 2 `complete`.

## Constraints

- Do NOT skip the cost estimate — it is a mandatory output of Step 2.
- Do NOT change any Step 1 decisions (IaC tool, region, compliance) — only build on them.
- All Azure resources must use `swedencentral` unless requirements specify otherwise.
- AVM-first: always check Azure Verified Module availability before recommending raw resources.
