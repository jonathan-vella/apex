targetScope = 'resourceGroup'

param budgetName string
param budgetAmount int
param technicalContact string
param actionGroupResourceId string
param startDate string = '${utcNow('yyyy-MM')}-01'

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    amount: budgetAmount
    category: 'Cost'
    notifications: {
      actual100: {
        contactEmails: [
          technicalContact
        ]
        contactGroups: [
          actionGroupResourceId
        ]
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
      }
      forecast80: {
        contactEmails: [
          technicalContact
        ]
        contactGroups: [
          actionGroupResourceId
        ]
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Forecasted'
      }
      forecast100: {
        contactEmails: [
          technicalContact
        ]
        contactGroups: [
          actionGroupResourceId
        ]
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
      }
      forecast120: {
        contactEmails: [
          technicalContact
        ]
        contactGroups: [
          actionGroupResourceId
        ]
        enabled: true
        operator: 'GreaterThanOrEqualTo'
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

output budgetId string = budget.id
