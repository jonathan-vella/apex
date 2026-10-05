<!-- ref:cost-alerts-terraform-v1 -->

# Cost Alerts — Terraform Snippets

Loaded on-demand by 06t-Terraform CodeGen at Wave 4. See
`cost-alerts-baseline.md` for the contract these snippets satisfy.

> These snippets use raw resources because the matching AVM modules
> are unpublished; re-check `.github/data/avm-module-index.json` and the
> registry at plan time and switch to AVM once a module is `Available`.

## 1. Budget — RG scope

`Azure/avm-res-consumption-budget/azurerm` is listed as `Proposed`
(unpublished) in the AVM module index. Until it is published and can
carry the five-notification contract, emit the raw resource **with an
exception record** (see `cost-alerts-baseline.md` → "Raw resource
exception record"):

```hcl
resource "azurerm_consumption_budget_resource_group" "this" {
  name              = "budget-${var.project}"
  resource_group_id = azurerm_resource_group.this.id
  amount            = var.budget_amount_usd
  time_grain        = "Monthly"

  time_period { start_date = "2026-05-01T00:00:00Z" }

  notification {
    enabled        = true
    threshold      = 80
    threshold_type = "Actual"
    operator       = "GreaterThan"
    contact_roles  = ["Owner"]
    contact_groups = [local.action_group_id]
  }
  notification {
    enabled        = true
    threshold      = 100
    threshold_type = "Actual"
    operator       = "GreaterThanOrEqualTo"
    contact_roles  = ["Owner"]
    contact_groups = [local.action_group_id]
  }
  notification {
    enabled        = true
    threshold      = 125
    threshold_type = "Actual"
    operator       = "GreaterThan"
    contact_roles  = ["Owner"]
    contact_groups = [local.action_group_id]
  }
  notification {
    enabled        = true
    threshold      = 100
    threshold_type = "Forecasted"
    operator       = "GreaterThan"
    contact_roles  = ["Owner"]
    contact_groups = [local.action_group_id]
  }
  notification {
    enabled        = true
    threshold      = 125
    threshold_type = "Forecasted"
    operator       = "GreaterThan"
    contact_roles  = ["Owner"]
    contact_groups = [local.action_group_id]
  }
}
```

## 2. Budget — subscription scope

```hcl
resource "azurerm_consumption_budget_subscription" "this" {
  name            = "budget-${var.project}"
  subscription_id = data.azurerm_subscription.current.id
  amount          = var.budget_amount_usd
  time_grain      = "Monthly"
  time_period { start_date = "2026-05-01T00:00:00Z" }
  # ...five notification blocks identical to RG variant
}
```

## 3. Budget — management-group scope

```hcl
resource "azurerm_consumption_budget_management_group" "this" {
  name                = "budget-${var.project}"
  management_group_id = var.management_group_id
  amount              = var.budget_amount_usd
  time_grain          = "Monthly"
  time_period { start_date = "2026-05-01T00:00:00Z" }
  # ...five notification blocks
}
```

## 4. Action Group — `create` mode

`Azure/avm-res-insights-actiongroup/azurerm` is listed as `Proposed`
(unpublished) in the AVM module index. Re-check at plan time; until it
is published, emit the raw resource with an exception record:

```hcl
resource "azurerm_monitor_action_group" "cost" {
  count               = var.cost_action_group_mode == "create" ? 1 : 0
  name                = "ag-cost-${var.project}"
  resource_group_name = azurerm_resource_group.this.name
  short_name          = var.action_group_short_name  # <=12 chars, default cost${suffix}
  enabled             = true

  dynamic "email_receiver" {
    for_each = var.cost_alert_emails
    content {
      name                    = replace(email_receiver.value, "@", "_at_")
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }

  tags = local.tags
}
```

## 5. Action Group — `existing` mode

```hcl
data "azurerm_monitor_action_group" "cost" {
  count               = var.cost_action_group_mode == "existing" ? 1 : 0
  name                = local.existing_ag_name      # parsed from existing_action_group_id
  resource_group_name = local.existing_ag_rg
}

locals {
  action_group_id = var.cost_action_group_mode == "existing" \
    ? data.azurerm_monitor_action_group.cost[0].id \
    : azurerm_monitor_action_group.cost[0].id
}
```

## 6. Cost Anomaly Alert (subscription-scoped)

```hcl
# Provider supports subscription scope only. RG-scope deferred.
resource "azurerm_cost_anomaly_alert" "this" {
  name            = "anomaly-${var.project}"
  display_name    = "Cost anomaly — ${var.project}"
  subscription_id = data.azurerm_subscription.current.subscription_id
  email_addresses = var.cost_alert_emails
  email_subject   = "[Anomaly] ${var.project} daily cost spike"
}
```

## Gotchas

- `azurerm_cost_anomaly_alert` does not accept `resource_group_id`;
  do not try to scope it down.
- `email_addresses` is a flat list — anomaly does not consume the
  Action Group. Keep `cost_alert_emails` non-empty when
  `cost_monitoring_mode = enforced`.
- The `count = var.cost_action_group_mode == "..."` pattern leaves the
  resource address as `[0]` — always use `local.action_group_id`
  downstream so consumers don't break when the mode flips between
  rebuilds.
- AVM module status and versions move forward — re-check the module
  index every time Planner Phase 2 runs; never bring a pin in from
  another project.
- The Bicep stack has **four provider-side hard prerequisites** for
  `Microsoft.CostManagement/scheduledActions` (sub-scope only,
  `displayName` ≤ 25 chars, valid sub-scope `viewId`, ≤ 1-year
  UTC-midnight schedule window) that do **not** apply here —
  `azurerm_cost_anomaly_alert` hides the underlying shape. See
  `cost-alerts-bicep.md` §6 if you are reviewing a mixed-stack
  plan.
