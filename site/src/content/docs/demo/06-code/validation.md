---
title: "Validation Results"
description: "Bicep build, lint, and security baseline validation results plus preflight AVM checks for the Malta catering infrastructure"
sidebar:
  order: 2
---

## Validation Status

| Check                            | Result   | Details                                                                        |
| -------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `bicep build`                    | Pass     | Passed with no blocking errors.                                                |
| `bicep lint`                     | Pass     | Passed. No local lint violations remain.                                       |
| `validate:iac-security-baseline` | Pass     | Passed after resolving tag casing and public network access hard gates.        |
| `lint:artifact-templates`        | Pass     | Passed with one non-blocking documentation warning addressed in this artifact. |
| `what-if`                        | Deferred | Deferred to Step 6 deployment workflow.                                        |

## Key Implementation Notes

| Note                                                                                                                                             | Impact                                                                            | Reference                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `uniqueSuffix` is generated once and reused for globally unique names.                                                                           | Stable naming across Key Vault, Storage, and ACR.                                 | `main.bicep`                                       |
| Phase selection includes prerequisites implicitly in code ordering (foundation → networking → security-data-images → compute → cost-monitoring). | Later phases can redeploy safely without broken outputs.                          | `main.bicep`                                       |
| Resource-group deny-policy tags are applied in `deploy.ps1` before Bicep runs.                                                                   | Prevents hard-fail on first deployment.                                           | `deploy.ps1`                                       |
| Key Vault stores the Application Insights connection string for the Web App to resolve through managed identity.                                 | Avoids inline secret values in Web App configuration.                             | `modules/key-vault.bicep`, `modules/web-app.bicep` |
| Web App RBAC is created after the app identity exists.                                                                                           | Grants `AcrPull`, `Key Vault Secrets User`, and `Storage Table Data Contributor`. | `modules/web-app.bicep`                            |

```bicep
var uniqueSuffix = take(toLower(uniqueString(resourceGroup().id)), 6)
```

## Preflight AVM Check

The preflight check validated all AVM module schemas before code generation.

### Summary

| Check                            | Status | Notes                                                                 |
| -------------------------------- | ------ | --------------------------------------------------------------------- |
| All AVM modules verified         | Pass   | 9 AVM-backed resources + 1 native validated.                          |
| Parameter types confirmed        | Pass   | Module-specific pitfalls translated into wrapper inputs.              |
| Region limitations handled       | Pass   | No blocker for `swedencentral`; SKU-specific caveats handled in code. |
| VNet + PE configuration verified | Pass   | Subnet delegation, PE DNS zones, and network isolation validated.     |
| Governance gate satisfied        | Pass   | Deny-policy requirement is met by pre-tagging the resource group.     |
| Pitfalls addressed               | Pass   | No unresolved AVM or policy blocker remains.                          |

### AVM Schema Validation

| Resource                | AVM Module Path                                    | Version      | Status |
| ----------------------- | -------------------------------------------------- | ------------ | ------ |
| Log Analytics Workspace | `br/public:avm/res/operational-insights/workspace` | `0.15.0`     | Pass   |
| Application Insights    | `br/public:avm/res/insights/component`             | `0.7.1`      | Pass   |
| Virtual Network         | `br/public:avm/res/network/virtual-network`        | `0.7.0`      | Pass   |
| Private DNS Zone (×3)   | `br/public:avm/res/network/private-dns-zone`       | `0.7.0`      | Pass   |
| Key Vault               | `br/public:avm/res/key-vault/vault`                | `0.13.3`     | Pass   |
| Storage Account         | `br/public:avm/res/storage/storage-account`        | `0.32.0`     | Pass   |
| Container Registry      | `br/public:avm/res/container-registry/registry`    | `0.12.1`     | Pass   |
| App Service Plan        | `br/public:avm/res/web/serverfarm`                 | `0.4.0`      | Pass   |
| Web App                 | `br/public:avm/res/web/site`                       | `0.15.0`     | Pass   |
| Consumption Budget      | Native `Microsoft.Consumption/budgets@2024-08-01`  | `2024-08-01` | Pass   |

### Key Checks

- Log Analytics `dailyQuotaGb` uses string type
- App Service Plan uses `kind: linux` with `reserved: true` for Linux container hosting
- Web App uses `siteConfig.linuxFxVersion` with `DOCKER|` prefix for ACR image
- Private endpoints use `snet-pe` subnet with matching private DNS zone groups
- App Insights uses `connectionString` — no deprecated instrumentation-key-only pattern
- Managed identity is used for Web App secrets, ACR pull, and Storage access
- Resource-group deny-policy tags are applied before deployment in `deploy.ps1`
- Storage hardening is explicit rather than relying on defaults
- Key Vault, Storage, and ACR `publicNetworkAccess` set to `Disabled` with PE access only
