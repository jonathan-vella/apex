---
description: "Perform a WAF assessment and generate cost estimates based on completed requirements."
agent: "03-Architect"
---

# Step 2 — Architecture Assessment

Resume the multi-step workflow at Step 2. Evaluate requirements against all 5 WAF pillars and produce
cost estimates.

<investigate_before_answering>

- Architecture decisions cascade into governance, IaC, and deployment.
  Before recommending services or SKUs, confirm: (a) the IaC tool, region,
  and compliance frameworks already chosen in Step 1; (b) the budget band
  and complexity classification; (c) any non-functional targets
  (SLA, RTO, RPO, peak TPS).
- If any of these are missing or contradictory, surface the gap and ask
  before proceeding. Do not infer values from defaults.
  </investigate_before_answering>

<context>
- Read `agent-output/{project}/00-session-state.json` for project name, IaC
  tool, region, complexity, and current step.
- Read `agent-output/{project}/01-requirements.md` for the Step 1 requirements.
- Read `.github/skills/azure-artifacts/references/02-architecture-template.md`
  for the H2 structure.
- Read `.github/skills/azure-defaults/SKILL.md` for region defaults,
  naming, security baseline, and AVM-first rules.
- `{project}` is the folder name under `agent-output/`.
</context>

<task>
1. Confirm Step 1 prerequisites (`01-requirements.md` exists,
   `steps.1.status = "complete"`).
2. Evaluate requirements against all 5 WAF pillars (Security, Reliability,
   Performance, Cost, Operations).
3. Recommend specific Azure services and SKUs justified by requirements,
   budget, and complexity.
4. Use the Azure Pricing MCP tools (delegate to `cost-estimate-subagent`)
   to generate real cost estimates for both steady-state and peak-season
   usage.
5. Document architecture trade-offs with WAF pillar impact.
6. Save the assessment to `agent-output/{project}/02-architecture-assessment.md`.
7. Save the cost estimate to `agent-output/{project}/03-des-cost-estimate.md`.
8. Run adversarial review passes per the complexity matrix in session state
   (standard = 2 passes, complex = 3 passes).
9. Apply every `must_fix` finding and re-validate.
10. Update `agent-output/{project}/00-session-state.json`: mark Step 2 `complete`.
</task>

<rules>
- Do NOT skip the cost estimate — it is a mandatory output of Step 2.
- Do NOT change any Step 1 decisions (IaC tool, region, compliance) — only
  build on them.
- All Azure resources use `swedencentral` unless requirements specify
  otherwise.
- AVM-first: always check Azure Verified Module availability before
  recommending raw resources.
- Follow the H2 template structure exactly.
</rules>

<output_contract>

- `agent-output/{project}/02-architecture-assessment.md` (WAF assessment,
  trade-offs, recommended services and SKUs)
- `agent-output/{project}/03-des-cost-estimate.md` (steady-state + peak
  costs from Azure Pricing MCP)
- Updated `agent-output/{project}/00-session-state.json` with Step 2
  complete and `decisions.region` / `decisions.services` populated
- Findings file from challenger review (when `must_fix` items exist)
- Handoff: route control to Step 3 (Design, optional) or Step 3.5
  (Governance) per the workflow graph.
  </output_contract>
