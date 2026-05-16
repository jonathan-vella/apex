# IaC Cost Monitoring

Cost-management resources required in every IaC deployment.
Referenced by the IaC best-practices instruction files.

> **Canonical contract owner**:
> [`.github/skills/azure-defaults/references/cost-alerts-baseline.md`](../../skills/azure-defaults/references/cost-alerts-baseline.md).
> The tables below are an extract for IaC-author convenience; on
> conflict the azure-defaults reference and the discovered
> `04-governance-constraints.json` `cost_monitoring.*` block win
> (governance > defaults > this extract).

## Azure Budget — scope-aware

Scope is selected by Planner-set `cost_monitoring_scope ∈ {rg, sub, mg}`
(see `cost-alerts-baseline.md` → "Scope-aware Resource Matrix").

| Scope | Bicep resource                                       | Terraform resource                                  |
| ----- | ---------------------------------------------------- | --------------------------------------------------- |
| `rg`  | `Microsoft.Consumption/budgets` (RG-scoped)          | `azurerm_consumption_budget_resource_group`         |
| `sub` | `Microsoft.Consumption/budgets` (sub-scoped)         | `azurerm_consumption_budget_subscription`           |
| `mg`  | `Microsoft.Consumption/budgets` (MG-scoped)          | `azurerm_consumption_budget_management_group`       |

- Amount: aligned to cost estimate from Step 2 (`03-des-cost-estimate.md`).
- Time grain: Monthly.
- Budget amount is a parameter (never hardcoded).
- **AVM-first** — Planner queries the AVM Consumption Budget pattern
  module live at plan time; raw resource is allowed only with a
  structured exception record in the plan.

## Threshold Contract (5 hard-coded, Budget API limit)

| # | Type       | Threshold | Operator                |
| - | ---------- | --------- | ----------------------- |
| 1 | Actual     | 80%       | GreaterThan             |
| 2 | Actual     | 100%      | GreaterThanOrEqualTo    |
| 3 | Actual     | 125%      | GreaterThan             |
| 4 | Forecasted | 100%      | GreaterThan             |
| 5 | Forecasted | 125%      | GreaterThan             |

Do **not** add a 6th notification — the
`Microsoft.Consumption/budgets` API rejects budgets with more than 5
notification blocks.

## Notification Routing

Each notification carries:

- `contactRoles: ['Owner']` (Bicep) / `contact_roles = ["Owner"]` (TF)
  — Azure auto-notifies RBAC `Owner` assignees at the budget scope.
- `contactGroups: [<actionGroupId>]` (Bicep) /
  `contact_groups = [<id>]` (TF) — wires the project Action Group.

The Action Group itself is authored via the AVM
`avm/res/insights/action-group` (Bicep) /
`Azure/avm-res-insights-actiongroup/azurerm` (TF) module and is
**either created or reused** based on the Planner-set
`cost_action_group_mode` decision (preflight discovery via
`az monitor action-group show`). Email receivers come from
`cost_alert_emails` (collected at 02-Requirements; defaults to
`[<git config user.email>]`).

### Owner-role fallback

If Planner cannot prove ≥1 human `Owner` RBAC assignment at the budget
scope, `cost_alert_emails` must be non-empty and the Action Group must
contain those email receivers; `contactRoles` becomes informational
only. See `cost-alerts-baseline.md` for the rule text.

## Anomaly Detection

- **Bicep**: `Microsoft.CostManagement/scheduledActions@2022-10-01`,
  `kind: 'InsightAlert'`, subscription-scoped, daily schedule, default
  `viewId = MS-DailyCosts`, `notification.to = cost_alert_emails`,
  `notificationEmail = senderEmail`.
- **Terraform**: `azurerm_cost_anomaly_alert`, subscription-scoped
  (only scope supported by the provider), `email_addresses =
  cost_alert_emails`.
- RG-scoped anomaly is **deferred** — no current shape in either stack.

## Governance Precedence

`04-governance-constraints.json` `cost_monitoring.*` (any of
`thresholds`, `required_scope`, `required_action_group_id`,
`min_emails`, `deferred_allowed`) always overrides this extract and
the azure-defaults reference. Planner records the merged contract in
the implementation plan; Challenger D-6 asserts the merge is faithful.

## Opt-out (`cost_monitoring_mode`)

| Mode       | Resources                              | Allowed when                                 |
| ---------- | -------------------------------------- | -------------------------------------------- |
| `enforced` | Budget + Action Group + anomaly        | Default for prod; allowed everywhere         |
| `minimal`  | Budget only                            | `environment ∈ {dev, sandbox}` only          |
| `deferred` | None (exception record required)      | `environment ∈ {dev, sandbox}` only, plus    |
|            |                                        | `cost_monitoring_exception = {rationale, expiry_date}` |

## Enforcement

- IaC Planner Phase 2 performs the live AVM lookup; Phase 4 runs the
  preflight Action Group discovery and writes the resolved decision
  keys to `apex-recall`.
- 06b/06t CodeGen Wave 4 emits the budget + Action Group + anomaly
  resources per the scope/stack/mode matrix.
- Challenger assertions D-1 through D-7 (see
  `azure-defaults/references/adversarial-checklists.md`) verify
  contract compliance.
