// modules/budget.bicep — Monthly consumption budget with forecast alert thresholds
// Resource: Microsoft.Consumption/budgets (no AVM module — deployed as raw Bicep)
// Alert thresholds: Forecast 80% / Forecast 100% / Forecast 120%
// Budget amount is passed as an explicit parameter from main.bicep (env sizing is the caller's concern).
// Governance: Cost governance — complements mandatory 9-tag governance baseline and security baseline.

@description('Consumption budget resource name.')
param budgetName string

@description('Monthly budget amount in USD. main.bicep computes the env-appropriate default and passes it here.')
param amount int

@description('Email addresses for budget forecast alert notifications.')
param contactEmails array

@description('Azure RBAC contact roles for budget forecast alert notifications.')
param contactRoles array = []

// ─────────────────────────── Consumption Budget ───────────────────────────────
// Deployed at resource group scope. Microsoft.Consumption/budgets is an extension
// resource; no location attribute is required or accepted.

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      // First day of the deployment month. Update annually or on major env changes.
      startDate: '2026-04-01'
    }
    // Forecast notifications — fire when Azure projects the budget will be exceeded.
    // Notification keys must be unique string identifiers; max 5 per budget.
    notifications: {
      // Alert when forecast projects 80% of budget will be spent — early-warning.
      forecastAt80Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
        contactRoles: contactRoles
      }
      // Alert when forecast projects 100% of budget will be spent — action required.
      forecastAt100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
        contactRoles: contactRoles
      }
      // Alert when forecast projects 120% of budget will be spent — escalation required.
      forecastAt120Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
        contactRoles: contactRoles
      }
    }
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Consumption budget resource ID.')
output budgetId string = budget.id

@description('Budget amount in USD configured on this budget.')
output budgetAmountUsd int = amount
