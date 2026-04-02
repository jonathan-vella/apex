// modules/budget.bicep
// Phase 1 — Monthly consumption budget with forecast and actual alerts
// Resource: Microsoft.Consumption/budgets (native ARM — no AVM module for RG-scope budget)
// Alert thresholds: Forecast 80%, Forecast 100%, Actual 100%, Forecast 120%
// Governance: mandatory tags, EU location (budget is global — N/A for location constraint)

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Monthly budget amount in USD.')
param budgetAmount int

@description('Email addresses to notify on budget threshold breaches.')
param contactEmails array

// ─────────────────────────────── Derived names ───────────────────────────────

var budgetName = 'budget-${projectName}-${environment}'

// ─────────────────────────────── Consumption Budget ──────────────────────────
// Deployed at resource group scope via module scope in main.bicep.
// Microsoft.Consumption/budgets is an extension resource — no location required.

resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: {
      // Budget start: first day of the current month (ISO 8601 date format)
      // Using a fixed start date; update annually as needed
      startDate: '2026-04-01'
    }
    notifications: {
      // Alert: Forecasted spend is 80% of budget
      forecastedAt80Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
      }
      // Alert: Forecasted spend equals 100% of budget
      forecastedAt100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
      }
      // Alert: Actual spend reaches 100% of budget
      actualAt100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: contactEmails
      }
      // Alert: Forecasted spend exceeds 120% — escalation signal
      forecastedAt120Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
        thresholdType: 'Forecasted'
        contactEmails: contactEmails
      }
    }
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Consumption budget resource ID.')
output budgetId string = budget.id
