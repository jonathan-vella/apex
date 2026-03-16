targetScope = 'resourceGroup'

@description('Project name used for the budget resource name.')
param projectName string

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Resource tags used to derive contact email settings when provided.')
param tags object

@description('Budget start date in yyyy-MM-dd format.')
param startDate string = '${utcNow('yyyy-MM')}-01'

var budgetName = 'budget-${projectName}-${environment}'
var budgetAmount = environment == 'prod' ? 8547 : environment == 'staging' ? 2050 : 540
var budgetContactEmail = contains(tags, 'budget-contact-email') ? string(tags['budget-contact-email']) : 'platform-engineering@contoso.local'
var technicalContactEmail = contains(tags, 'technical-contact-email') ? string(tags['technical-contact-email']) : (contains(tags, 'technical-contact') ? string(tags['technical-contact']) : 'platform-engineering@contoso.local')
var escalationEmails = union([
  budgetContactEmail
], [
  technicalContactEmail
])

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
        contactEmails: [
          budgetContactEmail
        ]
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
output budgetId string = budget.id

@description('Budget name.')
output budgetNameOut string = budget.name
