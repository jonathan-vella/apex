---
description: "MANDATORY cost monitoring and repeatability rules for all IaC templates (Bicep and Terraform). Enforces budget alerts, forecast notifications, anomaly detection, and zero hardcoded project-specific values."
applyTo: "**/*.bicep, **/*.tf, **/04-implementation-plan.md"
---

# IaC Cost Monitoring & Repeatability

## Cost Monitoring (MANDATORY for every deployment)

Every IaC deployment MUST include these cost-management resources:

### 1. Azure Budget

- Resource type: `Microsoft.Consumption/budgets`
- Amount: Aligned to the cost estimate from Step 2 (`03-des-cost-estimate.md`)
- Time grain: Monthly
- Budget amount MUST be a parameter (never hardcoded)

### 2. Forecast Alerts

Three forecast-based contact notifications at:

| Threshold | Type     | Action                              |
| --------- | -------- | ----------------------------------- |
| 80%       | Forecast | Email notification to `owner` param |
| 100%      | Forecast | Email notification + action group   |
| 120%      | Forecast | Email notification + action group   |

### 3. Anomaly Detection

- Enable Azure Cost Management anomaly alerts
- Alert on unexpected spend spikes
- Notify `technicalContact` parameter

### Implementation Notes

- Planner agents (05b/05t) MUST include budget resources in every implementation plan
- CodeGen agents (06b/06t) MUST generate the budget module/resource
- Challenger reviews MUST verify cost monitoring exists

## Repeatability (MANDATORY — zero hardcoded values)

Generated IaC templates MUST deploy to any tenant, region,
subscription, or customer without source code modification.

### Prohibited Hardcoded Values

| Category               | Example of Violation              | Required Fix                          |
| ---------------------- | --------------------------------- | ------------------------------------- |
| Project names          | `projectName = 'nordic-foods'`    | Parameter with no default             |
| Application names      | `application: 'FreshConnect'`     | Derive from parameter                 |
| Short names            | `var shortName = 'nff'`           | Parameter or `take(projectName, N)`   |
| Subscription/tenant ID | Inline GUIDs                      | Use `subscription().id` / parameters  |
| Resource group names   | `rg-my-project-dev`               | Parameter or convention from input    |
| Tag values             | `workload: 'my-project'`          | Use `projectName` parameter reference |
| Customer identifiers   | Any inline customer-specific text | Parameter                             |

### Rules

1. `projectName` parameter: no default value — caller must provide
2. `shortProjectName` parameter (or derived via `take()`): for length-constrained names
3. `applicationName` parameter: for tag and display-name use
4. All tag values: reference parameters, never inline strings
5. `.bicepparam` / `terraform.tfvars`: only place for project-specific defaults
6. `location` may have a convention default (`swedencentral`) — this is acceptable
