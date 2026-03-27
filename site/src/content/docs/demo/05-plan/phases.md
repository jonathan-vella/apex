---
title: "Implementation Phases"
sidebar:
  order: 2
---

## 🚀 Deployment Phases

### Phase 1: Foundation (Estimated: 3 min)

| Order | Resource                         | Module                  | Dependencies   |
| ----- | -------------------------------- | ----------------------- | -------------- |
| 1.1   | Resource Group                   | `az group create` (CLI) | None           |
| 1.2   | Virtual Network + Subnets + NSGs | `network.bicep`         | Resource Group |

**Gate**: Verify RG exists with all 9 tags; VNet has correct subnets.

### Phase 2: Observability (Estimated: 2 min)

| Order | Resource                | Module             | Dependencies |
| ----- | ----------------------- | ------------------ | ------------ |
| 2.1   | Log Analytics Workspace | `monitoring.bicep` | Phase 1      |
| 2.2   | Application Insights    | `monitoring.bicep` | Phase 1      |

**Gate**: Verify Log Analytics workspace ID available for downstream modules.

### Phase 3: Security + DNS (Estimated: 3 min)

| Order | Resource                | Module           | Dependencies              |
| ----- | ----------------------- | ---------------- | ------------------------- |
| 3.1   | Key Vault               | `keyvault.bicep` | Phase 1 (VNet)            |
| 3.2   | Private DNS Zone (SQL)  | `dns.bicep`      | Phase 1 (VNet)            |
| 3.3   | Private DNS Zone (Blob) | `dns.bicep`      | Phase 1 (VNet)            |
| 3.4   | Private DNS Zone (KV)   | `dns.bicep`      | Phase 1 (VNet)            |
| 3.5   | Private Endpoint (KV)   | `keyvault.bicep` | Phase 1 (VNet), 3.4 (DNS) |

**Gate**: Verify Key Vault accessible via PE; DNS zones linked to VNet.

### Phase 4: Data (Estimated: 5 min)

| Order | Resource                    | Module          | Dependencies                        |
| ----- | --------------------------- | --------------- | ----------------------------------- |
| 4.1   | Azure SQL Server + Database | `sql.bicep`     | Phase 2 (monitoring), Phase 3 (DNS) |
| 4.2   | Private Endpoint (SQL)      | `sql.bicep`     | Phase 1 (VNet), Phase 3 (DNS)       |
| 4.3   | Storage Account             | `storage.bicep` | Phase 2 (monitoring), Phase 3 (DNS) |
| 4.4   | Private Endpoint (Storage)  | `storage.bicep` | Phase 1 (VNet), Phase 3 (DNS)       |

**Gate**: Verify SQL + Storage accessible via private endpoints; public access disabled.

### Phase 5: Compute + Budget (Estimated: 4 min)

| Order | Resource           | Module          | Dependencies                                                 |
| ----- | ------------------ | --------------- | ------------------------------------------------------------ |
| 5.1   | App Service Plan   | `compute.bicep` | Phase 1 (VNet)                                               |
| 5.2   | App Service        | `compute.bicep` | Phase 2 (App Insights), Phase 3 (KV), Phase 4 (SQL, Storage) |
| 5.3   | Role Assignments   | `compute.bicep` | Phase 5.2 (MI principal ID)                                  |
| 5.4   | Autoscale Settings | `compute.bicep` | Phase 5.1 (ASP)                                              |
| 5.5   | Budget Alert       | `budget.bicep`  | Resource Group                                               |

**Gate**: Verify App Service health endpoint responds; MI can access KV and Storage; SQL contained user created for App Service MI.

### Total Estimated Deployment Time: ~17 minutes (excluding approval gates)

---
