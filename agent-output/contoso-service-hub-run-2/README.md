<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-1%20of%207-blue?style=for-the-badge)

![Cost](https://img.shields.io/badge/Est.%20Cost-€8K--12K%2Fmo-purple?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital platform for bookings, payments, content, and customer engagement across a mixed-use real estate and lifestyle ecosystem in the EU**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| **Created**        | 2026-03-16                          |
| **Last Updated**   | 2026-03-16                          |
| **Region**         | swedencentral                       |
| **Environment**    | Dev, Staging, Production            |
| **Estimated Cost** | €8,000–12,000/month                 |
| **IaC Tool**       | Bicep                               |
| **Complexity**     | Complex (15 services, 3 envs, GDPR) |

---

## ✅ Workflow Progress

```text
[█░░░░░░░░░] 14% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [03-des-\*.md](.)                                                  |
| 3.5  | Governance     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [04-governance-constraints.md](./04-governance-constraints.md)     |
|  4   | Planning       | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending

---

## 🏛️ Architecture

> Architecture diagram will be generated in Step 3 (Design).

### Key Resources (from RFQ Table 2)

| #   | Resource         | Azure Service                                | Volumetrics        |
| --- | ---------------- | -------------------------------------------- | ------------------ |
| 1   | WAF              | Azure Front Door WAF                         | 1.5M requests/mo   |
| 2   | CDN              | Azure Front Door                             | 1.5M requests/mo   |
| 3   | CIAM             | Microsoft Entra External ID                  | 15,000 MAU         |
| 4   | API Gateway      | Azure API Management (Std v2)                | 5M API requests/mo |
| 5   | Container Engine | AKS or Container Apps (TBD)                  | 8 vCPU nodes       |
| 6   | Database         | PostgreSQL Flexible Server                   | GP, 256 GB         |
| 7   | Object Storage   | Azure Blob Storage                           | 200 GB             |
| 8   | File Storage     | Azure Files Premium                          | 256 GB SSD         |
| 9   | Block Storage    | Azure Managed Disks                          | 256 GB SSD         |
| 10  | In-memory Cache  | Azure Cache for Redis (TBD tier)             | 128 GB             |
| 11  | Key Management   | Azure Key Vault                              | 100K ops/mo        |
| 12  | Virtual Machine  | Azure VM (D-series, 8 vCPU)                  | 1 instance         |
| 13  | Network          | VNet + NSG + Private Endpoints + DNS         | As required        |
| 14  | DevOps           | GitHub Actions / Azure DevOps                | CI/CD pipelines    |
| 15  | Observability    | Azure Monitor + Log Analytics + App Insights | Managed PaaS       |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

| File                                       | Description                    |                                Status                                 | Created    |
| ------------------------------------------ | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |

</details>

<details>
<summary><strong>📁 Steps 2-7: Pending</strong></summary>

Artifacts for steps 2-7 will be generated as the workflow progresses.

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                         |
| ------------------- | ---------------------------------------------------------------------------- |
| **RFQ Source**      | [`tmp/00-rfp.md`](../../tmp/00-rfp.md)                                       |
| **Bicep Templates** | [`infra/bicep/contoso-service-hub/`](../../infra/bicep/contoso-service-hub/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                                 |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                   |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)**

<a href="#readme-top">⬆️ Back to Top</a>

</div>
