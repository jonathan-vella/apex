# Step 6: Deployment Summary - Agent Testing Framework

> **Status**: ✅ Deployment Successful | **Step**: 6 of 7 (deploy)
>
> Deployment completed on 2026-01-22 at 13:16 UTC

---

## Preflight Validation

| Property             | Value            |
| -------------------- | ---------------- |
| **Project Type**     | standalone-bicep |
| **Deployment Scope** | resourceGroup    |
| **Validation Level** | Provider         |
| **Bicep Build**      | ✅ Pass          |
| **What-If Status**   | ✅ Pass          |

### Change Summary

| Change Type  | Count | Resources Affected                                |
| ------------ | ----- | ------------------------------------------------- |
| Create (+)   | 15    | SWA, App Service, SQL, Container Apps, Key Vaults |
| Delete (-)   | 0     | —                                                 |
| Modify (~)   | 0     | —                                                 |
| NoChange (=) | 0     | —                                                 |

### Validation Issues

✅ No issues found. All three scenarios deployed successfully.

---

## Deployment Details

| Property               | Value                                        |
| ---------------------- | -------------------------------------------- |
| **Deployment Name**    | agent-testing-20260122-131546                |
| **Resource Group**     | rg-agenttest-test-swc                        |
| **Subscription**       | noalz (00858ffc-dded-4f0f-8bbf-e17fff0d47d9) |
| **Location**           | swedencentral                                |
| **Duration**           | 46 seconds                                   |
| **Provisioning State** | Succeeded                                    |

---

## Deployed Resources

### Scenario 1: Static Web App

| Resource Type  | Name                                | URL                                                  |
| -------------- | ----------------------------------- | ---------------------------------------------------- |
| Static Web App | stapp-test-agent-testing-weu-chw5en | https://polite-grass-0413f0403.2.azurestaticapps.net |

### Scenario 2: Multi-tier (API + Database)

| Resource Type    | Name                               | Endpoint                                                    |
| ---------------- | ---------------------------------- | ----------------------------------------------------------- |
| App Service Plan | plan-test-agent-testing-swc-chw5en | B1 Linux                                                    |
| App Service      | app-test-agent-testing-swc-chw5en  | https://app-test-agent-testing-swc-chw5en.azurewebsites.net |
| SQL Server       | sql-test-agent-testing-swc-chw5en  | sql-test-agent-testing-swc-chw5en.database.windows.net      |
| SQL Database     | testdb                             | Basic tier                                                  |
| Key Vault        | kv-s2-swc-chw5ensf                 | https://kv-s2-swc-chw5ensf.vault.azure.net/                 |

✅ **SQL Server Security Configuration:**

- Entra ID-only authentication: **Enabled**
- SQL authentication: **Disabled**
- Zone redundancy: **Disabled**
- TLS 1.2: **Required**

### Scenario 3: Microservices

| Resource Type              | Name                                  | Endpoint                                                             |
| -------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Container Apps Environment | cae-test-agent-testing-swc-chw5en     | happysky-0bc10407.swedencentral.azurecontainerapps.io                |
| Container App              | ca-cae-test-agent-testi               | Hello World sample                                                   |
| Log Analytics Workspace    | log-cae-test-agent-testing-swc-chw5en | 30-day retention                                                     |
| Service Bus Namespace      | sb-test-agent-testing-swc-chw5en      | https://sb-test-agent-testing-swc-chw5en.servicebus.windows.net:443/ |
| Service Bus Queue          | test-queue                            | Basic tier                                                           |
| Storage Account            | sttestagenttchw5ensf                  | https://sttestagenttchw5ensf.blob.core.windows.net/                  |
| Blob Container             | test-data                             | Private access                                                       |
| Key Vault                  | kv-s3-swc-chw5ensf                    | https://kv-s3-swc-chw5ensf.vault.azure.net/                          |

---

## Outputs (Expected)

```json
{
  "staticWebAppUrl": "polite-grass-0413f0403.2.azurestaticapps.net",
  "appServiceUrl": "app-test-agent-testing-swc-chw5en.azurewebsites.net",
  "sqlServerFqdn": "sql-test-agent-testing-swc-chw5en.database.windows.net",
  "keyVaultUriScenario2": "https://kv-s2-swc-chw5ensf.vault.azure.net/",
  "containerAppsEnvDomain": "happysky-0bc10407.swedencentral.azurecontainerapps.io",
  "serviceBusEndpoint": "https://sb-test-agent-testing-swc-chw5en.servicebus.windows.net:443/",
  "storageBlobEndpoint": "https://sttestagenttchw5ensf.blob.core.windows.net/",
  "keyVaultUriScenario3": "https://kv-s3-swc-chw5ensf.vault.azure.net/"
}
```

---

## To Actually Deploy

```powershell
# Navigate to Bicep directory
cd infra/bicep/agent-testing

# Preview changes
./deploy.ps1 -WhatIf

# Deploy
./deploy.ps1
```

## Post-Deployment Tasks

- [x] Verify resources in Azure Portal
- [x] Run resource health validation
- [ ] Run agent tests against deployed infrastructure
- [ ] Enable cleanup automation after committing script
- [ ] Generate as-built documentation (Step 7)

---

## Resource Links

| Resource       | Azure Portal Link                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource Group | [rg-agenttest-test-swc](https://portal.azure.com/#@lordofthecloud.eu/resource/subscriptions/00858ffc-dded-4f0f-8bbf-e17fff0d47d9/resourceGroups/rg-agenttest-test-swc/overview)                                                                                       |
| Static Web App | [stapp-test-agent-testing-weu-chw5en](https://portal.azure.com/#@lordofthecloud.eu/resource/subscriptions/00858ffc-dded-4f0f-8bbf-e17fff0d47d9/resourceGroups/rg-agenttest-test-swc/providers/Microsoft.Web/staticSites/stapp-test-agent-testing-weu-chw5en/overview) |
| App Service    | [app-test-agent-testing-swc-chw5en](https://portal.azure.com/#@lordofthecloud.eu/resource/subscriptions/00858ffc-dded-4f0f-8bbf-e17fff0d47d9/resourceGroups/rg-agenttest-test-swc/providers/Microsoft.Web/sites/app-test-agent-testing-swc-chw5en/overview)           |
| SQL Server     | [sql-test-agent-testing-swc-chw5en](https://portal.azure.com/#@lordofthecloud.eu/resource/subscriptions/00858ffc-dded-4f0f-8bbf-e17fff0d47d9/resourceGroups/rg-agenttest-test-swc/providers/Microsoft.Sql/servers/sql-test-agent-testing-swc-chw5en/overview)         |

---

## Known Issues

### Automation Account Not Deployed

The cleanup automation was skipped because the PowerShell script reference URL is not yet available in the GitHub repository.

**Resolution**: After committing `scripts/cleanup-test-resources.ps1` to the repository, run:

```bash
az deployment group create \
  --resource-group rg-agenttest-test-swc \
  --template-file infra/bicep/agent-testing/main.bicep \
  --parameters deployCleanupAutomation=true \
  --parameters deployScenario1=false deployScenario2=false deployScenario3=false
```

---

## Cleanup Instructions

Resources are tagged with `TTL: 2h` for identification. To manually delete:

```bash
az group delete --name rg-agenttest-test-swc --yes --no-wait
```

---

## Next Steps

1. ✅ Deployment complete - verify resources in Azure Portal
2. 🔜 Run agent tests against deployed infrastructure
3. 🔜 Commit cleanup script to enable automation
4. 🔜 Generate as-built documentation (Step 7)

---

## Related Documents

| Document                                                         | Purpose                     |
| ---------------------------------------------------------------- | --------------------------- |
| [01-requirements.md](01-requirements.md)                         | Test framework requirements |
| [02-architecture-assessment.md](02-architecture-assessment.md)   | WAF assessment              |
| [04-implementation-plan.md](04-implementation-plan.md)           | Implementation details      |
| [05-implementation-reference.md](05-implementation-reference.md) | Bicep code reference        |
