---
title: "Cost Governance Guide"
description: "Budget alerts, forecasts, and cost anomaly detection"
---

> Budget alerts, forecast notifications, and anomaly detection for every deployment.

## Why Cost Governance Is Mandatory

Every IaC deployment in this project **must** include cost monitoring resources.
This is enforced by the `iac-cost-repeatability` instruction, which auto-applies
to all `.bicep`, `.tf`, and implementation plan files.

The rule is simple: **no budget, no merge**. Challenger reviews verify cost
monitoring exists, and CI validators flag missing budget resources.

## Budget Alert Setup

Every deployment must include an Azure Budget resource with three forecast-based
alert thresholds:

| Threshold | Type     | Action                                  |
| --------- | -------- | --------------------------------------- |
| 80%       | Forecast | Email notification to `owner` parameter |
| 100%      | Forecast | Email notification + action group       |
| 120%      | Forecast | Email notification + action group       |

### Bicep Example

```bicep
@description('Monthly budget amount in USD')
param budgetAmount int

@description('Technical contact email for alerts')
param technicalContact string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-${projectName}-${environment}'
  properties: {
    timePeriod: {
      startDate: '2026-01-01'
    }
    timeGrain: 'Monthly'
    amount: budgetAmount
    category: 'Cost'
    notifications: {
      forecast80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Forecasted'
        contactEmails: [technicalContact]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [technicalContact]
      }
      forecast120: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 120
        thresholdType: 'Forecasted'
        contactEmails: [technicalContact]
      }
    }
  }
}
```

### Terraform Example

```hcl
variable "budget_amount" {
  description = "Monthly budget amount in USD"
  type        = number
}

variable "technical_contact" {
  description = "Technical contact email for alerts"
  type        = string
}

resource "azurerm_consumption_budget_resource_group" "this" {
  name              = "budget-${var.project_name}-${var.environment}"
  resource_group_id = azurerm_resource_group.this.id
  amount            = var.budget_amount
  time_grain        = "Monthly"

  time_period {
    start_date = "2026-01-01T00:00:00Z"
  }

  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 80
    threshold_type = "Forecasted"
    contact_emails = [var.technical_contact]
  }

  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 100
    threshold_type = "Forecasted"
    contact_emails = [var.technical_contact]
  }

  notification {
    operator       = "GreaterThanOrEqualTo"
    threshold      = 120
    threshold_type = "Forecasted"
    contact_emails = [var.technical_contact]
  }
}
```

## Forecast vs Actual Alerts

| Alert Type   | Triggers When                                      | Use Case                       |
| ------------ | -------------------------------------------------- | ------------------------------ |
| **Forecast** | Projected spend will exceed threshold by month-end | Early warning — time to act    |
| **Actual**   | Spend has already exceeded threshold               | Reactive — damage already done |

This project uses **forecast alerts** exclusively because they provide
advance warning. By the time an actual-spend alert triggers, the budget
is already blown.

## Anomaly Detection

In addition to budget alerts, enable Azure Cost Management anomaly alerts
to catch unexpected spend spikes:

- Configure via Azure Cost Management in the portal
- Alert on spend patterns that deviate from historical baselines
- Notify the `technicalContact` parameter

## Per-Environment Budgets

Use parameterised budgets that scale by environment:

| Environment | Typical Budget | Rationale                       |
| ----------- | -------------- | ------------------------------- |
| `dev`       | Low            | Minimal resources, short-lived  |
| `staging`   | Medium         | Production-like but limited use |
| `prod`      | Full           | Production workload capacity    |

Set the budget amount via `.bicepparam` or `terraform.tfvars` —
never hardcode it in the template.

## Azure Pricing MCP Tools

The **cost-estimate-subagent** uses the Azure Pricing MCP server to query
real-time SKU pricing during architecture review (Step 2) and as-built
documentation (Step 7). Key tools:

| Tool                     | Purpose                                |
| ------------------------ | -------------------------------------- |
| `azure_cost_estimate`    | Estimate costs based on usage patterns |
| `azure_bulk_estimate`    | Multi-resource estimate in one call    |
| `azure_price_compare`    | Compare prices across regions and SKUs |
| `azure_ri_pricing`       | Reserved Instance pricing and savings  |
| `azure_region_recommend` | Find cheapest regions for a service    |

The **Microsoft Learn MCP** server provides `microsoft_docs_search()`
for looking up service-specific pricing documentation.

## Repeatability Rules

The cost governance instruction enforces **zero hardcoded values**:

- `projectName` must be a parameter with no default
- All tag values must reference parameters
- Budget amounts must be parameterised
- `.bicepparam` / `terraform.tfvars` is the only place for project defaults

## Adversarial Review Checklist

The Challenger reviews verify two mandatory cost categories:

**Cost Monitoring:**

- [ ] Budget resource exists
- [ ] Forecast alerts at 80%, 100%, 120% thresholds
- [ ] Anomaly detection configured
- [ ] `technicalContact` parameter for notifications

**Repeatability:**

- [ ] No hardcoded project names or values
- [ ] `projectName` is a required parameter
- [ ] Template deploys to any tenant/region/subscription

## Post-Deployment Validation

After deployment, verify budget alerts are active:

```bash
# List budgets in the resource group
az consumption budget list \
  --resource-group rg-${PROJECT}-${ENV}

# Check budget notifications
az consumption budget show \
  --budget-name budget-${PROJECT}-${ENV} \
  --resource-group rg-${PROJECT}-${ENV}
```

---

:::tip[Further Reading]

- The mandatory `iac-cost-repeatability` instruction
  (`.github/instructions/iac-cost-repeatability.instructions.md`)
  enforces these patterns automatically via glob matching
- **Reusable budget patterns** are available in the IaC pattern skills:
  - Bicep: `.github/skills/azure-bicep-patterns/references/budget-pattern.md`
  - Terraform: `.github/skills/terraform-patterns/references/budget-pattern.md`
- [MCP Integration](how-it-works/mcp-integration.md)
  — Azure Pricing MCP server and tool catalog
- [Workflow](workflow.md) — how cost estimation fits into the agent workflow
  :::
