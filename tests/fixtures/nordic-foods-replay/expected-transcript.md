# Nordic-foods replay — canonical expected transcript

> This is a **fixture**, not a captured chat. It models the minimum
> shape a clean nordic-foods-replay session must have to pass the J2
> forbidden-pattern grep and J3 affirmative checks. Update only when
> the lessons-plan behaviour itself changes.

## Step 1 — Requirements (02-Requirements)

User: Replay the nordic-foods scenario.

Agent: Read 01-requirements.md; iac_tool: Bicep; region: swedencentral.

`apex-recall decide --key budget_cap_known --value true`

## Step 2 — Architecture (03-Architect)

Agent: Generated WAF assessment with 5-pillar scores. Read sku-manifest.json
(rev 1) — 3 services architect-derived, 1 user-pinned.

**Phase 6a — SKU confirmation gate**

vscode_askQuestions raised: SKU confirmation panel for 3 architect-derived
services. User selected Approve.

`apex-recall decide --key sku_confirmation_status --value approved --step 2`

**Phase 7 — Pricing delegation (cost-estimate-subagent)**

Subagent returned `status: COMPLETE`, monthly_total: $612.50, currency: USD.
JSON written to agent-output/nordic-foods-replay/02-cost-estimate.json.

**Phase 9a — Budget gate**

monthly_total ($612.50) <= budget_cap ($800) — gate skipped silently.

**Phase 11a — SKU manifest MD render**

`node tools/scripts/render-sku-manifest-md.mjs nordic-foods-replay` →
re-rendered sku-manifest.md, current_revision: 2.

**Adversarial review**

Architecture comprehensive review: 2 must_fix findings, 1 should_fix.
Cost-feasibility review: skipped because monthly_total is below the 0.8 *
budget_cap threshold (`cost_feasibility_review: skip`).

**Approval gate — per-finding askMe**

3 findings → 3 sequential `vscode_askQuestions` calls, one question per
finding with options Accept / Skip / Defer. Never batched with multiSelect.
User accepted findings 1, 2; deferred finding 3.

Final handoff: `decisions.skip_design == false` → routing to **04-Design
(Step 3)** for diagrams/ADRs.

## Step 3 — Design (04-Design)

**Phase 00 — Artifact scope (one-time gate)**

`decisions.design_scope` absent → raised vscode_askQuestions with options
Diagrams only, ADRs only, and Both. User selected Both.

`apex-recall decide --key design_scope --value both --step 3`

**Phase 0 — Diagram tool choice (one-time gate)**

`decisions.diagram_tool` absent → raised vscode_askQuestions with options
Draw.io (recommended; every existing artifact uses Drawio) and Python
diagrams. User selected Draw.io.

`apex-recall decide --key diagram_tool --value drawio --step 3`

**Phase 1 — Drawio diagram generation**

`import-diagram` called with XML content (not a file path) per the input
contract. 12 resources, completed in 2m 18s — well within the ≤ 3 minute
timing budget.

## Step 3.5 — Governance (04g-Governance)

discover.py wrote 04-governance-constraints.json. tag_contract.source:
"policy"; tag_contract.tags[]: ["environment", "owner", "costcenter",
"project"]. location_constraints.same_region: true,
same_region_source: "default-assumption", auditable: true.

**Phase 2.7 — Inline Resolution Gate**

Single vscode_askQuestions with **two questions**: required RG tag keys +
casing, allowed-locations status. Same-region NOT in panel. User
confirmed both.

`apex-recall decide --key tag_strategy --value policy --step 3_5`

## Step 4 — IaC Plan (05-IaC Planner)

Read sku-manifest.json (rev 2). No governance reconciliation needed.
sku-manifest.md re-rendered. `apex-recall decide --key identity_model
--value managed-identity --step 4`.

## Step 5 — IaC Code (06b-Bicep CodeGen)

bicep-validate-subagent: APPROVED. No security baseline violations.

## Step 6 — Deploy (07b-Bicep Deploy)

`apex-recall show nordic-foods-replay --json | jq -r '.session.steps["5"].status'`
returned "complete" — skip-validation shortcut applied.

bicep-whatif-subagent: 14 creates, 0 deletes, 0 replaces.
policy-precheck-subagent: deploy_gate=PROCEED, status=CLEAN.

az deployment group create succeeded. resources verified via Azure
Resource Graph.

## Post-Lessons

`apex-recall complete-step nordic-foods-replay 6 --json` recorded.
