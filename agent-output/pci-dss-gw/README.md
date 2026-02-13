<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-4%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-TBD-purple?style=for-the-badge)

# 🏗️ pci-dss-gw

**PCI-DSS Level 1 payment gateway architecture and implementation planning artifacts (10,000 TPS target)**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value           |
| ------------------ | --------------- |
| **Created**        | 2026-02-09      |
| **Last Updated**   | 2026-02-12      |
| **Region**         | `swedencentral` |
| **Environment**    | Production      |
| **Estimated Cost** | TBD             |
| **AVM Coverage**   | 100% (planned)  |

---

## ✅ Workflow Progress

```
[███████████░░░░░░░░░] 57% Complete
```

| Step | Phase          | Status | Artifact                                                                                                                                                                                                                           |
| :--: | -------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1   | Requirements   |   ✅   | [01-requirements.md](./01-requirements.md)                                                                                                                                                                                         |
|  2   | Architecture   |   ✅   | [02-architecture-assessment.md](./02-architecture-assessment.md)                                                                                                                                                                   |
|  3   | Design         |   ✅   | [03-des-diagram.py](./03-des-diagram.py), [03-des-cost-estimate.md](./03-des-cost-estimate.md)                                                                                                                                     |
|  4   | Planning       |   ✅   | [04-implementation-plan.md](./04-implementation-plan.md), [04-governance-constraints.md](./04-governance-constraints.md), [04-dependency-diagram.py](./04-dependency-diagram.py), [04-runtime-diagram.py](./04-runtime-diagram.py) |
|  5   | Implementation |   ⏳   | _Pending_                                                                                                                                                                                                                          |
|  6   | Deployment     |   ⏳   | _Pending_                                                                                                                                                                                                                          |
|  7   | Documentation  |   ⏳   | _Pending_                                                                                                                                                                                                                          |

> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ⏭️ Skipped

---

## 🏛️ Architecture

<div align="center">

![Architecture Diagram](./03-des-diagram.png)

_Generated with [azure-diagrams](../../.github/skills/azure-diagrams/SKILL.md) skill_

</div>

### Key Resources

| Resource                   | Type                                         | SKU             | Purpose                                        |
| -------------------------- | -------------------------------------------- | --------------- | ---------------------------------------------- |
| API Management             | `Microsoft.ApiManagement/service`            | Premium         | Secure API gateway and policy enforcement      |
| AKS                        | `Microsoft.ContainerService/managedClusters` | Standard        | Payment gateway compute platform               |
| Azure Front Door + WAF     | `Microsoft.Cdn/profiles`                     | Premium         | Edge ingress, global routing, WAF protection   |
| PostgreSQL Flexible Server | `Microsoft.DBforPostgreSQL/flexibleServers`  | E16s_v5 (HA)    | ACID transaction data store                    |
| Cosmos DB                  | `Microsoft.DocumentDB/databaseAccounts`      | NoSQL autoscale | Session state and low-latency distributed data |
| Key Vault (HSM)            | `Microsoft.KeyVault/vaults`                  | Premium         | Secrets and keys with HSM-backed protection    |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                             | Description                          | Status |
| ---------------------------------------------------------------- | ------------------------------------ | :----: |
| [01-requirements.md](./01-requirements.md)                       | Project requirements and NFR targets |   ✅   |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | Well-Architected assessment          |   ✅   |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Design-phase cost estimate           |   ✅   |
| [03-des-diagram.py](./03-des-diagram.py)                         | Architecture diagram source          |   ✅   |
| [03-des-diagram.png](./03-des-diagram.png)                       | Architecture diagram image           |   ✅   |

</details>

<details open>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                             | Status |
| ------------------------------------------------------------------ | --------------------------------------- | :----: |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Azure Policy and governance constraints |   ✅   |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance constraints |   ✅   |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Bicep implementation plan               |   ✅   |
| [04-dependency-diagram.py](./04-dependency-diagram.py)             | Step 4 dependency diagram source        |   ✅   |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Step 4 dependency diagram image         |   ✅   |
| [04-runtime-diagram.py](./04-runtime-diagram.py)                   | Step 4 runtime diagram source           |   ✅   |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Step 4 runtime diagram image            |   ✅   |
| [05-implementation-reference.md](./05-implementation-reference.md) | Link to deployed Bicep implementation   |   ⏳   |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Deployment results                      |   ⏳   |

</details>

<details open>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                     | Description                     | Status |
| -------------------------------------------------------- | ------------------------------- | :----: |
| [07-documentation-index.md](./07-documentation-index.md) | Documentation master index      |   ⏳   |
| [07-design-document.md](./07-design-document.md)         | Comprehensive design document   |   ⏳   |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 operational procedures    |   ⏳   |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Complete resource inventory     |   ⏳   |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup & disaster recovery plan |   ⏳   |
| [07-compliance-matrix.md](./07-compliance-matrix.md)     | Compliance controls mapping     |   ⏳   |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | As-built cost estimate          |   ⏳   |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/pci-dss-gw/`](../../infra/bicep/pci-dss-gw/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)               |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
