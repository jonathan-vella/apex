# IaC Cost Monitoring

Cost-management resources required in every IaC deployment.
Referenced by the IaC best-practices instruction files.

## Azure Budget

- Resource type: `Microsoft.Consumption/budgets` (Bicep) / `azurerm_consumption_budget_resource_group` (Terraform)
- Amount: Aligned to cost estimate from Step 2 (`03-des-cost-estimate.md`)
- Time grain: Monthly
- Budget amount is a parameter (never hardcoded)

## Forecast Alerts

Three forecast-based contact notifications:

| Threshold | Type     | Action                              |
| --------- | -------- | ----------------------------------- |
| 80%       | Forecast | Email notification to `owner` param |
| 100%      | Forecast | Email notification + action group   |
| 120%      | Forecast | Email notification + action group   |

## Anomaly Detection

- Enable Azure Cost Management anomaly alerts
- Alert on unexpected spend spikes
- Notify `technicalContact` parameter

## Enforcement

- IaC Planner includes budget resources in every implementation plan
- CodeGen agents generate the budget module/resource
- Challenger reviews verify cost monitoring exists
