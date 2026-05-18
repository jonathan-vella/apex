<!-- ref:cost-alerts-baseline-v1 -->

# Cost Monitoring Baseline (Full Contract)

Non-negotiable defaults that every Azure project plan must satisfy.
Governance constraints in `04-governance-constraints.json`
(`cost_monitoring.*`) always win on conflict.

## Threshold Contract (Hard-coded, 5 max)

Azure Consumption Budget API limits each budget to **5 notification
blocks** (per Microsoft Learn `Microsoft.Consumption/budgets`). The
baseline therefore pins exactly:

| # | Type     | Threshold | Operator        | Rationale                                |
| - | -------- | --------- | --------------- | ---------------------------------------- |
| 1 | Actual   | 80%       | GreaterThan     | Early warning                            |
| 2 | Actual   | 100%      | GreaterThanOrEqualTo | Budget breach                       |
| 3 | Actual   | 125%      | GreaterThan     | Overrun escalation                       |
| 4 | Forecast | 100%      | GreaterThan     | Trajectory-based breach prediction       |
| 5 | Forecast | 125%      | GreaterThan     | Trajectory-based overrun prediction      |

> Do **not** add a 6th. To unlock more, design a multi-budget topology
> (deferred — see plan).

## Scope-aware Resource Matrix

`cost_monitoring_scope` is a Planner-set decision key
(`rg | sub | mg`) derived from the deployment topology decided at
Step 3 / 3.5.

| Scope | Bicep resource                                       | Terraform resource                                  |
| ----- | ---------------------------------------------------- | --------------------------------------------------- |
| `rg`  | `Microsoft.Consumption/budgets` (RG-scoped)          | `azurerm_consumption_budget_resource_group`         |
| `sub` | `Microsoft.Consumption/budgets` (subscription-scoped)| `azurerm_consumption_budget_subscription`           |
| `mg`  | `Microsoft.Consumption/budgets` (MG-scoped)          | `azurerm_consumption_budget_management_group`       |

The cost-anomaly resource is **subscription-scoped for both stacks**
regardless of `cost_monitoring_scope` (the provider/RP supports no
other scope today). RG-scope anomaly is deferred.

## AVM-first Lookup (Mandatory)

There is **no blanket carve-out** for budgets or Action Groups. At
plan time (05-IaC Planner Phase 2), perform a live registry lookup:

- **Bicep — Consumption Budget**:
  `curl -sf https://mcr.microsoft.com/v2/bicep/avm/ptn/cost-management/budget/tags/list`
  (pattern module variants exist for RG / sub / MG scopes; check the
  module README for the scope target).
- **Bicep — Action Group**:
  `curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/insights/action-group/tags/list`
- **Terraform — Consumption Budget**:
  `curl -sf https://registry.terraform.io/v1/modules/Azure/avm-ptn-cost-management-budget/azurerm/versions`
- **Terraform — Action Group**:
  `curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-insights-actiongroup/azurerm/versions`

Pin to the highest non-prerelease semver. Record the resolved
versions in `04-iac-contract.json` modules list, identical to every
other AVM module.

### Raw resource exception record

If a live lookup returns `404` (module genuinely missing) or the
candidate module fails an AVM-quality check at the target scope, the
plan may emit the raw resource **only** with a structured exception
in the plan's exceptions section:

```json
{
  "resource": "Microsoft.Consumption/budgets" ,
  "stack": "bicep",
  "scope": "mg",
  "evidence_url": "https://mcr.microsoft.com/v2/bicep/...",
  "rationale": "AVM module not yet published for MG scope (verified <date>)",
  "review_after": "<YYYY-MM-DD>"
}
```

Validator/Challenger reject raw resources without this record.

## Action Group — Create or Reuse (Preflight)

Canonical name: `ag-cost-${project}` with short name
`cost${suffix}` (≤12 chars). Override via decision key
`action_group_short_name`.

`cost_action_group_mode ∈ {create, existing}` is Planner-set after a
preflight Azure CLI lookup:

```bash
# At the chosen budget scope's RG (or sub for sub/mg-scoped budgets):
az monitor action-group show \
  --name "ag-cost-${PROJECT}" \
  --resource-group "${AG_RG}" \
  --query id -o tsv 2>/dev/null
```

- Found → `cost_action_group_mode = existing`,
  `existing_action_group_id = <returned id>`.
- Not found → `cost_action_group_mode = create`; CodeGen emits the
  AVM module with one email receiver per `cost_alert_emails[]`
  entry.

CodeGen branches:

- **Bicep `existing`** — uses the `existing` keyword:
  `resource ag 'Microsoft.Insights/actionGroups@<api>' existing = { name: '...', scope: resourceGroup('<rg>') }`.
- **Terraform `existing`** — uses
  `data "azurerm_monitor_action_group" "cost" { name = "...", resource_group_name = "..." }`.

Both fail at plan/compile time if the AG disappears between preflight
and deploy — that is intentional fail-fast behavior; recovery is to
rerun Planner preflight.

## Notification Routing

Each budget notification block:

- **Bicep**: `contactRoles: ['Owner']` **and**
  `contactGroups: [actionGroup.outputs.resourceId]`.
- **Terraform**: `contact_roles = ["Owner"]` **and**
  `contact_groups = [module.action_group.resource_id]` (or
  `data.azurerm_monitor_action_group.cost.id` when reusing).
- `contact_emails` is **not** populated by the budget; emails live on
  the Action Group's email receivers.

### Owner-role fallback rule

If Planner cannot prove ≥1 human RBAC `Owner` assignment at the
budget scope (use `az role assignment list --scope <scope>
--role Owner --query "[?principalType=='User']"`), then:

- `cost_alert_emails` MUST be non-empty.
- The Action Group MUST contain those email receivers (`create`
  mode) or the discovered AG MUST already have email receivers
  (`existing` mode — Planner verifies).
- `contactRoles: ['Owner']` becomes informational only.

### Empty-array silent-skip (deploy-time hazard)

When CodeGen guards the budget / Action Group modules with
`length(costAlertEmails) > 0`, supplying `costAlertEmails = []` (or
the env var `COST_ALERT_EMAILS = "[]"`) skips both modules. The
deployment then reports `Succeeded` with the cost-monitoring contract
**unmet** and no audit trail. Deploy agents MUST treat the empty case
as one of:

1. A preflight blocker (`cost_monitoring_mode = enforced`) — fail-
   closed and prompt the human for emails via `askQuestions`.
2. An explicit opt-out (`cost_monitoring_mode ∈ {minimal, deferred}`
   recorded in `04-governance-constraints.json` with
   `cost_monitoring_exception` for `deferred`).

Never accept `[]` as an implicit default during apply. The matching
deploy preflight rule lives in
[`iac-common/references/deploy-validation-checklist.md` § Cost monitoring inputs](../../iac-common/references/deploy-validation-checklist.md#cost-monitoring-inputs-non-empty-when-enforced).

## Governance Precedence

`04-governance-constraints.json` `cost_monitoring.*` always wins.
Shape:

```jsonc
{
  "cost_monitoring": {
    "thresholds": [/* override of the 5 defaults */],
    "required_scope": "sub",
    "required_action_group_id": "<id>",
    "min_emails": 2,
    "deferred_allowed": false
  }
}
```

Planner records the merged contract (defaults ⊕ governance) in the
implementation plan; Challenger D-6 asserts the merge is faithful.

## cost_monitoring_mode

| Mode       | Resources emitted                         | Allowed environments   | Extra requirements                                         |
| ---------- | ----------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `enforced` | Budget + Action Group + anomaly           | All (default for prod) | None                                                       |
| `minimal`  | Budget only                               | `dev`, `sandbox` only  | `governance.deferred_allowed != false`                     |
| `deferred` | None                                      | `dev`, `sandbox` only  | `cost_monitoring_exception = {rationale, expiry_date}`     |

Production (`environment = prod` / `staging`) cannot opt down.
Sandbox `deferred` produces an informational Challenger finding (not
a blocker).

## Cross-references

- Decision keys: `tools/apex-recall/docs/decision-keys.md`
  (`cost_monitoring_scope`, `cost_action_group_mode`,
  `existing_action_group_id`, `action_group_short_name`,
  `cost_alert_emails`, `cost_monitoring_mode`,
  `cost_monitoring_exception`).
- Adversarial assertions: `references/adversarial-checklists.md`
  D-1 through D-7.
- Bicep snippets: `references/cost-alerts-bicep.md`.
- Terraform snippets: `references/cost-alerts-terraform.md`.
- Plan-level rule: `.github/instructions/references/iac-cost-monitoring.md`.
