# Step 6: Deployment Summary - static-webapp-test

> Generated: 2024-12-17  
> Status: **SIMULATED** (for workflow validation)

## Preflight Validation

| Property             | Value            |
| -------------------- | ---------------- |
| **Project Type**     | standalone-bicep |
| **Deployment Scope** | resourceGroup    |
| **Validation Level** | N/A (simulated)  |
| **Bicep Build**      | ⏭️ Skipped       |
| **What-If Status**   | ⏭️ Skipped       |

### Change Summary

| Change Type  | Count | Resources Affected                               |
| ------------ | ----- | ------------------------------------------------ |
| Create (+)   | 5     | Log Analytics, App Insights, SQL Server, DB, SWA |
| Delete (-)   | 0     | —                                                |
| Modify (~)   | 0     | —                                                |
| NoChange (=) | 0     | —                                                |

### Validation Issues

✅ No issues found (simulated deployment).

## Deployment Details

| Field               | Value                                |
| ------------------- | ------------------------------------ |
| **Deployment Name** | `static-webapp-test-20241217-160000` |
| **Resource Group**  | `rg-static-webapp-test-dev`          |
| **Location**        | `swedencentral`                      |
| **Duration**        | ~3 minutes (estimated)               |
| **Status**          | ⏸️ Simulated                         |

## Deployed Resources

| Resource       | Name                           | Type        | Status |
| -------------- | ------------------------------ | ----------- | ------ |
| Log Analytics  | `log-static-webapp-test-dev`   | Workspace   | ⏸️     |
| App Insights   | `appi-static-webapp-test-dev`  | Component   | ⏸️     |
| SQL Server     | `sql-staticweba-dev-xxxxxx`    | Server      | ⏸️     |
| SQL Database   | `sqldb-static-webapp-test-dev` | Database S0 | ⏸️     |
| Static Web App | `stapp-static-webapp-test-dev` | Free        | ⏸️     |

## Outputs (Expected)

```json
{
  "staticWebAppUrl": "https://xxx.azurestaticapps.net",
  "staticWebAppName": "stapp-static-webapp-test-dev",
  "sqlServerFqdn": "sql-staticweba-dev-xxxxxx.database.windows.net",
  "databaseName": "sqldb-static-webapp-test-dev",
  "appInsightsConnectionString": "InstrumentationKey=xxx;..."
}
```

## To Actually Deploy

```powershell
# Navigate to Bicep directory
cd infra/bicep/static-webapp-test

# Preview changes
./deploy.ps1 -WhatIf

# Deploy
./deploy.ps1
```

## Post-Deployment Tasks

- [ ] Configure GitHub repository connection for SWA
- [ ] Set up Azure AD authentication in SWA
- [ ] Configure Application Insights alerts
- [ ] Test database connectivity from Functions

---

_This is a simulated deployment summary for workflow validation._
