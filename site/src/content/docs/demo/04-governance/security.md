---
title: "Security & Network Policies"
description: "Security hardening, cost governance, network isolation policies, and deployment blockers discovered for the Malta catering project"
sidebar:
  order: 2
---

## Security Policies

| Policy           | Requirement                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTPS Only       | Storage accounts are audited for `supportsHttpsTrafficOnly`; set it explicitly to `true` even though no deny was discovered                                                                                 |
| TLS Version      | Governance-created diagnostics storage forces `minimumTlsVersion = TLS1_2`; App Service enforces TLS 1.2 by default                                                                                         |
| Public Access    | Storage blob public access is auto-modified to `false`; Key Vault, Storage, and ACR `publicNetworkAccess` set to `Disabled` with private endpoint access only via VNet integration                          |
| Managed Identity | No direct deny for App Service managed identity was discovered; Storage shared key access is auto-modified off                                                                                              |
| Key Vault        | Key Vault is audited for RBAC mode, firewall/public network restriction, private link, purge protection, soft delete, and diagnostic logs; private endpoint resolves firewall/public-network audit findings |

## Cost Policies

| Policy                       | Constraint                                                                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget                       | No Azure Policy budget cap or spend-deny policy was discovered in the active subscription scope                                                                                         |
| SKU Restrictions             | Active deny controls target VM SKUs, AKS node counts, OpenAI provisioned capacity, and Sentinel commitment tiers; none target App Service Plans, ACR Premium, Storage, or Key Vault     |
| Reserved Capacity            | No reserved-capacity governance control was discovered for this architecture                                                                                                            |
| Governance Support Resources | DeployIfNotExists policies may create `McapsGovernance` and a locked-down diagnostics storage account in `WestUS2`, which introduces small background cost outside the app architecture |

## Network Policies

| Policy            | Constraint                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private Endpoints | Storage, Key Vault, and ACR private endpoints are deployed with private DNS zones; audit/AuditIfNotExists policies are now satisfied by the PE configuration        |
| VNet Integration  | App Service uses VNet integration via delegated subnet (`snet-app`); backend traffic routes through the VNet to private endpoints                                   |
| Public Endpoints  | App Service Web App retains a public endpoint for customer/staff HTTPS access; Key Vault, Storage, and ACR have `publicNetworkAccess: Disabled` with PE-only access |

## Deployment Blockers

:::danger[Deployment Cannot Proceed Without Tag Compliance]
Only one true deployment blocker was discovered: the **JV-Enforce Resource Group Tags v3** policy. All other policies are Audit, Modify, or target resource types not used by this architecture.
:::

### JV-Enforce Resource Group Tags v3

- **Policy ID**: `/providers/Microsoft.Management/managementGroups/2d04cb4c-999b-4e60-a3a7-e8993edc768b/providers/Microsoft.Authorization/policyDefinitions/27833bcf-5909-4a37-891c-16a3cb06856d`
- **Effect**: Deny
- **Scope**: Management group `2d04cb4c-999b-4e60-a3a7-e8993edc768b`
- **Enforcement Mode**: Default
- **Impact**: New resource groups are denied unless all 9 required tags exist: `environment`, `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`, `maint-window`, `technical-contact`
- **Assessment Date**: 2026-04-14

### Resolution Options

1. **Request Policy Exemption** — Justification: demo workload with short lifetime and limited blast radius. Duration: temporary. Risk Level: medium. Approval: governance owner approves a management-group exemption scoped to the target resource group.

2. **Deploy into a Compliant Resource Group** — Ensure the resource group is created with all 9 required tags before app resources are provisioned, or deploy into an existing compliant resource group. Trade-off: slightly more deployment orchestration; no architecture redesign required.

## References

| Topic                             | Link                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Azure Policy                      | [Overview](https://learn.microsoft.com/azure/governance/policy/overview)                                                   |
| Azure Policy REST API             | [Programmatic Management](https://learn.microsoft.com/azure/governance/policy/how-to/programmatically-create)              |
| Azure Resource Graph              | [ARG Overview](https://learn.microsoft.com/azure/governance/resource-graph/overview)                                       |
| Tag Governance                    | [Tagging Strategy](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging) |
