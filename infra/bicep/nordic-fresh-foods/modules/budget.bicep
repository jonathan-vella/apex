targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Budget Module — Consumption Budget + Forecast Alerts
// ──────────────────────────────────────────────

@description('Project name for budget naming')
param projectName string

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

@description('Monthly budget amount in EUR')
param budgetAmount int

@description('Contact email for budget notifications')
param budgetContactEmail string

@description('Technical contact email for anomaly alerts')
param technicalContact string

@description('Budget start date in yyyy-MM-dd format')
param startDate string = '${utcNow('yyyy-MM')}-01'

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var budgetName = 'budget-${projectName}-${environment}'

// ──────────────────────────────────────────────
// Budget (raw Bicep — no AVM for RG-scoped budgets)
// ──────────────────────────────────────────────

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      forecastAt80Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Forecasted'
        contactEmails: [
          budgetContactEmail
        ]
      }
      forecastAt100Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [
          budgetContactEmail
          technicalContact
        ]
      }
      forecastAt120Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
        thresholdType: 'Forecasted'
        contactEmails: [
          budgetContactEmail
          technicalContact
        ]
      }
      actualAt90Pct: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 90
        thresholdType: 'Actual'
        contactEmails: [
          budgetContactEmail
          technicalContact
        ]
      }
    }
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Budget resource ID')
output budgetResourceId string = budget.id

@description('Budget name')
output budgetName string = budget.name
