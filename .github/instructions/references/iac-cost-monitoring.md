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
  `kind: "InsightAlert"`, **subscription-scoped only**.
- **Terraform**: `azurerm_cost_anomaly_alert`, subscription-scoped
  (only scope supported by the provider), `email_addresses =
  cost_alert_emails`.
- RG-scoped anomaly is **deferred** — no current shape in either stack.

### InsightAlert shape constraints (Bicep)

The Azure REST API rejects InsightAlerts that violate these shape rules,
even when `bicep build` and `what-if` pass. The IaC Planner must freeze
every property below in the Code-Generation Contract:

| Property | Constraint |
| -------- | ---------- |
| `scope` | Subscription only — module must use `targetScope = 'subscription'` and main.bicep invokes it with `scope: subscription()`. |
| `displayName` | **≤ 25 characters** — `anomaly-{project}-{env}` only works for short slugs; use `anomaly-{short-slug}` if longer. |
| `viewId` | Subscription-scope cost view, e.g. `/providers/Microsoft.CostManagement/views/ms:DailyAnomalyBySubscription` or `ms:DailyCosts`. **Never** `ms:DailyAnomalyByResourceGroup` (RG-scope view is rejected). |
| `schedule.frequency` | `Daily`. |
| `schedule.startDate` | ISO 8601 UTC midnight, e.g. `2026-05-17T00:00:00Z`. Must be present at deploy time. |
| `schedule.endDate` | ISO 8601 UTC midnight, **≤ 365 days** after startDate. The API rejects ranges > 1 year. |
| `notification.to` | Array of email addresses; CodeGen sources from `cost_alert_emails`. |
| `notificationEmail` | The ARM-level sender field; freeze as `senderEmail` param even when `notification.to` is set. Both are required for legacy deployments. |

### Module placement (Bicep)

Because the InsightAlert is subscription-scoped but most of the project
IaC is RG-scoped, the InsightAlert lives in its own module
`modules/cost-anomaly.bicep`:

```bicep
// modules/cost-anomaly.bicep
targetScope = 'subscription'

param costAlertEmail string
param senderEmail string
param anomalyViewId string
param anomalyStartDate string
param anomalyEndDate string

resource anomaly 'Microsoft.CostManagement/scheduledActions@2022-10-01' = { ... }
```

`main.bicep` (RG-scoped) calls it with `scope: subscription()`:

```bicep
module costAnomaly './modules/cost-anomaly.bicep' = {
  scope: subscription()
  name: 'cost-anomaly-${projectName}-${environmentName}'
  params: { costAlertEmail: costAlertEmail, senderEmail: senderEmail, anomalyViewId: anomalyViewId, anomalyStartDate: anomalyStartDate, anomalyEndDate: anomalyEndDate }
}
```

The budget itself remains in the RG-scoped cost-monitoring module — only
the InsightAlert is subscription-scoped.

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
