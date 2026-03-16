<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)

![Cost](https://img.shields.io/badge/Est.%20Cost-€8%2C547%2Fmo%20PAYG-purple?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital services platform for bookings, payments, content delivery, and customer engagement across Contoso's EU real estate and lifestyle ecosystem.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                    |
| ------------------ | ------------------------ |
| **Created**        | 2026-03-16               |
| **Last Updated**   | 2026-03-16               |
| **Region**         | swedencentral            |
| **Environment**    | Dev, Staging, Production |
| **Estimated Cost** | €8,547/month (PAYG)      |
| **AVM Coverage**   | 87.5% (14/16 resources)  |

---

## ✅ Workflow Progress

```text
[██████████] 100% Complete
```

| Step | Phase          |                                Status                                 | Artifact                                                                                                         |
| :--: | -------------- | :-------------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------- |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [01-requirements.md](./01-requirements.md)                                                                       |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)                                                 |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [03-des-adr-001-container-platform.md](./03-des-adr-001-container-platform.md)                                   |
| 3.5  | Governance     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-governance-constraints.md](./04-governance-constraints.md)                                                   |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)                                                         |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [../../infra/bicep/contoso-service-hub-run-1/main.bicep](../../infra/bicep/contoso-service-hub-run-1/main.bicep) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)                                                           |
|  7   | Documentation  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)                                                         |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

The Step 3 design artifacts now capture the hub-spoke topology, private endpoint data plane, and the major security boundaries for the target platform.

### Key Resources

| Resource                | Type                    | SKU                     | Purpose                             |
| ----------------------- | ----------------------- | ----------------------- | ----------------------------------- |
| Azure Front Door + WAF  | CDN / Edge Security     | Premium                 | WAF, CDN, DDoS for 1.5M req/mo      |
| Azure API Management    | API Gateway             | Premium v2              | Zone-redundant API ingress          |
| AKS (Standard tier)     | Container Orchestration | Standard + D8s v5 nodes | Backend services runtime            |
| Azure DB for PostgreSQL | Relational Database     | General Purpose, 256 GB | Transactional data store            |
| Azure Managed Redis     | In-Memory Cache         | M100 (128 GB)           | 128 GB cache layer                  |
| Entra External ID       | Customer Identity       | P1 free tier (15K MAU)  | 15,000 MAU CIAM                     |
| Azure Key Vault         | Secrets Management      | Standard                | 100K ops/month                      |
| Azure Blob Storage      | Object Storage          | Hot                     | 200 GB media/documents              |
| Azure Monitor           | Observability           | Standard                | Logging, metrics, alerting          |
| GitHub Enterprise       | DevOps / SDLC           | Enterprise              | CI/CD, repository, and release flow |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                                           | Description                                                                   |                                Status                                 | Created    |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                                     | Project requirements with NFRs                                                | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [02-architecture-assessment.md](./02-architecture-assessment.md)               | WAF assessment (5 pillars)                                                    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)                           | Detailed cost estimate                                                        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [03-des-diagram.py](./03-des-diagram.py)                                       | Python source for the design architecture diagram                             | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [03-des-diagram.png](./03-des-diagram.png)                                     | Rendered architecture diagram with hub-spoke topology and security boundaries | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [03-des-adr-001-container-platform.md](./03-des-adr-001-container-platform.md) | ADR for AKS selection over Azure Container Apps                               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [03-des-adr-002-caching-tier.md](./03-des-adr-002-caching-tier.md)             | ADR for Azure Managed Redis M100 cache-tier selection                         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |

</details>

<details open>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                                                          |                                Status                                 | Created    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Governance constraints discovered from live Azure Policy assignments | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance baseline for downstream planning         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Approved phased Bicep implementation plan                            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Dependency diagram for planned resources                             | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Runtime interaction diagram for the validated platform               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Dry-run deployment validation summary                                | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                     | Description                                                              |                                Status                                 | Created    |
| -------------------------------------------------------- | ------------------------------------------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [07-documentation-index.md](./07-documentation-index.md) | Master index for all Step 7 artifacts and prior workflow outputs         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-design-document.md](./07-design-document.md)         | Technical design reference for the validated target state                | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Operational procedures for deployment, monitoring, and incident response | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Environment-by-environment resource catalog                              | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup retention and disaster recovery procedures                        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)     | GDPR and governance control mapping                                      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | Validated Step 7 cost baseline and savings view                          | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-16 |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/contoso-service-hub-run-1/`](../../infra/bicep/contoso-service-hub-run-1/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                                             |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                               |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)**

<a href="#readme-top">⬆️ Back to Top</a>

</div>
