---
title: "Governance Overview"
description: "Azure Policy discovery results, compliance analysis, and plan adaptations from the Governance Agent for the Malta catering online ordering app"
sidebar:
  order: 4
---

:::tip[Editorial Context]
This artifact was produced by the **Governance Agent** (Step 3.5 of the APEX pipeline).
The Governance Agent queries the live Azure subscription to discover active Azure Policy
assignments — including management-group-inherited policies — and assesses their impact
on the planned architecture. It identifies deployment blockers, required adaptations,
and auto-applied configurations before IaC code generation begins. Governance discovery
runs against the live Azure subscription, not assumed best-practice defaults.
:::

## Discovery Source

Governance constraints were discovered from the live Azure environment and not assumed.

| Query              | Results                       | Timestamp            |
| ------------------ | ----------------------------- | -------------------- |
| REST API Total     | 21 assignments total          | 2026-04-14T14:03:53Z |
| Subscription-scope | 5 direct assignments          | 2026-04-14T14:03:53Z |
| MG-inherited       | 9 inherited assignments       | 2026-04-14T14:03:53Z |
| Resource-group     | 7 RG-scoped assignments       | 2026-04-14T14:03:53Z |
| Deny-effect        | 1 true blocker found          | 2026-04-14T14:03:53Z |
| Tag Policies       | 9 required RG tags discovered | 2026-04-14T14:03:53Z |
| Security Policies  | 10 relevant constraints       | 2026-04-14T14:03:53Z |

**Discovery Method**: Azure Policy MCP (`policy_assignment_list`) plus direct ARM REST (`az rest`) for assignment, policy definition, and initiative `policyRule` inspection

**Subscription**: `noalz` (`00858ffc-dded-4f0f-8bbf-e17fff0d47d9`)
**Tenant**: `2d04cb4c-999b-4e60-a3a7-e8993edc768b`
**Scope**: Full subscription, including management-group-inherited assignments
**Portal Validation**: Not performed in this session; assignment coverage is REST-verified but was not cross-checked in Azure Portal

:::note[Discovery Method]
Governance discovery was completed using direct Azure REST API calls by the governance agent. Policy data below is live and verified.
:::

## Policy Definition Analysis

Deny and DeployIfNotExists policies were verified against their live `policyRule` JSON to avoid false positives from policy display names.

| Policy Display Name                                            | Assignment Scope | Effect            | Actually Blocks                                                                                                           | Evidence from policyRule.if                                                                                                                                                                                           | Bicep Property Path | Required Value                 |
| -------------------------------------------------------------- | ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------ |
| JV-Enforce Resource Group Tags v3                              | Management Group | Deny              | Resource group creation when any required tag is missing                                                                  | `field: "type" = "Microsoft.Resources/subscriptions/resourceGroups"` and `anyOf` missing `environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `technical-contact` | `tags`              | Include all 9 required RG tags |
| Block Azure RM Resource Creation                               | Management Group | Deny              | Classic resource types only; does not block App Service, Storage, Key Vault, ACR, Log Analytics, or App Insights          | `anyOf` checks only `Microsoft.ClassicCompute/*`, `Microsoft.ClassicNetwork/*`, `Microsoft.ClassicStorage/*`, and `Microsoft.MarketplaceApps/classicDevServices`                                                      | N/A                 | N/A                            |
| Not allowed resource types                                     | Management Group | Deny              | Classical resource types only in the active deny initiative; no modern app/data services used by this design were present | Initiative parameter `listOfResourceTypesNotAllowed` contains only classic resource types                                                                                                                             | N/A                 | N/A                            |
| Deny Azure Key Vault Managed HSM with Purge Protection Enabled | Management Group | Deny              | `Microsoft.KeyVault/managedHSMs` only; does not apply to `Microsoft.KeyVault/vaults`                                      | `field: "type" = "Microsoft.KeyVault/managedHSMs"` and `enablePurgeProtection = true`                                                                                                                                 | N/A                 | N/A                            |
| Deploy Resource Group McapsGovernance                          | Management Group | DeployIfNotExists | Auto-creates a support resource group for governance resources                                                            | `field: "type" = "Microsoft.Resources/Subscriptions"`; deployment creates RG `McapsGovernance` in `WestUS2`                                                                                                           | N/A                 | RG `McapsGovernance` exists    |
| Deploy Storage Account for Diagnostic Settings                 | Management Group | DeployIfNotExists | Auto-creates a governance-managed diagnostics storage account                                                             | `field: "type" = "Microsoft.Resources/subscriptions"`; deployment creates StorageV2 with `allowBlobPublicAccess=false`, `allowSharedKeyAccess=false`, `minimumTlsVersion="TLS1_2"`, `publicNetworkAccess="Disabled"`  | N/A                 | Support storage account exists |

**Analysis Notes**:

- The only true deny blocker for this architecture is the **resource-group tag policy**.
- Public endpoint concerns for Storage and Key Vault are currently **audit / modify**, not deny, in the active subscription scope.
- The deny initiative contains no direct App Service, ACR, Key Vault vault, or Storage Account deny policy for modern resource types.
- A governance inconsistency exists: the resource-group deny policy requires `technical-contact`, but the tag inheritance modify policy uses `tech-contact` for child resources.

## Azure Policy Compliance

| Category       | Constraint                                                                                           | Implementation                                                                                                         | Status |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| Naming         | No active deny policy for CAF naming was discovered for this architecture                            | Use normal CAF-style names in Bicep                                                                                    | ✅     |
| Tagging        | Resource groups must include 9 exact tags; child resources are auto-modified to inherit 9 tags       | Pre-create or deploy into a compliant RG and define both `technical-contact` and `tech-contact` to bridge policy drift | ❌     |
| Security       | Storage settings are auto-hardened; Key Vault RBAC / firewall / private link are audit-only controls | Set storage hardening explicitly; VNet integration + private endpoints resolve public endpoint audit warnings          | ✅     |
| Data Residency | No deny on `swedencentral` was discovered in active assignments                                      | Keep all app resources in `swedencentral`; note governance support resources auto-deploy in `WestUS2`                  | ✅     |

:::caution[Tag Compliance Required]
The design is **not deployable into a newly created resource group** until the required tag set is satisfied.
:::

## Plan Adaptations Based on Policies

### Architectural Changes

| Original Design                                                                                         | Blocking Policy                                                                    | Effect                   | Adaptation Applied                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default 4-tag model (`Environment`, `ManagedBy`, `Project`, `Owner`)                                    | JV-Enforce Resource Group Tags v3                                                  | Deny                     | Expand the deployment contract to 9 governance tags on the resource group: `environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `technical-contact`                                                                     |
| Resource tags assumed to be passed directly from IaC only                                               | JV - Inherit Multiple Tags from Resource Group                                     | Modify                   | Keep explicit tags in Bicep anyway to avoid drift and to make compliance visible in code reviews                                                                                                                                                                            |
| Storage account defaults left to platform                                                               | StorageAccount_BlobAnonymousAccess_Modify + StorageAccount_DisableLocalAuth_Modify | Modify                   | Set `allowBlobPublicAccess: false` and `allowSharedKeyAccess: false` explicitly in IaC                                                                                                                                                                                      |
| Public Key Vault and relaxed Storage network posture were treated as provisional architecture decisions | Azure Security Baseline built-ins                                                  | Audit / AuditIfNotExists | **Resolved**: VNet integration + private endpoints for Key Vault, Storage, and ACR eliminate public endpoint exposure. `publicNetworkAccess: Disabled` is set on all three services. This resolves ARC-004 (public endpoint risk) from the original architecture assessment |

### Auto-Applied Resources

| Policy                                         | Effect            | Auto-Applied Resource                                                                                                                                                                   |
| ---------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deploy Resource Group McapsGovernance          | DeployIfNotExists | May auto-create resource group `McapsGovernance` in `WestUS2`                                                                                                                           |
| Deploy Storage Account for Diagnostic Settings | DeployIfNotExists | May auto-create a governance-managed StorageV2 account in `McapsGovernance` with TLS 1.2, HTTPS-only, no blob public access, no shared key access, and `publicNetworkAccess = Disabled` |

### Auto-Modified Configurations

| Policy                                               | Effect | Auto-Applied Change                                                                    |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| JV - Inherit Multiple Tags from Resource Group       | Modify | Adds or replaces 9 child-resource tags from the resource-group tag set                 |
| Ensure secure access to storage account containers   | Modify | Forces `allowBlobPublicAccess = false` unless excluded with `SecurityControl = Ignore` |
| SFI-ID4.2.1 Storage Accounts - Safe Secrets Standard | Modify | Forces `allowSharedKeyAccess = false` unless excluded with `SecurityControl = Ignore`  |
