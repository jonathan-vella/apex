# 06 — Deployment Summary

> **Project**: Contoso Service Hub (Run 3)
> **Generated**: 2026-03-17
> **Status**: ✅ Validated — Not Deployed (Dry Run)

## ✅ Preflight Validation

| Check                     | Result  | Details                                                       |
| ------------------------- | ------- | ------------------------------------------------------------- |
| `bicep build`             | ✅ Pass | Clean build, no errors or warnings                            |
| `bicep lint`              | ✅ Pass | No linting violations                                         |
| Session state consistency | ✅ Pass | All steps 1–5 complete                                        |
| Governance compliance     | ✅ Pass | All 22 policy constraints addressed in templates              |
| AVM module coverage       | ✅ Pass | 15/16 resources use AVM modules (budget uses native resource) |

## 📋 Deployment Details

| Property                   | Value                               |
| -------------------------- | ----------------------------------- |
| **IaC Tool**               | Bicep                               |
| **Target Region**          | swedencentral                       |
| **Resource Group Pattern** | `rg-contoso-service-hub-{env}`      |
| **Deployment Mode**        | Incremental (4-phase)               |
| **Environments**           | dev, staging, prod                  |
| **Total Bicep Files**      | 14 (1 main + 1 params + 12 modules) |
| **Total Lines of Code**    | 1,837                               |
| **Estimated Deploy Time**  | ~80 minutes (all phases)            |

### Deployment Phases

| Phase         | Modules                                  | Resources                                                        | Est. Time |
| ------------- | ---------------------------------------- | ---------------------------------------------------------------- | --------- |
| 1. Foundation | monitoring, keyvault, networking, budget | Log Analytics, App Insights, Key Vault, VNet, 5× NSG, Budget     | ~15 min   |
| 2. Data       | postgresql, redis, storage               | PostgreSQL Flex, Redis Premium, Storage (ZRS), Private Endpoints | ~25 min   |
| 3. Edge       | apim, frontdoor, identity                | APIM (internal VNet), Front Door + WAF, Managed Identity         | ~20 min   |
| 4. Platform   | acr, aks, vm                             | ACR, AKS (3× D8s_v5), VM (D8s_v5)                                | ~20 min   |

## 🏗️ Deployed Resources

> **Note**: Resources listed below are validated but not yet deployed (dry-run mode).

| #   | Resource                   | Azure Type                                       | Module           | AVM Version |
| --- | -------------------------- | ------------------------------------------------ | ---------------- | ----------- |
| 1   | Log Analytics Workspace    | Microsoft.OperationalInsights/workspaces         | monitoring.bicep | 0.15.0      |
| 2   | Application Insights       | Microsoft.Insights/components                    | monitoring.bicep | 0.7.1       |
| 3   | Key Vault                  | Microsoft.KeyVault/vaults                        | keyvault.bicep   | 0.13.3      |
| 4   | Virtual Network            | Microsoft.Network/virtualNetworks                | networking.bicep | 0.7.2       |
| 5   | NSG (×5)                   | Microsoft.Network/networkSecurityGroups          | networking.bicep | 0.5.2       |
| 6   | Consumption Budget         | Microsoft.Consumption/budgets                    | budget.bicep     | Native      |
| 7   | PostgreSQL Flexible Server | Microsoft.DBforPostgreSQL/flexibleServers        | postgresql.bicep | 0.15.2      |
| 8   | Redis Cache (Premium P4)   | Microsoft.Cache/Redis                            | redis.bicep      | 0.16.4      |
| 9   | Storage Account (ZRS)      | Microsoft.Storage/storageAccounts                | storage.bicep    | 0.32.0      |
| 10  | API Management (Internal)  | Microsoft.ApiManagement/service                  | apim.bicep       | 0.14.1      |
| 11  | Front Door + WAF           | Microsoft.Cdn/profiles                           | frontdoor.bicep  | 0.19.0      |
| 12  | User-Assigned MI (CIAM)    | Microsoft.ManagedIdentity/userAssignedIdentities | identity.bicep   | Native      |
| 13  | Container Registry         | Microsoft.ContainerRegistry/registries           | acr.bicep        | 0.11.0      |
| 14  | AKS Cluster                | Microsoft.ContainerService/managedClusters       | aks.bicep        | 0.13.0      |
| 15  | Virtual Machine            | Microsoft.Compute/virtualMachines                | vm.bicep         | 0.21.0      |
| 16  | Private Endpoints (×5)     | Microsoft.Network/privateEndpoints               | various          | 0.12.0      |

## 📤 Outputs (Expected)

| Output                          | Source     | Description                           |
| ------------------------------- | ---------- | ------------------------------------- |
| `logAnalyticsWorkspaceId`       | monitoring | Workspace resource ID for diagnostics |
| `appInsightsInstrumentationKey` | monitoring | Instrumentation key for APM           |
| `keyVaultUri`                   | keyvault   | Key Vault URI for secret references   |
| `vnetId`                        | networking | VNet resource ID                      |
| `aksClusterName`                | aks        | AKS cluster name for kubectl config   |
| `acrLoginServer`                | acr        | ACR login server for image push       |
| `frontDoorEndpoint`             | frontdoor  | Front Door endpoint FQDN              |
| `apimGatewayUrl`                | apim       | APIM internal gateway URL             |

## 🚀 To Actually Deploy

```bash
# 1. Set target resource group
az group create --name rg-contoso-service-hub-prod --location swedencentral

# 2. Deploy phase by phase
az deployment group create \
  --resource-group rg-contoso-service-hub-prod \
  --template-file infra/bicep/contoso-service-hub-run-3/main.bicep \
  --parameters infra/bicep/contoso-service-hub-run-3/main.bicepparam \
  --parameters deploymentPhase=foundation environment=prod

az deployment group create \
  --resource-group rg-contoso-service-hub-prod \
  --template-file infra/bicep/contoso-service-hub-run-3/main.bicep \
  --parameters infra/bicep/contoso-service-hub-run-3/main.bicepparam \
  --parameters deploymentPhase=data environment=prod

az deployment group create \
  --resource-group rg-contoso-service-hub-prod \
  --template-file infra/bicep/contoso-service-hub-run-3/main.bicep \
  --parameters infra/bicep/contoso-service-hub-run-3/main.bicepparam \
  --parameters deploymentPhase=edge environment=prod

az deployment group create \
  --resource-group rg-contoso-service-hub-prod \
  --template-file infra/bicep/contoso-service-hub-run-3/main.bicep \
  --parameters infra/bicep/contoso-service-hub-run-3/main.bicepparam \
  --parameters deploymentPhase=platform environment=prod

# Or deploy all phases at once (not recommended for first deploy):
az deployment group create \
  --resource-group rg-contoso-service-hub-prod \
  --template-file infra/bicep/contoso-service-hub-run-3/main.bicep \
  --parameters infra/bicep/contoso-service-hub-run-3/main.bicepparam \
  --parameters deploymentPhase=all environment=prod
```

## 📝 Post-Deployment Tasks

1. **Configure Entra External ID** — Set up tenant, user flows, and custom policies via Azure Portal or Microsoft Graph API
2. **Upload TLS certificates** — Import custom domain certificates to Key Vault and configure on Front Door
3. **Configure AKS** — Deploy application workloads, set up ingress controllers, configure HPA
4. **Set up CI/CD** — Configure GitHub Actions with OIDC federation for automated deployments
5. **Configure DNS** — Point custom domains to Front Door endpoint
6. **Security hardening** — Enable Microsoft Defender for Cloud, configure alerts
7. **Monitoring** — Create custom dashboards, alert rules, and workbooks in Azure Monitor
8. **Backup verification** — Test PostgreSQL PITR, verify storage snapshots
