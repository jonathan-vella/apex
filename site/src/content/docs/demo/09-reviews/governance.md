---
title: "Governance Review"
description: "Challenger Agent adversarial review of the governance constraints for the Malta Catering demo project"
sidebar:
  order: 3
---

**Review Type**: Governance | **Date**: 2026-04-15 | **Pass**: 1 | **Architecture Version**: App Service S1 + VNet + PE

## Summary

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 3     |
| Low       | 1     |
| **Total** | **4** |

**Verdict**: `PASS_WITH_FINDINGS`

The governance constraints document is thorough and well-evidenced from live REST API discovery. The only true deployment blocker (9-tag resource group deny policy) is correctly identified and mitigated. No critical or high severity findings. Three medium findings relate to documentation consistency and a gap in App Service public endpoint assessment. All findings are addressable without architectural changes.

## Findings

:::caution[GOV-001 — Preflight check retains Container Apps terminology]
**Category**: consistency | **Artifact**: 04-preflight-check.md

The preflight check (04-preflight-check.md) contains a collapsible section titled 'Managed Environment Parameters' which is Azure Container Apps terminology. The content within the section actually describes App Service Plan parameters (kind, reserved, skuName, skuCapacity). This is a leftover from a previous architecture iteration that used Container Apps and was not updated when the design pivoted to App Service.

**Recommendation**: Rename the section from 'Managed Environment Parameters' to 'App Service Plan Parameters' in 04-preflight-check.md.
:::

:::caution[GOV-002 — No governance assessment of App Service public endpoint]
**Category**: compliance | **Artifact**: 04-governance-constraints.md

The governance constraints document thoroughly documents that Key Vault, Storage, and ACR have publicNetworkAccess set to 'Disabled' with PE-only access. However, the Web App retains a public HTTPS endpoint for customer/staff access. The document does not assess whether the Azure Security Baseline initiative (assigned at management group scope) audits public network access on App Service resources. If the initiative's AuditIfNotExists policies cover Microsoft.Web/sites, the deployment would generate a non-compliant resource in the Azure Policy compliance dashboard.

**Recommendation**: Add an explicit governance assessment row for App Service public endpoint. Document whether the Azure Security Baseline initiative audits public network access on Microsoft.Web/sites and, if so, whether this is accepted as a known audit finding for the customer-facing web tier.
:::

:::caution[GOV-004 — Tag key casing drift between governance requirements and IaC code]
**Category**: consistency | **Artifact**: 04-governance-constraints.md

The governance deny policy requires lowercase tag keys: 'environment', 'owner'. The Bicep code in main.bicep uses PascalCase: 'Environment', 'Owner'. Azure Policy tag evaluation is case-insensitive, so this will not cause a deployment failure. However, the visual inconsistency between the governance requirement documentation (lowercase) and the IaC code (PascalCase) creates confusion for compliance reviewers. Additionally, the Modify policy that inherits tags from the resource group may create child resources with both casings.

**Recommendation**: Align tag key casing in main.bicep governanceTags to match the governance document exactly: use lowercase 'environment' and 'owner' instead of PascalCase 'Environment' and 'Owner'.
:::

:::note[GOV-003 — Portal validation deferred — incomplete audit trail]
**Category**: risk | **Artifact**: 04-governance-constraints.md

The governance document states 'Portal Validation: Not performed in this session' and 'assignment coverage is REST-verified but was not cross-checked in Azure Portal'. While the REST API discovery covered 21 assignments, the absence of portal cross-validation means there is no secondary confirmation that all active assignments were captured.

**Recommendation**: Track portal validation as an open action item in the deployment checklist. Before the first actual deployment, perform a manual portal check of Azure Policy > Assignments at the subscription scope and compare the count to the REST-discovered 21. Consider changing discovery_status to COMPLETE_PENDING_PORTAL_VERIFICATION in the JSON.
:::
