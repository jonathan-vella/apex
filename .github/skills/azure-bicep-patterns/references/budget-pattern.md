<!-- ref:budget-pattern-v1 -->

# Budget & Cost Monitoring Pattern (Bicep)

MANDATORY per `.github/instructions/references/iac-cost-monitoring.md`. Every deployment
MUST include budget tracking with forecast alerts and anomaly detection.

## Budget Module (AVM or Native)

```bicep
// modules/budget.bicep
@description('Resource group-scoped consumption budget')
param budgetName string
param amount int
param timeGrain string = 'Monthly'
param startDate string // YYYY-MM-01 format
param contactEmails array
param tags object

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: timeGrain
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      forecast80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        contactEmails: contactEmails
        thresholdType: 'Forecasted'
      }
      actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: contactEmails
        thresholdType: 'Actual'
      }
      forecast120: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 120
        contactEmails: contactEmails
        thresholdType: 'Forecasted'
      }
    }
  }
  tags: tags
}

output budgetId string = budget.id
output budgetName string = budget.name
```

## Anomaly Detection (Action Group + Alert)

```bicep
// Cost anomaly alerts via Azure Monitor action group
param actionGroupName string
param actionGroupShortName string // max 12 chars
param contactEmails array
param tags object

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  properties: {
    groupShortName: actionGroupShortName
    enabled: true
    emailReceivers: [for (email, i) in contactEmails: {
      name: 'CostAlert-${i}'
      emailAddress: email
      useCommonAlertSchema: true
    }]
  }
  tags: tags
}
```

## Wiring in main.bicep

```bicep
// main.bicep — budget MUST be a module call, never inline
param budgetAmount int = 500
param budgetContactEmails array
param budgetStartDate string // e.g., '2026-04-01'

module budget 'modules/budget.bicep' = {
  name: 'budget-deployment'
  params: {
    budgetName: 'budget-${project}-${environment}'
    amount: budgetAmount
    contactEmails: budgetContactEmails
    startDate: budgetStartDate
    tags: tags
  }
}
```

## Rules

- Budget amount, contact emails, and start date MUST be parameters — never hardcoded
- Three forecast thresholds are MANDATORY: 80% (forecast), 100% (actual), 120% (forecast)
- `timeGrain` defaults to `Monthly` — override only with documented justification
- Budget resource MUST be deployed in the same resource group as the workload
- Action group for anomaly detection is RECOMMENDED for production environments
