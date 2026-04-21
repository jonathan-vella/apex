---
title: "Architecture Review"
description: "Challenger Agent adversarial review of the architecture assessment for the Malta Catering demo project"
sidebar:
  order: 2
---

**Review Type**: Architecture | **Date**: 2026-04-15 | **Pass**: 1 | **Architecture Version**: App Service S1 + VNet + PE (revised 2026-04-15)

## Previously Resolved

Original Pass 1 findings were against the ACA Consumption architecture. All 5 findings are now resolved by the revised architecture:

| Finding                  | Status   | Resolution                                                                                          |
| ------------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| ARC-001 Backup gap       | RESOLVED | RPO explicitly relaxed to best-effort for demo; production export job path documented               |
| ARC-002 App Insights     | RESOLVED | Application Insights added (free tier, shared Log Analytics workspace)                              |
| ARC-003 GDPR erasure     | RESOLVED | PII/order separation pattern defined with customer\_\* entity deletion + one-way hash               |
| ARC-004 Public endpoints | RESOLVED | VNet + 3 private endpoints for KV, Storage, ACR; public access disabled on backends                 |
| ARC-005 Staff access     | RESOLVED | Entra ID with role claims; separate trust boundaries for customer (social IdP) and staff (Entra ID) |

## Summary

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 2     |
| Low       | 5     |
| **Total** | **7** |

**Verdict**: `PASS_WITH_OBSERVATIONS`

The revised architecture is well-structured and addresses all 5 original Pass 1 findings. The two medium-severity findings relate to Storage Account PE subresource specification — the DNS zone name is inconsistent across artifacts and the PE subresource is ambiguous. These must be resolved before IaC code generation. The five low-severity findings are documentation consistency issues and minor completeness gaps.

## Findings

:::caution[ARCH-001 — Private DNS zone naming inconsistency — 'blob' vs 'table' for Storage Account]
**Category**: accuracy | **Artifact**: 02-architecture-assessment.md, 03-des-cost-estimate.md

The architecture assessment (Resource #7 in Implementation Handoff) and cost estimate line items ('3 zones: blob, vault, acr') both reference 'privatelink.blob.core.windows.net' for the Storage Account. However, ADR-0003 correctly specifies 'privatelink.table.core.windows.net'. Since the primary data service is Table Storage (orders, menu), the PE subresource must target 'table', not 'blob'. Azure Storage private endpoints are per-subresource — a 'blob' PE will NOT route Table Storage traffic over the VNet. If blob access is also needed (the cost estimate shows $0.02/mo blob storage), a 4th PE + DNS zone would be required.

**Recommendation**: Align all artifacts to specify 'privatelink.table.core.windows.net' and PE subresource 'table'. Update the architecture assessment Resource #7 and cost estimate DNS zone descriptions to match ADR-0003. If blob access is required (diagnostics, exports), add a 4th PE (+$7.70/mo) or document that blob traffic over public internet is acceptable.
:::

:::caution[ARCH-002 — Storage Account PE subresource not explicitly specified in architecture assessment]
**Category**: completeness | **Artifact**: 02-architecture-assessment.md

The architecture assessment lists 'Private Endpoints: 3 endpoints — KV, Storage, ACR' throughout without specifying which Storage subresource (blob, table, queue, file) the PE targets. Azure Storage requires a separate PE per subresource. IaC code generation from this spec is ambiguous — an implementer may default to 'blob' (most common) instead of 'table' (actually needed), breaking Table Storage connectivity through the VNet.

**Recommendation**: In the Resource SKU Recommendations and Implementation Handoff sections, explicitly state PE subresources. Example: 'Private Endpoints (×3): Key Vault (vault), Storage Account (table), ACR (registry)'.
:::

:::note[ARCH-003 — Stale 'Container Apps' reference in ADR-0001 compliance section]
**Category**: consistency | **Artifact**: 03-des-adr-0001-app-service-s1-compute.md

ADR-0001 Compliance Considerations section states 'Container Apps deploys within swedencentral Azure region — EU data residency satisfied'. This sentence was carried over from the original ACA-based ADR and should reference App Service.

**Recommendation**: Change to 'App Service deploys within swedencentral Azure region — EU data residency satisfied'.
:::

:::note[ARCH-004 — Stale 'Container Apps' reference in requirements security controls table]
**Category**: consistency | **Artifact**: 01-requirements.md

01-requirements.md Recommended Security Controls table lists Managed Identity notes as 'Container Apps to Key Vault and Storage'. This predates the architecture switch to App Service and was not updated when the architecture was revised.

**Recommendation**: Update to 'App Service to Key Vault and Storage' in the Managed Identity row of the Recommended Security Controls table.
:::

:::note[ARCH-005 — Table Storage write operations cost overestimated by ~$7-8/month]
**Category**: accuracy | **Artifact**: 03-des-cost-estimate.md

The cost estimate assumes 2.6M write operations/month (1 TPS sustained 24/7 × 30 days). However, 1 TPS is the PEAK throughput requirement, not a sustained write rate. A catering outlet with 100-1K daily users generates mostly read operations (menu browsing). Realistic write volume: 50-200 orders/day × 30 days = 1,500-6,000 write ops/month — roughly 400× fewer than estimated. Actual Table Storage cost would be <$1/mo vs the estimated $8.45/mo.

**Recommendation**: Separate read vs write operation estimates using realistic traffic patterns. Example: 200 orders/day = 6,000 writes/month + 5K menu views/day = 150K reads/month. This reduces the Storage line item to ~$1-2/mo.
:::

:::note[ARCH-006 — Missing risk: staging slot resource contention on shared S1 plan]
**Category**: completeness | **Artifact**: 02-architecture-assessment.md

The staging slot is positioned as a key capability for blue-green deployments, but the risk assessment does not mention that both slots share the S1 App Service Plan resources (1 vCPU, 1.75 GiB RAM). During swap validation — when both slots serve traffic simultaneously — resource contention could degrade response times.

**Recommendation**: Add to the Top Architecture Risks table: 'Staging slot shares S1 resources | Operations | Low | Low | Demo traffic is minimal; for production, upgrade to S2/P1v3 before heavy simultaneous slot usage'.
:::

:::note[ARCH-007 — Security baseline gap: allowSharedKeyAccess not explicitly disabled on Storage Account]
**Category**: completeness | **Artifact**: 02-architecture-assessment.md

The project security baseline mandates 'No shared key access on storage (allowSharedKeyAccess: false) — use Entra ID'. The architecture assessment specifies RBAC auth via Managed Identity with 'Storage Table Data Contributor' role, but does not explicitly require disabling shared key access. Leaving shared key access enabled creates a secondary attack vector.

**Recommendation**: Add 'allowSharedKeyAccess: false' to the Security Requirements for Implementation table. Verify that the application's Azure.Data.Tables SDK supports Entra ID authentication (DefaultAzureCredential) for Table Storage operations.
:::

## Scores Assessment

| Pillar      | Score | Assessment                                                                                                                                                                                |
| ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security    | 8     | JUSTIFIED — MI + KV + TLS 1.2 + VNet + 3× PE provides strong defense-in-depth. Gaps (no WAF, social IdP EU boundary) properly documented as acceptable for demo scope.                    |
| Reliability | 7     | JUSTIFIED — 99.95% platform SLA exceeds 99.0% target. Always-on eliminates cold start. Data-loss acceptance for demo is explicit and well-documented.                                     |
| Performance | 9     | SLIGHTLY_GENEROUS — 1 TPS on S1 is trivial and always-on eliminates cold start concerns. No performance testing evidence supports the score. Defensible but 8 would be more conservative. |
| Cost        | 7     | JUSTIFIED — ~$126/mo within EUR 100-500 budget (25% utilization). Higher than consumption models but justified by security posture (VNet + PE).                                           |
| Operations  | 7     | JUSTIFIED — Staging slot, managed TLS, App Insights, familiar PaaS platform. No CI/CD, alerts, or runbooks properly flagged as gaps with production upgrade path noted.                   |
