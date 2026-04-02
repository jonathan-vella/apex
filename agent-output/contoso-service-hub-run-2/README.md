<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-$8.7K--11.9K%2Fmo-purple?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital platform for bookings, payments, content, and customer engagement across Contoso's EU real estate and lifestyle ecosystem.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                         |
| ------------------ | ----------------------------- |
| **Created**        | 2026-04-02                    |
| **Last Updated**   | 2026-04-02 (Step 7)            |
| **Region**         | swedencentral                 |
| **Environment**    | Dev, Staging, Production      |
| **Estimated Cost** | ~$12,000–15,000/month         |
| **AVM Coverage**   | 16/17 (94%)                   |

---

## ✅ Workflow Progress

```text
[████████████████████] 100% Complete
```

| Step | Phase          |                                  Status                                  | Artifact                                                           |
| :--: | -------------- | :----------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [03-des-architecture-diagram.png](./03-des-architecture-diagram.png) |
| 3.5  | Governance     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [04-governance-constraints.md](./04-governance-constraints.md)     |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [infra/bicep/contoso-service-hub-run-2/](../../infra/bicep/contoso-service-hub-run-2/) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [07-documentation-index.md](./07-documentation-index.md)           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

<div align="center">

![Architecture Diagram](./03-des-architecture-diagram.png)

_Generated with the Python `diagrams` library for the Step 3 compliant baseline._

</div>

### Key Resources (Proposed)

| Resource               | Type                                 | SKU / Tier          | Purpose                           |
| ---------------------- | ------------------------------------ | ------------------- | --------------------------------- |
| Ingress                | Application Gateway WAF              | WAF v2 baseline     | EU-compliant edge security        |
| Container Platform     | AKS                                  | Standard            | Application compute               |
| PostgreSQL             | Azure Database for PostgreSQL Flex   | GP D4ds_v5, 256 GB  | Primary database                  |
| Redis Cache            | Azure Managed Redis                  | Enterprise E50      | 128 GB in-memory cache            |
| API Gateway            | Azure API Management                 | Standard v2         | API management, 5M req/month      |
| Identity               | Microsoft Entra External ID          | P1                  | CIAM for 15K MAU                  |
| Key Vault              | Azure Key Vault                      | Standard            | Secrets and certificate management|
| Monitoring             | Azure Monitor + App Insights         | Pay-as-you-go       | Observability                     |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

| File                                       | Description                    |                                Status                                 | Created    |
| ------------------------------------------ | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 2: Architecture</strong></summary>

| File                                                             | Description                    |                                Status                                 | Created    |
| ---------------------------------------------------------------- | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with pillar scores | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Azure cost estimate            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [02-waf-scores.png](./02-waf-scores.png)                         | WAF pillar scores chart        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-cost-distribution.png](./03-des-cost-distribution.png)   | Cost distribution donut chart  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-cost-projection.png](./03-des-cost-projection.png)       | 6-month cost projection        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 3: Design</strong></summary>

| File                                                                 | Description                                      |                                Status                                 | Created    |
| -------------------------------------------------------------------- | ------------------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [03-des-adr-001-container-platform.md](./03-des-adr-001-container-platform.md) | ADR for AKS versus Container Apps and App Service | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-adr-002-caching-tier.md](./03-des-adr-002-caching-tier.md)   | ADR for Redis Enterprise E50 selection           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-adr-003-eu-data-boundary.md](./03-des-adr-003-eu-data-boundary.md) | ADR for EU Data Boundary strategy                | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-architecture-diagram.py](./03-des-architecture-diagram.py)   | Python `diagrams` source for Step 3 architecture | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [03-des-architecture-diagram.png](./03-des-architecture-diagram.png) | Rendered Step 3 architecture diagram             | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 3.5: Governance</strong></summary>

| File                                                           | Description                                         |                                Status                                 | Created    |
| -------------------------------------------------------------- | --------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [04-governance-constraints.md](./04-governance-constraints.md) | Live Azure Policy discovery summary for sandbox subscription | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance constraints payload | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 4: Planning</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| [04-implementation-plan.md](./04-implementation-plan.md) | Implementation plan aligned to live governance and current AVM catalog | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-avm-matrix.json](./04-avm-matrix.json) | AVM module version matrix | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-dependency-diagram.py](./04-dependency-diagram.py) | Dependency diagram source | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-dependency-diagram.png](./04-dependency-diagram.png) | Dependency diagram | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-runtime-diagram.py](./04-runtime-diagram.py) | Runtime flow diagram source | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [04-runtime-diagram.png](./04-runtime-diagram.png) | Runtime flow diagram | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 5: Implementation</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| [main.bicep](../../infra/bicep/contoso-service-hub-run-2/main.bicep) | Orchestrator with phased deployment | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [main.bicepparam](../../infra/bicep/contoso-service-hub-run-2/main.bicepparam) | Dev environment parameters | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [modules/ (13 files)](../../infra/bicep/contoso-service-hub-run-2/modules/) | Bicep modules (AVM-first) | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 6: Deployment</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| [06-deployment-summary.md](./06-deployment-summary.md) | Deployment summary (dry-run) | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

<details open>
<summary><strong>📁 Step 7: Documentation</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| [07-documentation-index.md](./07-documentation-index.md) | Documentation master index | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-design-document.md](./07-design-document.md) | Technical design document | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-operations-runbook.md](./07-operations-runbook.md) | Day-2 operations runbook | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-resource-inventory.md](./07-resource-inventory.md) | Resource inventory | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md) | Backup and DR plan | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-compliance-matrix.md](./07-compliance-matrix.md) | GDPR + PCI-DSS compliance matrix | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md) | As-built cost estimate | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-04-02 |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **RFQ Source**       | [`tests/e2e-inputs/contoso-rfq.md`](../../tests/e2e-inputs/contoso-rfq.md)                        |
| **Bicep Templates** | [`infra/bicep/contoso-service-hub-run-2/`](../../infra/bicep/contoso-service-hub-run-2/)    |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                                                       |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                                         |

---

<div align="center">

**Generated by [Agentic PlatformOps](../../README.md)** · E2E Evaluation Run 2

<a href="#readme-top">⬆️ Back to Top</a>

</div>
