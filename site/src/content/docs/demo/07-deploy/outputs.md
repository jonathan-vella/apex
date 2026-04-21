---
title: "Resource Outputs"
description: "Deployed resources with actual names and deployment output values from the Malta catering infrastructure deployment"
sidebar:
  order: 2
---

## Deployed Resources

| Resource                | Actual Name                      | Type                                       | Status |
| ----------------------- | -------------------------------- | ------------------------------------------ | ------ |
| Log Analytics Workspace | `log-malta-catering-dev`         | `Microsoft.OperationalInsights/workspaces` | Pass   |
| Application Insights    | `appi-malta-catering-dev`        | `Microsoft.Insights/components`            | Pass   |
| Key Vault               | `kv-malta-dev-b6lg3l`            | `Microsoft.KeyVault/vaults`                | Pass   |
| Storage Account         | `stmaltadevb6lg3l`               | `Microsoft.Storage/storageAccounts`        | Pass   |
| Container Registry      | `acrmaltadevb6lg3l`              | `Microsoft.ContainerRegistry/registries`   | Pass   |
| Virtual Network         | `vnet-malta-catering-dev`        | `Microsoft.Network/virtualNetworks`        | Pass   |
| App Service Plan        | `asp-malta-catering-dev`         | `Microsoft.Web/serverfarms`                | Pass   |
| Web App                 | `app-malta-catering-dev`         | `Microsoft.Web/sites`                      | Pass   |
| Staging Slot            | `app-malta-catering-dev/staging` | `Microsoft.Web/sites/slots`                | Pass   |
| Private Endpoints       | `pep-*`                          | `Microsoft.Network/privateEndpoints`       | Pass   |
| Private DNS Zones       | `privatelink.*`                  | `Microsoft.Network/privateDnsZones`        | Pass   |
| Consumption Budget      | `budget-malta-catering-dev`      | `Microsoft.Consumption/budgets`            | Pass   |

## Deployment Outputs

```json
{
  "status": "succeeded",
  "webAppName": "app-malta-catering-dev",
  "webAppUrl": "https://app-malta-catering-dev.azurewebsites.net",
  "stagingUrl": "https://app-malta-catering-dev-staging.azurewebsites.net",
  "appServicePlanName": "asp-malta-catering-dev",
  "appServicePlanSku": "P0v3",
  "resourceGroup": "rg-malta-catering-dev",
  "location": "swedencentral"
}
```
