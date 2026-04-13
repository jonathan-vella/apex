<!-- ref:budget-pattern-v1 -->

# Budget & Cost Monitoring Pattern (Terraform)

MANDATORY per `.github/instructions/references/iac-cost-monitoring.md`. Every deployment
MUST include budget tracking with forecast alerts and anomaly detection.

## Budget Resource

```hcl
# modules/budget/main.tf
resource "azurerm_consumption_budget_resource_group" "this" {
  name              = var.budget_name
  resource_group_id = var.resource_group_id

  amount     = var.budget_amount
  time_grain = var.time_grain

  time_period {
    start_date = var.budget_start_date # YYYY-MM-01T00:00:00Z
  }

  # MANDATORY: 80% forecast alert
  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 80
    threshold_type = "Forecasted"
    contact_emails = var.budget_contact_emails
  }

  # MANDATORY: 100% actual alert
  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 100
    threshold_type = "Actual"
    contact_emails = var.budget_contact_emails
  }

  # MANDATORY: 120% forecast alert
  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 120
    threshold_type = "Forecasted"
    contact_emails = var.budget_contact_emails
  }
}
```

## Budget Variables

```hcl
# modules/budget/variables.tf
variable "budget_name" {
  type        = string
  description = "Name of the consumption budget"
}

variable "resource_group_id" {
  type        = string
  description = "Resource group ID to scope the budget"
}

variable "budget_amount" {
  type        = number
  description = "Monthly budget amount in the billing currency"
}

variable "time_grain" {
  type        = string
  default     = "Monthly"
  description = "Budget time grain (Monthly, Quarterly, Annually)"
  validation {
    condition     = contains(["Monthly", "Quarterly", "Annually"], var.time_grain)
    error_message = "time_grain must be Monthly, Quarterly, or Annually."
  }
}

variable "budget_start_date" {
  type        = string
  description = "Budget start date in YYYY-MM-01T00:00:00Z format"
}

variable "budget_contact_emails" {
  type        = list(string)
  description = "Email addresses for budget alert notifications"
}
```

## Anomaly Detection (Action Group)

```hcl
resource "azurerm_monitor_action_group" "cost_alerts" {
  name                = var.action_group_name
  resource_group_name = var.resource_group_name
  short_name          = var.action_group_short_name # max 12 chars
  tags                = var.tags

  dynamic "email_receiver" {
    for_each = var.budget_contact_emails
    content {
      name                    = "CostAlert-${email_receiver.key}"
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }
}
```

## Wiring in Root Module

```hcl
# main.tf — call budget module
module "budget" {
  source = "./modules/budget"

  budget_name           = "budget-${var.project}-${var.environment}"
  resource_group_id     = module.resource_group.resource_id
  budget_amount         = var.budget_amount
  budget_start_date     = var.budget_start_date
  budget_contact_emails = var.budget_contact_emails
}
```

## Rules

- Budget amount, contact emails, and start date MUST be variables — never hardcoded
- Three forecast thresholds are MANDATORY: 80% (forecast), 100% (actual), 120% (forecast)
- `time_grain` defaults to `Monthly` — override only with documented justification
- Budget resource MUST be scoped to the same resource group as the workload
- Action group for anomaly detection is RECOMMENDED for production environments
- Use `azurerm_consumption_budget_resource_group` (not subscription-level) for project isolation
