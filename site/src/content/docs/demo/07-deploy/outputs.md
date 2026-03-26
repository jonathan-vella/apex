---
title: "Deployment Outputs"
sidebar:
  order: 1
---

## 📤 Outputs (Expected)

```json
{
  "vnetResourceId": "/subscriptions/00858ffc-dded-4f0f-8bbf-e17fff0d47d9/resourceGroups/rg-nordic-fresh-foods-prod/providers/Microsoft.Network/virtualNetworks/vnet-nordic-fresh-foods-prod",
  "appServiceHostname": "app-nordic-fresh-foods-prod-7jrcjf.azurewebsites.net",
  "appServicePrincipalId": "24cd6768-7247-43ac-a1d2-9a7f22000a40",
  "keyVaultUri": "https://kv-nff-prod-7jrcjfo3iqck.vault.azure.net/",
  "sqlServerFqdn": "sql-nordic-fresh-foods-prod.database.windows.net",
  "storageAccountName": "stnffprod7jrcjfo3iqckk",
  "logAnalyticsWorkspaceName": "log-nordic-fresh-foods-prod"
}
```

### Security Baseline Verification

| Check                      | Expected      | Actual          | Status |
| -------------------------- | ------------- | --------------- | ------ |
| Key Vault public access    | Disabled      | Disabled        | ✅     |
| Key Vault purge protection | Enabled       | True            | ✅     |
| SQL Server auth            | Azure AD-only | ActiveDirectory | ✅     |
| SQL Server public access   | Disabled      | Disabled        | ✅     |
| Storage HTTPS-only         | True          | True            | ✅     |
| Storage public blob access | False         | False           | ✅     |
| Storage network access     | Disabled      | Disabled        | ✅     |
| App Service state          | Running       | Running         | ✅     |
| App Managed Identity       | Assigned      | 24cd6768-...    | ✅     |

---
