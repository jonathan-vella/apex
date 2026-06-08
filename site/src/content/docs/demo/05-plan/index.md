---
title: "IaC Plan Overview"
description: "Implementation plan overview for the Malta catering ordering portal — resource inventory, deployment strategy, and dependency ordering from the IaC Planner Agent"
sidebar:
  order: 5
---

:::tip[Editorial Context]
This artifact was produced by the **IaC Planner Agent** (Step 4 of the APEX pipeline).
The IaC Planner translates the architecture assessment and governance constraints into
a concrete Bicep implementation plan — selecting AVM modules, defining dependency ordering,
and establishing a phased deployment strategy with validation gates between phases.
:::

## Plan Overview

Bicep implementation plan for the Malta Catering ordering portal — a lightweight SPA + API
on Azure App Service (S1) with VNet integration and private endpoints, backed by Table
Storage, Key Vault, and a full observability stack. All architecture resources plus a
cost-monitoring budget are covered by AVM modules or native Bicep resources. Deployment
uses a **5-phase** strategy with dependency-ordered sequencing and validation gates
between phases.

**Governance adaptation**: The resource group must carry 9 tags enforced by a
management-group-level Deny policy (`JV-Enforce Resource Group Tags v3`). The
deployment contract expands beyond the default 4-tag model accordingly. Storage
and Key Vault network hardening are audit-only warnings in the current scope
and are set explicitly in IaC for visibility.

## Resource Inventory

| Resource                   | Type                                       | SKU               | AVM Module                                         | Version      | Dependencies                              |
| -------------------------- | ------------------------------------------ | ----------------- | -------------------------------------------------- | ------------ | ----------------------------------------- |
| Log Analytics Workspace    | `Microsoft.OperationalInsights/workspaces` | Per-GB (free)     | `br/public:avm/res/operational-insights/workspace` | `0.15.0`     | —                                         |
| Application Insights       | `Microsoft.Insights/components`            | Free tier         | `br/public:avm/res/insights/component`             | `0.7.1`      | Log Analytics                             |
| Virtual Network            | `Microsoft.Network/virtualNetworks`        | —                 | `br/public:avm/res/network/virtual-network`        | `0.7.0`      | —                                         |
| Private DNS Zone (KV)      | `Microsoft.Network/privateDnsZones`        | —                 | `br/public:avm/res/network/private-dns-zone`       | `0.7.0`      | VNet                                      |
| Private DNS Zone (Storage) | `Microsoft.Network/privateDnsZones`        | —                 | `br/public:avm/res/network/private-dns-zone`       | `0.7.0`      | VNet                                      |
| Private DNS Zone (ACR)     | `Microsoft.Network/privateDnsZones`        | —                 | `br/public:avm/res/network/private-dns-zone`       | `0.7.0`      | VNet                                      |
| Key Vault                  | `Microsoft.KeyVault/vaults`                | Standard          | `br/public:avm/res/key-vault/vault`                | `0.13.3`     | Log Analytics, VNet, DNS Zone             |
| Storage Account            | `Microsoft.Storage/storageAccounts`        | Standard LRS GPv2 | `br/public:avm/res/storage/storage-account`        | `0.32.0`     | Log Analytics, VNet, DNS Zone             |
| Container Registry         | `Microsoft.ContainerRegistry/registries`   | Premium           | `br/public:avm/res/container-registry/registry`    | `0.12.1`     | Log Analytics, VNet, DNS Zone             |
| App Service Plan           | `Microsoft.Web/serverfarms`                | S1                | `br/public:avm/res/web/serverfarm`                 | `0.4.0`      | —                                         |
| Web App                    | `Microsoft.Web/sites`                      | —                 | `br/public:avm/res/web/site`                       | `0.15.0`     | ASP, VNet, ACR, KV, Storage, App Insights |
| Consumption Budget         | `Microsoft.Consumption/budgets`            | —                 | Native (AVM is MG-scoped only)                     | `2023-11-01` | —                                         |

:::note
**AVM coverage**: 11/12 resources use AVM modules. Budget uses a native Bicep resource because
the AVM budget module (`avm/res/consumption/budget/mg-scope`) targets management-group scope,
not resource-group scope. Container Registry is upgraded to Premium SKU to support private endpoints.
:::

## Deployment Overview

| Phase     | Name                    | Resources  | Est. Deploy Time | Approval Gate |
| --------- | ----------------------- | ---------- | ---------------- | ------------- |
| 1         | Foundation & Monitoring | 2          | ~3 min           | Yes           |
| 2         | Networking              | 4          | ~3 min           | Yes           |
| 3         | Security, Data & Images | 3 (+3 PEs) | ~5 min           | Yes           |
| 4         | Compute                 | 2          | ~6 min           | Yes           |
| 5         | Cost Monitoring         | 1          | ~1 min           | Yes           |
| **Total** |                         | **~12**    | **~18 min**      |               |

## Dependency Diagram

![Dependency Diagram](/demo/04-dependency-diagram.png)
