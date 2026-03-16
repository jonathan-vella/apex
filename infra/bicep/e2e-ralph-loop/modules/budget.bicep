targetScope = 'resourceGroup'

@description('Email addresses that receive budget notifications.')
param budgetAlertEmails array

@minValue(1)
@description('Monthly budget amount in EUR.')
param budgetAmount int

@allowed([
  'dev'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Project name used for the budget resource name.')
param projectName string

@description('Technical contact email used for escalation notifications.')
param technicalContactEmail string

@description('Budget start date in yyyy-MM-dd format.')
param startDate string = '${utcNow('yyyy-MM')}-01'

var budgetName = 'budget-${projectName}-${environment}'
var escalationEmails = union(budgetAlertEmails, [technicalContactEmail])

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    amount: budgetAmount
    category: 'Cost'
    notifications: {
      actualAt100Pct: {
        contactEmails: escalationEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
      }
      forecastAt100Pct: {
        contactEmails: escalationEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
      }
      forecastAt120Pct: {
        contactEmails: escalationEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
        thresholdType: 'Forecasted'
      }
      forecastAt80Pct: {
        contactEmails: budgetAlertEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Forecasted'
      }
    }
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
  }
}

@description('Budget resource ID.')
output resourceId string = budget.id

@description('Budget resource name.')
output resourceName string = budget.name
