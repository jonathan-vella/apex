@description('Budget resource name.')
param budgetName string

@description('Monthly budget amount at resource-group scope.')
param budgetAmount int

@description('Email recipients for actual and forecasted budget notifications.')
param budgetContactEmails array

@description('Budget start date in yyyy-MM-dd format.')
param startDate string = '${utcNow('yyyy-MM')}-01'

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    amount: budgetAmount
    category: 'Cost'
    notifications: {
      actual80: {
        contactEmails: budgetContactEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
      }
      actual100: {
        contactEmails: budgetContactEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
      }
      forecast80: {
        contactEmails: budgetContactEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Forecasted'
      }
      forecast100: {
        contactEmails: budgetContactEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
      }
      forecast120: {
        contactEmails: budgetContactEmails
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
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
output budgetId string = budget.id

@description('Budget resource name.')
output budgetNameOut string = budget.name
