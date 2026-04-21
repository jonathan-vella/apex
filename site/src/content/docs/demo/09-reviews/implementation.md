---
title: "Implementation Review"
description: "Challenger Agent adversarial review of the Bicep implementation for the Malta Catering demo project"
sidebar:
  order: 4
---

**Review Type**: Implementation | **Date**: 2026-04-15 | **Pass**: 1 | **Architecture Version**: App Service S1 + VNet + PE

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 1      |
| High      | 2      |
| Medium    | 3      |
| Low       | 5      |
| **Total** | **11** |

**Verdict**: `FAIL`

One critical bug (IMP-001: ACR Standard SKU with private endpoints) will cause deployment failure. Two high-severity issues will cause functional problems: VNet address parameters are declared but never forwarded to the module (IMP-002), and the staging slot is non-functional without managed identity or RBAC (IMP-003). These three findings must be fixed before deployment. The remaining 8 findings are documentation consistency, compliance improvements, and minor security hardening.

**Must fix before deploy**: IMP-001, IMP-002, IMP-003

## Findings

:::danger[IMP-001 — Container Registry SKU is 'Standard' — private endpoints require 'Premium']
**Category**: correctness | **Artifact**: modules/container-registry.bicep

In modules/container-registry.bicep, the ACR SKU is set to 'Standard' (acrSku: 'Standard'). The Standard SKU does NOT support private endpoints. The module also configures a private endpoint with DNS zone group, which will cause a deployment failure at the ARM level because the PE feature is gated behind the Premium SKU. This directly contradicts the implementation plan, preflight check, and governance document, all of which explicitly state ACR should use Premium SKU.

**Recommendation**: Change acrSku from 'Standard' to 'Premium' in modules/container-registry.bicep. This is a one-line fix: `acrSku: 'Premium'`.
:::

:::caution[IMP-002 — VNet address parameters declared in main.bicep but never passed to virtual-network module]
**Category**: correctness | **Artifact**: main.bicep

main.bicep declares three VNet-related parameters: vnetAddressPrefix (default '10.0.0.0/16'), appServiceSubnetPrefix (default '10.0.1.0/24'), and privateEndpointSubnetPrefix (default '10.0.2.0/24'). However, the virtualNetwork module call only passes name, location, tags, and logAnalyticsWorkspaceResourceId — the three address parameters are never forwarded. The deployed VNet will have a /24 address space with two /27 subnets (30 usable IPs each) instead of the planned /16 address space with two /24 subnets (254 usable IPs each).

**Recommendation**: Pass the three address parameters from main.bicep to the virtualNetwork module call: addressPrefix: vnetAddressPrefix, appServiceSubnetPrefix: appServiceSubnetPrefix, privateEndpointsSubnetPrefix: privateEndpointSubnetPrefix.
:::

:::caution[IMP-003 — Staging slot lacks managed identity, app settings, and RBAC — non-functional for blue-green deployment]
**Category**: correctness | **Artifact**: modules/web-app.bicep

The staging slot defined in modules/web-app.bicep only configures siteConfig (linuxFxVersion, acrUseManagedIdentityCreds, http20Enabled, minTlsVersion, ftpsState, alwaysOn). It does NOT define: (1) managedIdentities — without this, the slot has no identity and acrUseManagedIdentityCreds cannot work; (2) appSettingsKeyValuePairs — the slot won't have APPLICATIONINSIGHTS_CONNECTION_STRING, storage, or Key Vault settings; (3) RBAC role assignments — even if the slot gets an identity, it has no permissions.

**Recommendation**: Add managedIdentities and appSettingsKeyValuePairs to the staging slot configuration. Create separate RBAC role assignments for the staging slot's principal ID. Alternatively, if the staging slot is not needed for the demo, remove it or default enableStagingSlot to false.
:::

:::caution[IMP-004 — Implementation reference AVM version table shows 'latest' for pinned modules]
**Category**: consistency | **Artifact**: 05-implementation-reference.md

The 05-implementation-reference.md AVM Module Versions table lists 'latest' for Log Analytics (actual: 0.15.0), App Insights (actual: 0.7.1), Key Vault (actual: 0.13.3), Storage (actual: 0.32.0), and Container Registry (actual: 0.12.1). The actual Bicep code uses explicit pinned version references.

**Recommendation**: Update the AVM Module Versions table in 05-implementation-reference.md to show the actual pinned versions matching the Bicep code.
:::

:::caution[IMP-005 — Storage account diagnostic settings capture only metrics — no operation logs]
**Category**: compliance | **Artifact**: modules/storage.bicep

The storage account module configures diagnosticSettings with only metricCategories (AllMetrics) at both the account and table-service levels. No logCategoriesAndGroups are specified. This means storage read/write/delete operations are not captured in Log Analytics. Azure Security Baseline best practices recommend enabling StorageRead, StorageWrite, and StorageDelete logs.

**Recommendation**: Add logCategoriesAndGroups with categoryGroup 'allLogs' or specific categories (StorageRead, StorageWrite, StorageDelete) to the storage account diagnostic settings.
:::

:::caution[IMP-006 — Budget API version differs between implementation plan and code]
**Category**: consistency | **Artifact**: 04-implementation-plan.md

The implementation plan resource inventory table lists the budget as using API version '2023-11-01'. The actual budget.bicep module uses 'Microsoft.Consumption/budgets@2024-08-01'. The code uses a newer API version, which is fine functionally, but the plan document is stale.

**Recommendation**: Update the implementation plan resource inventory table to reflect the actual API version 2024-08-01 used in the code.
:::

:::note[IMP-007 — Phase 'cost-monitoring' is functionally identical to 'all']
**Category**: correctness | **Artifact**: main.bicep

The condition variable arrays in main.bicep make 'cost-monitoring' deploy all 5 phases: deployNetworking, deploySecurityDataImages, deployCompute, and deployCostMonitoring all include 'cost-monitoring' in their arrays. This means selecting phase='cost-monitoring' deploys everything — identical to phase='all'.

**Recommendation**: Either remove 'cost-monitoring' from the earlier phase condition arrays so it only deploys the budget module, or document that 'cost-monitoring' is an alias for 'all'.
:::

:::note[IMP-008 — Key Vault softDeleteRetentionInDays set to 7 — minimum allowed]
**Category**: security | **Artifact**: modules/key-vault.bicep

The Key Vault module sets softDeleteRetentionInDays: 7, which is the minimum allowed by Azure. The Azure default is 90 days. For a demo workload this is acceptable, but the 7-day window provides minimal protection against accidental deletion.

**Recommendation**: Consider increasing softDeleteRetentionInDays to 30 for better data protection, even for demo workloads. Document the 7-day choice as an explicit ADR if retained.
:::

:::note[IMP-009 — Private DNS zones have no diagnostic settings]
**Category**: compliance | **Artifact**: modules/private-dns-zones.bicep

The private-dns-zones.bicep module creates three DNS zones but does not configure any diagnosticSettings. While DNS zone diagnostics are limited (primarily query volume metrics), other modules consistently apply diagnostic settings for completeness.

**Recommendation**: Add diagnosticSettings to the private DNS zone AVM module calls for consistency across all resources.
:::

:::note[IMP-010 — Redundant networkAcls on Key Vault and Storage with publicNetworkAccess: 'Disabled']
**Category**: consistency | **Artifact**: modules/key-vault.bicep

Both key-vault.bicep and storage.bicep set publicNetworkAccess: 'Disabled' AND networkAcls with defaultAction: 'Deny'. When publicNetworkAccess is Disabled, the networkAcls firewall rules are irrelevant because no public traffic reaches the resource. The redundant configuration adds visual noise.

**Recommendation**: Remove the networkAcls block from both modules since publicNetworkAccess: 'Disabled' makes it moot. Alternatively, add a code comment explaining the defense-in-depth intent.
:::

:::note[IMP-011 — App Insights connection string exposed in main.bicep deployment outputs]
**Category**: security | **Artifact**: main.bicep

main.bicep exposes the App Insights connection string as a deployment output. The connection string is also properly stored in Key Vault as a secret. The deployment output makes it visible in the Azure deployment history to anyone with Reader access on the resource group. While not highly sensitive, this contradicts the pattern of routing secrets through Key Vault.

**Recommendation**: Remove the appInsightsConnectionString output from main.bicep or mark it with @secure() annotation. The connection string is already available through the Key Vault secret.
:::
