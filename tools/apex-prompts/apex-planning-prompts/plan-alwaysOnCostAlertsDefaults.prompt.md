# Plan: Always-On Cost Alerts Defaults (folded into azure-defaults) — Rev 2

Add budget + forecast + cost-anomaly alert defaults to the existing
`azure-defaults` skill so they ship in every project plan with minimal
alert-config input from users. 02-Requirements captures monthly budget
**and** cost-alert recipient email(s). 03-Architect proposes a budget
from the pricing-MCP estimate when none was given (blocking confirm).
05-IaC Planner discovers the deployment scope, runs preflight to detect
an existing Action Group, and writes a scope-aware cost-monitoring
contract into the plan. 06b/06t emit code that matches scope + stack +
discovery result. Notification target = budget `contactRoles: ["Owner"]`
on the budget scope **plus** an Action Group (created via AVM or reused
via preflight discovery), with anomaly emails sourced from
`cost_alert_emails`. Discovered Azure Policy in
`04-governance-constraints.json` overrides these defaults wherever it
sets stricter values. Production: no opt-out. Non-prod
(`environment ∈ {dev, sandbox}`): governed exception via
`cost_monitoring_mode = enforced|minimal|deferred`.

> **Rev 2 changelog** — addresses all 5 must-fixes from the
> [adversarial review](plan-always-on-cost-alerts-findings.json):
> threshold count fits within the Azure Budget API 5-notification cap;
> Action Group reuse is now a preflight-discovered decision key;
> anomaly resources are stack-specific (Terraform = subscription-scoped
> `azurerm_cost_anomaly_alert`, Bicep = `scheduledActions` with `viewId`
>
> - `notification.to`); budgets use live AVM lookup (raw is the
>   exception, not the default); resource scope (`rg|sub|mg`) is a
>   first-class contract field. Should-fix items #6 (governance precedence),
>   #7 (Owner-role fallback), and #8 (sandbox opt-out) are also folded in.

## Phase A — Skill content (in azure-defaults)

1. Edit `.github/skills/azure-defaults/SKILL.md`:
   - Add a "Cost Monitoring Baseline" section parallel to "Security
     Baseline". Contract:
     - **Scope-aware resources** — selected by Planner-set
       `cost_monitoring_scope ∈ {rg, sub, mg}`:
       - **rg**: Bicep `Microsoft.Consumption/budgets` (RG scope) **via
         AVM module if available** (live MCR lookup), else raw with
         exception record; Terraform `azurerm_consumption_budget_resource_group`.
       - **sub**: Bicep `Microsoft.Consumption/budgets` (sub scope);
         Terraform `azurerm_consumption_budget_subscription`.
       - **mg**: Bicep `Microsoft.Consumption/budgets` (MG scope);
         Terraform `azurerm_consumption_budget_management_group`.
     - **Thresholds (hard-coded, ≤5 per Azure Budget API limit)**:
       Actual 80% / 100% / 125% + Forecast 100% / 125% = **5 notifications**.
     - **Budget notifications**: each notification carries
       `contactRoles: ["Owner"]` (Bicep) / `contact_roles = ["Owner"]`
       (TF) **plus** `contactGroups: [<actionGroupId>]`. `Owner`
       resolves to RBAC `Owner` assignees at the budget scope; Planner
       must validate at least one human Owner assignment exists at the
       chosen scope, otherwise the Action Group is the only path and
       must be non-empty (see step 1b).
     - **Action Group** (`ag-cost-${project}`, short name
       `cost${suffix}` ≤12 chars):
       - Authored via AVM:
         `avm/res/insights/action-group` (Bicep, pinned at authoring
         time) / `Azure/avm-res-insights-actiongroup/azurerm` (TF).
       - **Reuse / create selected by preflight decision key**
         `cost_action_group_mode ∈ {create, existing}` (Planner-set,
         see step 1b). When `existing`: Bicep uses `existing` keyword;
         Terraform uses `data "azurerm_monitor_action_group"`.
         `existing_action_group_id` carries the resource ID.
         When `create`: AVM module emits a new Action Group with one
         email receiver per `cost_alert_emails[]` entry (see step 1c).
     - **Cost-anomaly alerts** — stack-specific:
       - **Bicep**: `Microsoft.CostManagement/scheduledActions` min API
         `2022-10-01`, **subscription-scoped** by default. Required
         fields: `kind: "InsightAlert"`, `properties.viewId` (default
         to the built-in `MS-DailyCosts` view), `properties.schedule`
         (daily), `properties.notification.to` (= `cost_alert_emails[]`),
         `properties.notificationEmail` (sender). RG-scoped anomaly is
         deferred (no supported AVM/Bicep RG shape today; documented
         as a known limitation).
       - **Terraform**: `azurerm_cost_anomaly_alert`,
         **subscription-scoped** (only scope supported by the
         provider), `email_addresses = var.cost_alert_emails`,
         `subscription_id` = current sub. RG-scope deferred for the
         same reason.
     - **AVM-first stays mandatory** — no blanket carve-out. Planner
       performs live MCR lookup at plan time for Consumption Budget
       AVM modules (RG/sub/MG variants) and Action Group. Raw
       resource is allowed only with a structured exception record in
       the plan: `{ resource, stack, scope, evidence_url,
rationale, review_after }`.
   - **`Owner`-role fallback rule** (addresses should-fix #7): if
     Planner cannot prove ≥1 human RBAC Owner assignment at the budget
     scope (sub or MG), `cost_alert_emails` must be non-empty AND the
     Action Group must contain those email receivers; `contactRoles`
     becomes informational only.
   - **Governance precedence rule** (addresses should-fix #6): values
     in `04-governance-constraints.json` (`cost_monitoring.*`) always
     win over azure-defaults. Planner records the merged contract.
   - **`cost_monitoring_mode` rule** (addresses should-fix #8):
     `enforced` (default for prod, no opt-out) | `minimal` (budget
     resource only, no Action Group, no anomaly — for sandbox/dev) |
     `deferred` (no cost-monitoring resources, requires explicit
     `rationale` + `expiry_date` decision values; logged as a
     challenger-visible exception).
2. Create `.github/skills/azure-defaults/references/cost-alerts-baseline.md`
   — policy doc (5-threshold contract, scope-aware resource matrix,
   AVM lookup procedure, `Owner`-role fallback, governance precedence,
   `cost_monitoring_mode` semantics, threshold-count rationale citing
   Microsoft Learn `Microsoft.Consumption/budgets`).
3. Create `.github/skills/azure-defaults/references/cost-alerts-bicep.md`
   — Bicep snippets (loaded on-demand by 06b):
   - Budget at rg/sub/mg scope via AVM module (preferred) or raw with
     exception comment.
   - AVM Action Group `create` mode and `existing` mode (`existing`
     keyword wired by Planner-set `existing_action_group_id`).
   - `Microsoft.CostManagement/scheduledActions` (subscription-scoped,
     daily, MS-DailyCosts view).
4. Create `.github/skills/azure-defaults/references/cost-alerts-terraform.md`
   — TF mirror:
   - `azurerm_consumption_budget_{resource_group,subscription,management_group}`
     via AVM-TF module (preferred) or direct resource with exception.
   - AVM-TF Action Group create / `data "azurerm_monitor_action_group"`
     reuse, gated by `cost_action_group_mode`.
   - `azurerm_cost_anomaly_alert` (subscription-scoped).
5. Replace bodies of
   `.github/skills/azure-bicep-patterns/references/budget-pattern.md`
   and `.github/skills/terraform-patterns/references/budget-pattern.md`
   with one-line pointers to the new azure-defaults references.

## Phase B — Decision keys & policy plumbing

6. Register the following keys in `tools/apex-recall/docs/decision-keys.md`:
   - `cost_monitoring_scope` (required, `rg|sub|mg`, Planner-set from
     deployment topology).
   - `cost_action_group_mode` (required, `create|existing`, Planner-set
     after preflight discovery).
   - `existing_action_group_id` (optional, required when
     `cost_action_group_mode = existing`).
   - `action_group_short_name` (optional override, ≤12 chars, default
     `cost${suffix}`).
   - `cost_alert_emails` (required list, 02-Requirements-set;
     defaults to `[<git config user.email>]` if user is silent).
   - `cost_monitoring_mode` (optional, `enforced|minimal|deferred`,
     default `enforced` for prod; surfaced by 02-Requirements when
     `environment ∈ {dev, sandbox}`).
   - `cost_monitoring_exception` (optional object: `rationale`,
     `expiry_date`; required when `cost_monitoring_mode = deferred`).
7. Update `.github/instructions/references/iac-cost-monitoring.md`:
   - Point at `azure-defaults/references/cost-alerts-baseline.md`.
   - Replace 80/100/120 with 80/100/125 actual + 100/125 forecast.
   - Replace `technicalContact` wording with the
     `contactRoles: ["Owner"]` + Action Group + `cost_alert_emails`
     model.
   - Add governance-precedence + AVM-lookup + scope-matrix sections.

## Phase C — Agent wiring

8. `05-iac-planner.agent.md` — Phase 2 (AVM lookup): also lookup
   Consumption Budget AVM modules + Action Group AVM (live MCR). Phase
   4 (planning): (a) determine `cost_monitoring_scope` from the
   deployment topology decided at Step 3/3.5; (b) run preflight Azure
   CLI discovery for an Action Group named `ag-cost-${project}` in the
   chosen scope's RG/sub — set `cost_action_group_mode` + write
   `existing_action_group_id` to `apex-recall`; (c) reconcile with
   `04-governance-constraints.json` cost-monitoring section; (d)
   replace the existing budget blockquote with a one-liner that defers
   to `azure-defaults/references/cost-alerts-baseline.md`. Load that
   reference on-demand.
9. `03-architect.agent.md` — Phase 9a: if `decisions.budget` absent
   after pricing MCP, propose `round(monthly_estimate × 1.2)` via
   **blocking** askQuestions confirm. Move the concrete routing
   description (Owner RBAC + Action Group + cost_alert_emails) into
   the WAF Cost / Operations sections of the architecture-assessment
   artifact, where it can reflect the discovered scope (addresses
   suggestion #9).
10. `02-requirements.agent.md` — add one new prompt to the existing
    Phase 2 batch: `cost_alert_emails` (multi-email, freeform; default
    `[<git config user.email>]`). When `environment ∈ {dev, sandbox}`,
    surface a second prompt for `cost_monitoring_mode` with the three
    options. No informational text about implementation routing — that
    moves to 03-Architect (per suggestion #9).
11. `06b-bicep-codegen.agent.md` + `06t-terraform-codegen.agent.md` —
    Wave 4 emits cost-monitoring resources **conditionally on
    `cost_monitoring_mode`**:
    - `enforced` → budget + Action Group + anomaly (per scope matrix).
    - `minimal` → budget only (no Action Group, no anomaly).
    - `deferred` → none (exception record written to the plan).
      Stack/scope/mode selection is read from `apex-recall`; AVM module
      references are read from the Phase-2 AVM lookup result. Load
      `azure-defaults/references/cost-alerts-{bicep,terraform}.md`
      on-demand at Wave 4.

## Phase D — Adversarial / template alignment

12. `azure-defaults/references/adversarial-checklists.md` line ~253 —
    **split into separate assertions** (addresses suggestion #10):
    - **D-1** Budget resource present at the planned scope.
    - **D-2** Notification count ≤5 and matches the
      80/100/125 actual + 100/125 forecast contract (or the discovered
      governance override).
    - **D-3** Recipient routing: every notification carries
      `contactRoles: ["Owner"]` AND `contactGroups: [<actionGroupId>]`
      (when mode ≠ `minimal`); `Owner` fallback rule satisfied if no
      human Owner assignment exists.
    - **D-4** `cost_action_group_mode` set, with matching
      Bicep `existing` / TF `data` source when `existing`.
    - **D-5** Anomaly resource matches stack-specific contract
      (Bicep scheduledActions with `viewId` + `notification.to`; TF
      subscription-scoped `azurerm_cost_anomaly_alert` with
      `email_addresses`).
    - **D-6** Governance precedence honored — any value in
      `04-governance-constraints.json` `cost_monitoring.*` is reflected
      in the plan.
    - **D-7** `cost_monitoring_mode = deferred` requires
      `cost_monitoring_exception` with `rationale` + `expiry_date`.
13. No template change to `04-implementation-plan.template.md` —
    resources land inside existing `## 📦 Resource Inventory` +
    `## 🔨 Implementation Tasks`.

## Phase E — Validation

14. `npm run validate:agents`, `lint:md`, `lint:vendor-prompting`,
    `validate:iac-security-baseline`.
15. `rg -l 'cost-alerts-baseline' .github/agents` must list 02, 03, 05,
    06b, 06t.
16. End-to-end smoke: create a fresh project with
    `cost_monitoring_mode = enforced` at RG scope → confirm 06b/06t
    emit budget + Action Group + anomaly with exactly 5 budget
    notifications.
17. End-to-end smoke: create a project with `environment = sandbox` →
    confirm 02-Requirements prompts for `cost_monitoring_mode`,
    `minimal` produces budget-only plan, `deferred` requires exception
    record and Challenger reports informational finding (not blocker).
18. Preflight smoke: pre-create an Action Group named
    `ag-cost-testProj` in the project RG → confirm Planner sets
    `cost_action_group_mode = existing` and CodeGen uses Bicep
    `existing` / TF `data` source.

## Decisions (revised)

- Folded into azure-defaults (not a new skill).
- **Thresholds: actual 80/100/125 + forecast 100/125 = 5 notifications**
  (Azure Budget API hard limit).
- **Scope-aware**: `cost_monitoring_scope ∈ {rg, sub, mg}` selected by
  Planner; stack-specific resource per scope.
- **Notification**: budget `contactRoles: ["Owner"]` + Action Group
  (AVM, create or existing per preflight `cost_action_group_mode`); +
  `cost_alert_emails` for anomaly + AG receivers.
- **Anomaly**: stack-specific, subscription-scoped (TF only supports
  sub-scope; Bicep RG-scope deferred). Required fields per stack
  documented in azure-defaults references.
- **AVM-first stays mandatory**: live MCR lookup at plan time for
  budgets + action groups. Raw resource only with structured exception.
- **Governance precedence**: `04-governance-constraints.json` always
  wins.
- **Owner-role fallback**: when no human Owner exists at scope,
  Action Group + `cost_alert_emails` carries the full notification
  load.
- **Budget missing** → Architect proposes `monthly_estimate × 1.2`
  via blocking askQuestions confirm.
- **Opt-out**: `cost_monitoring_mode ∈ {enforced, minimal, deferred}`.
  Default `enforced` for prod (no opt-out); `minimal` and `deferred`
  available for `environment ∈ {dev, sandbox}` only.

## Deferred / Out of scope (will revisit in Rev 3 if needed)

- RG-scoped cost anomaly (no current supported shape in Bicep or
  Terraform); subscription-scope used instead.
- Multi-budget design (would unlock more thresholds than 5 but adds
  resource sprawl); revisit if business asks for it.
- SMS / Logic-App / webhook receivers (Action Group supports them, but
  defaults stay email-only).
- Per-resource-type budgets / filtered budgets (covered by
  governance-driven overrides if needed).
- App-Insights metric alerts (those live under monitoring baseline,
  not cost-monitoring baseline).
