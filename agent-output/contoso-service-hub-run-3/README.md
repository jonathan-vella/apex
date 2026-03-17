<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Step%207%20Complete-brightgreen?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)

![Cost](https://img.shields.io/badge/Est.%20Cost-$9,280%2Fmo-purple?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital platform for bookings, payments, content, and customer engagement across Contoso's EU real estate and lifestyle ecosystem.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                    |
| ------------------ | ------------------------ |
| **Created**        | 2026-03-17               |
| **Last Updated**   | 2026-03-17               |
| **Region**         | swedencentral            |
| **Environment**    | Dev, Staging, Production |
| **Estimated Cost** | ~$9,280/month            |
| **AVM Coverage**   | 100% (16/16)             |

---

## ✅ Workflow Progress

```text
[██████████] 100% Complete
```

| Step | Phase          |                                Status                                 | Artifact                                                                                                         |
| :--: | -------------- | :-------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------- |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [01-requirements.md](./01-requirements.md)                                                                       |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)                                                 |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [03-des-diagram.png](./03-des-diagram.png)                                                                       |
| 3.5  | Governance     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-governance-constraints.md](./04-governance-constraints.md)                                                   |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)                                                         |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [../../infra/bicep/contoso-service-hub-run-3/main.bicep](../../infra/bicep/contoso-service-hub-run-3/main.bicep) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)                                                           |
|  7   | Documentation  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)                                                         |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

> Step 3 design artifacts now capture the full edge-to-data topology and the two key platform ADRs.

### Key Resources

| Resource                      | Type                    | SKU             | Purpose                               |
| ----------------------------- | ----------------------- | --------------- | ------------------------------------- |
| Azure Front Door + WAF        | CDN + WAF               | Premium         | Edge security, CDN, WAF               |
| Microsoft Entra External ID   | Identity                | Free tier       | Customer identity and CIAM            |
| Azure API Management          | API Gateway             | Standard        | Internal VNet API ingress             |
| Azure Kubernetes Service      | Container Orchestration | Standard        | Microservices hosting (3 x D8s_v5)    |
| Azure Database for PostgreSQL | Relational Database     | General Purpose | Primary datastore with private access |
| Azure Cache for Redis         | In-memory Cache         | Premium P4      | Session state and hot-path caching    |
| Azure Storage                 | Object and file storage | ZRS             | Content, shared files, and documents  |
| Azure Key Vault               | Secrets Management      | Standard        | Keys, secrets, certificates           |
| Azure Virtual Machines        | Compute                 | D-series        | Operations and batch workloads        |
| Azure Monitor stack           | Observability           | Pay-as-you-go   | Monitor, Log Analytics, App Insights  |
| Azure Log Analytics           | Log Aggregation         | Pay-as-you-go   | Centralized log management            |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

| File                                       | Description                    |                                Status                                 | Created    |
| ------------------------------------------ | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 2: Architecture Assessment</strong></summary>

| File                                                             | Description                            |                                Status                                 | Created    |
| ---------------------------------------------------------------- | -------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with platform decisions | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Bottom-up cost estimate and trade-offs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 3: Design</strong></summary>

| File                                                                           | Description                               |                                Status                                 | Created    |
| ------------------------------------------------------------------------------ | ----------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [03-des-diagram.py](./03-des-diagram.py)                                       | Python source for the design architecture | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-diagram.png](./03-des-diagram.png)                                     | Rendered topology diagram                 | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-adr-001-container-platform.md](./03-des-adr-001-container-platform.md) | ADR for AKS over Container Apps           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-adr-002-caching-tier.md](./03-des-adr-002-caching-tier.md)             | ADR for Redis Premium P4 tier selection   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 4: Planning</strong></summary>

| File                                                     | Description                                |                                Status                                 | Created    |
| -------------------------------------------------------- | ------------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [04-implementation-plan.md](./04-implementation-plan.md) | Phased AVM-first Bicep implementation plan | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [04-dependency-diagram.png](./04-dependency-diagram.png) | Deployment dependency diagram              | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)       | Runtime topology diagram                   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 5: Implementation</strong></summary>

| File                                                                                                                       | Description        |                                Status                                 | Created    |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------ | :-------------------------------------------------------------------: | ---------- |
| [../../infra/bicep/contoso-service-hub-run-3/main.bicep](../../infra/bicep/contoso-service-hub-run-3/main.bicep)           | Bicep orchestrator | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [../../infra/bicep/contoso-service-hub-run-3/main.bicepparam](../../infra/bicep/contoso-service-hub-run-3/main.bicepparam) | Parameter baseline | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 6: Deployment</strong></summary>

| File                                                   | Description                           |                                Status                                 | Created    |
| ------------------------------------------------------ | ------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [06-deployment-summary.md](./06-deployment-summary.md) | Dry-run deployment validation summary | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 7: Documentation</strong></summary>

| File                                                     | Description                  |                                Status                                 | Created    |
| -------------------------------------------------------- | ---------------------------- | :-------------------------------------------------------------------: | ---------- |
| [07-documentation-index.md](./07-documentation-index.md) | Documentation index          | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-design-document.md](./07-design-document.md)         | Technical design document    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 operations runbook     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Validated resource inventory | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup and DR plan           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)     | GDPR and control mapping     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | Finalized cost baseline      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 3.5: Governance</strong></summary>

| File                                                               | Description                                       |                                Status                                 | Created    |
| ------------------------------------------------------------------ | ------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Live policy discovery and plan adaptation summary | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance constraints           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/contoso-service-hub-run-3/`](../../infra/bicep/contoso-service-hub-run-3/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                                             |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                               |
| **RFP Source**      | [`docs/e2e-inputs/contoso-rfq.md`](../../docs/e2e-inputs/contoso-rfq.md)                 |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
