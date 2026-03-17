<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Step%207%20Complete-brightgreen?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)

![Cost](https://img.shields.io/badge/Est.%20Cost-€6.6K%2Fmo-purple?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital platform for bookings, payments, content, and customer engagement across a mixed-use real estate and lifestyle ecosystem in the EU**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                               |
| ------------------ | ----------------------------------- |
| **Created**        | 2026-03-16                          |
| **Last Updated**   | 2026-03-17                          |
| **Region**         | swedencentral                       |
| **Environment**    | Dev, Staging, Production            |
| **Estimated Cost** | ~€6,593/month (3 envs, validated)   |
| **IaC Tool**       | Bicep                               |
| **Complexity**     | Complex (15 services, 3 envs, GDPR) |

---

## ✅ Workflow Progress

```text
[██████████] Workflow Complete
```

| Step | Phase          |                                Status                                 | Artifact                                                           |
| :--: | -------------- | :-------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [03-des-cost-estimate.md](./03-des-cost-estimate.md)               |
| 3.5  | Governance     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-governance-constraints.md](./04-governance-constraints.md)     |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending

---

## 🏛️ Architecture

> Step 3 design artifacts now include the architecture diagram and ADRs for the container orchestration and cache-tier decisions.

### Key Resources (from RFQ Table 2)

| #   | Resource         | Azure Service                                 | Volumetrics                       |
| --- | ---------------- | --------------------------------------------- | --------------------------------- |
| 1   | WAF              | Azure Front Door WAF                          | 1.5M requests/mo                  |
| 2   | CDN              | Azure Front Door                              | 1.5M requests/mo                  |
| 3   | CIAM             | Microsoft Entra External ID                   | 15,000 MAU                        |
| 4   | API Gateway      | Azure API Management (Std v2)                 | 5M API requests/mo                |
| 5   | Container Engine | **AKS Standard** (chosen over Container Apps) | 8 vCPU nodes                      |
| 6   | Database         | PostgreSQL Flexible Server                    | GP, 256 GB                        |
| 7   | Object Storage   | Azure Blob Storage                            | 200 GB                            |
| 8   | File Storage     | Azure Files Premium                           | 256 GB SSD                        |
| 9   | Block Storage    | Azure Managed Disks                           | 256 GB SSD                        |
| 10  | In-memory Cache  | **Azure Managed Redis M200** (Memory Opt)     | 200 GB raw / 128 GB usable target |
| 11  | Key Management   | Azure Key Vault                               | 100K ops/mo                       |
| 12  | Virtual Machine  | Azure VM (D-series, 8 vCPU)                   | 1 instance                        |
| 13  | Network          | VNet + NSG + Private Endpoints + DNS          | As required                       |
| 14  | DevOps           | GitHub Actions / Azure DevOps                 | CI/CD pipelines                   |
| 15  | Observability    | Azure Monitor + Log Analytics + App Insights  | Managed PaaS                      |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

| File                                       | Description                    |                                Status                                 | Created    |
| ------------------------------------------ | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |

</details>

<details open>
<summary><strong>📁 Step 2: Architecture Assessment</strong></summary>

| File                                                             | Description                       |                                Status                                 | Created    |
| ---------------------------------------------------------------- | --------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with pillar scores | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [02-waf-scores.png](./02-waf-scores.png)                         | WAF pillar scores chart           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Detailed cost estimate            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-cost-distribution.png](./03-des-cost-distribution.png)   | Cost distribution donut chart     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-cost-projection.png](./03-des-cost-projection.png)       | 6-month cost projection chart     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 3: Design</strong></summary>

| File                                                                                     | Description                                |                                Status                                 | Created    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [03-des-diagram.py](./03-des-diagram.py)                                                 | Python source for the design architecture  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-diagram.png](./03-des-diagram.png)                                               | Proposed architecture diagram              | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-adr-001-container-orchestration.md](./03-des-adr-001-container-orchestration.md) | ADR for AKS over Container Apps            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [03-des-adr-002-redis-tier.md](./03-des-adr-002-redis-tier.md)                           | ADR for Azure Managed Redis tier selection | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 3.5: Governance</strong></summary>

| File                                                               | Description                              |                                Status                                 | Created    |
| ------------------------------------------------------------------ | ---------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Live Azure Policy governance constraints | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance constraints  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 4: Planning</strong></summary>

| File                                                     | Description                                |                                Status                                 | Created    |
| -------------------------------------------------------- | ------------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [04-implementation-plan.md](./04-implementation-plan.md) | Approved phased Bicep implementation plan  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [04-preflight-check.md](./04-preflight-check.md)         | AVM and schema preflight validation report | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 5: Implementation</strong></summary>

| File                                                               | Description                                   |                                Status                                 | Created    |
| ------------------------------------------------------------------ | --------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [05-implementation-reference.md](./05-implementation-reference.md) | Bicep implementation reference and validation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 6: Deployment</strong></summary>

| File                                                   | Description                                     |                                Status                                 | Created    |
| ------------------------------------------------------ | ----------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [06-deployment-summary.md](./06-deployment-summary.md) | Dry-run deployment validation and readiness log | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

<details open>
<summary><strong>📁 Step 7: Documentation</strong></summary>

| File                                                     | Description                                        |                                Status                                 | Created    |
| -------------------------------------------------------- | -------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [07-documentation-index.md](./07-documentation-index.md) | Master index for Step 7 documentation              | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-design-document.md](./07-design-document.md)         | Validated infrastructure design document           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 runbook for the validated target estate      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Resource inventory from approved Bicep definitions | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup and restore planning baseline               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)     | GDPR, governance, and security control matrix      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | Validated dry-run cost baseline                    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-17 |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **RFQ Source**      | [`docs/e2e-inputs/contoso-rfq.md`](../../docs/e2e-inputs/contoso-rfq.md)                 |
| **Bicep Templates** | [`infra/bicep/contoso-service-hub-run-2/`](../../infra/bicep/contoso-service-hub-run-2/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                                             |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                               |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)**

<a href="#readme-top">⬆️ Back to Top</a>

</div>
