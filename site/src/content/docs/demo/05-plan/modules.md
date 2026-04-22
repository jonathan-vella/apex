---
title: "Module Architecture"
description: "Bicep module structure, AVM sources, naming conventions, and security configuration for the Malta catering infrastructure"
sidebar:
  order: 1
---

## Module Structure

```text
infra/bicep/malta-catering/
├── main.bicep                          # Orchestration — phased module calls
├── main.bicepparam                     # Parameter file (.bicepparam format)
├── modules/
│   ├── log-analytics.bicep             # AVM: operational-insights/workspace
│   ├── app-insights.bicep              # AVM: insights/component
│   ├── virtual-network.bicep           # AVM: network/virtual-network
│   ├── private-dns-zones.bicep         # AVM: network/private-dns-zone (×3)
│   ├── key-vault.bicep                 # AVM: key-vault/vault + PE
│   ├── storage.bicep                   # AVM: storage/storage-account + PE
│   ├── container-registry.bicep        # AVM: container-registry/registry + PE
│   ├── app-service-plan.bicep          # AVM: web/serverfarm
│   ├── web-app.bicep                   # AVM: web/site + VNet integration
│   └── budget.bicep                    # Native: Microsoft.Consumption/budgets
└── deploy.ps1                          # Deployment script with what-if
```

## Module Table

| Module                   | AVM Source                                         | Version  | Purpose                                     |
| ------------------------ | -------------------------------------------------- | -------- | ------------------------------------------- |
| log-analytics.bicep      | `br/public:avm/res/operational-insights/workspace` | `0.15.0` | Shared log sink for all resources           |
| app-insights.bicep       | `br/public:avm/res/insights/component`             | `0.7.1`  | Application-level telemetry                 |
| virtual-network.bicep    | `br/public:avm/res/network/virtual-network`        | `0.7.0`  | VNet with subnets for ASP + PE              |
| private-dns-zones.bicep  | `br/public:avm/res/network/private-dns-zone`       | `0.7.0`  | DNS zones for KV, Storage, ACR PEs          |
| key-vault.bicep          | `br/public:avm/res/key-vault/vault`                | `0.13.3` | Secrets management with RBAC auth + PE      |
| storage.bicep            | `br/public:avm/res/storage/storage-account`        | `0.32.0` | Table Storage for orders and menu data + PE |
| container-registry.bicep | `br/public:avm/res/container-registry/registry`    | `0.12.1` | Premium-tier image registry + PE            |
| app-service-plan.bicep   | `br/public:avm/res/web/serverfarm`                 | `0.4.0`  | S1 App Service Plan (Linux)                 |
| web-app.bicep            | `br/public:avm/res/web/site`                       | `0.15.0` | React SPA + API with MI + VNet integration  |
| budget.bicep             | Native `Microsoft.Consumption/budgets@2023-11-01`  | —        | Cost monitoring with forecast alerts        |

## Naming Conventions

| Resource                | Pattern                     | Example (dev)               | Generated Name                |
| ----------------------- | --------------------------- | --------------------------- | ----------------------------- |
| Resource Group          | `rg-{project}-{env}`        | `rg-malta-catering-dev`     | `rg-malta-catering-dev`       |
| Log Analytics Workspace | `log-{project}-{env}`       | `log-malta-catering-dev`    | `log-malta-catering-dev`      |
| Application Insights    | `appi-{project}-{env}`      | `appi-malta-catering-dev`   | `appi-malta-catering-dev`     |
| Virtual Network         | `vnet-{project}-{env}`      | `vnet-malta-catering-dev`   | `vnet-malta-catering-dev`     |
| App Service Plan        | `asp-{project}-{env}`       | `asp-malta-catering-dev`    | `asp-malta-catering-dev`      |
| Web App                 | `app-{project}-{env}`       | `app-malta-catering-dev`    | `app-malta-catering-dev`      |
| Key Vault               | `kv-{short}-{env}-{suffix}` | `kv-malta-dev-a1b2`         | `kv-malta-dev-{uniqueSuffix}` |
| Storage Account         | `st{short}{env}{suffix}`    | `stmaltadeva1b2`            | `stmaltadev{uniqueSuffix}`    |
| Container Registry      | `acr{short}{env}{suffix}`   | `acrmaltadeva1b2`           | `acrmaltadev{uniqueSuffix}`   |
| Consumption Budget      | `budget-{project}-{env}`    | `budget-malta-catering-dev` | `budget-malta-catering-dev`   |

:::note
`{suffix}` = first 4-6 characters of `uniqueString(resourceGroup().id)`, applied only to
globally-unique names (Storage Account, Key Vault, Container Registry).
:::

### Governance Tag Contract (9 Required Tags on Resource Group)

| Tag                 | Source    | Value (dev)             |
| ------------------- | --------- | ----------------------- |
| `environment`       | Parameter | `dev`                   |
| `owner`             | Parameter | _(user-supplied)_       |
| `costcenter`        | Parameter | _(user-supplied)_       |
| `application`       | Parameter | `malta-catering`        |
| `workload`          | Parameter | `ordering-portal`       |
| `sla`               | Parameter | `99.0`                  |
| `backup-policy`     | Parameter | `none-demo`             |
| `maint-window`      | Parameter | `sun-02-06`             |
| `technical-contact` | Parameter | _(user-supplied email)_ |

## Security Configuration

| Resource            | Security Setting                     | Value                                                  |
| ------------------- | ------------------------------------ | ------------------------------------------------------ |
| Storage Account     | `minimumTlsVersion`                  | `TLS1_2`                                               |
| Storage Account     | `supportsHttpsTrafficOnly`           | `true`                                                 |
| Storage Account     | `allowBlobPublicAccess`              | `false`                                                |
| Storage Account     | `allowSharedKeyAccess`               | `false` (Entra ID only)                                |
| Storage Account     | Private Endpoint                     | `snet-pe` subnet, `privatelink.table.core.windows.net` |
| Key Vault           | `enableRbacAuthorization`            | `true`                                                 |
| Key Vault           | `enablePurgeProtection`              | `true`                                                 |
| Key Vault           | `enableSoftDelete`                   | `true` (7-day retention)                               |
| Key Vault           | Private Endpoint                     | `snet-pe` subnet, `privatelink.vaultcore.azure.net`    |
| Container Registry  | `adminUserEnabled`                   | `false`                                                |
| Container Registry  | SKU                                  | `Premium` (required for PE)                            |
| Container Registry  | Private Endpoint                     | `snet-pe` subnet, `privatelink.azurecr.io`             |
| Web App             | `managedIdentities.systemAssigned`   | `true`                                                 |
| Web App             | `http20Enabled`                      | `true`                                                 |
| Web App             | VNet Integration                     | `snet-app` subnet delegation                           |
| Web App → Key Vault | Role: Key Vault Secrets User         | System-assigned MI                                     |
| Web App → Storage   | Role: Storage Table Data Contributor | System-assigned MI                                     |
| Web App → ACR       | Role: AcrPull                        | System-assigned MI                                     |
| All resources       | Diagnostic settings                  | All logs + metrics → Log Analytics                     |
