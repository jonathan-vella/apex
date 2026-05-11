<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-5%20of%207-blue?style=for-the-badge)
![Budget](https://img.shields.io/badge/Budget-~%E2%82%AC500%2Fmo%20MVP-purple?style=for-the-badge)

# 🏗️ Nordic Fresh Foods - FreshConnect MVP

**Cloud-native order, inventory, and delivery platform connecting Nordic farms with restaurants and consumers across Scandinavia.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                                              |
| ------------------ | -------------------------------------------------- |
| **Created**        | 2026-05-11                                         |
| **Last Updated**   | 2026-05-11                                         |
| **Region**         | swedencentral                                      |
| **Environment**    | Dev (sized to production-equivalent capacity)      |
| **Estimated Cost** | **$434.65/mo (≈ €403)** secure-plus — 81 % of €500 envelope |
| **AVM Coverage**   | AVM-first for supported core resources             |
| **IaC Tool**       | Bicep                                              |

---

## ✅ Workflow Progress

```text
[██████████████░░░░░░] 71% Complete
```

| Step | Phase          |                                        Status                                        | Artifact                                                              |
| :--: | -------------- | :----------------------------------------------------------------------------------: | --------------------------------------------------------------------- |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)                 | [01-requirements.md](./01-requirements.md)                            |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)                 | [02-architecture-assessment.md](./02-architecture-assessment.md)      |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)                 | [03-des-\*.md](.)                                                     |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)                 | [04-implementation-plan.md](./04-implementation-plan.md)              |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)                 | [05-implementation-reference.md](./05-implementation-reference.md)    |
|  6   | Deployment     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square)         | [06-deployment-summary.md](./06-deployment-summary.md)                |
|  7   | Documentation  | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square)         | [07-documentation-index.md](./07-documentation-index.md)              |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

> Architecture diagram will be added during Step 2 (Architecture Assessment) and Step 3 (Design).

### Key Resources (planned)

| Resource             | Type                  | SKU             | Purpose                                       |
| -------------------- | --------------------- | --------------- | --------------------------------------------- |
| FreshConnect Web/API | Azure App Service     | TBD by Step 2   | Web portal + REST API                         |
| FreshConnect DB      | Azure SQL Database    | TBD by Step 2   | Orders, customers, inventory, deliveries     |
| FreshConnect Storage | Storage Account       | TBD by Step 2   | Product images, invoices, delivery receipts  |
| FreshConnect Vault   | Key Vault             | Standard        | Secrets, keys, certificates                  |
| Monitoring           | App Insights + LA     | Pay-as-you-go   | Health, metrics, alerts                      |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                                               | Description                       |                                Status                                 | Created    |
| ---------------------------------------------------------------------------------- | --------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [00-handoff.md](./00-handoff.md)                                                   | Orchestrator handoff context      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [00-requirements-input-workshop-prep.md](./00-requirements-input-workshop-prep.md) | Customer-provided workshop input  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [01-requirements.md](./01-requirements.md)                                         | Project requirements with NFRs    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [02-architecture-assessment.md](./02-architecture-assessment.md)                   | WAF assessment with pillar scores | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) | 2026-05-11 |
| [02-waf-scores.png](./02-waf-scores.png)                                           | WAF pillar scores chart           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [02-cost-estimate.json](./02-cost-estimate.json)                                   | MCP cost estimate (machine)       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)                               | Azure pricing estimate            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [03-des-cost-distribution.png](./03-des-cost-distribution.png)                     | Cost distribution donut chart     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [03-des-cost-projection.png](./03-des-cost-projection.png)                         | 6-month cost projection chart     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [03-des-diagram.drawio](./03-des-diagram.drawio)                                   | Architecture diagram (Draw.io)    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                           | Description               |                                Status                                 | Created |
| -------------------------------------------------------------- | ------------------------- | :-------------------------------------------------------------------: | ------- |
| [04-governance-constraints.md](./04-governance-constraints.md) | Azure Policy constraints  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [04-implementation-plan.md](./04-implementation-plan.md)       | Bicep implementation plan | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [04-preflight-check.md](./04-preflight-check.md)               | Step 5 AVM preflight      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [05-implementation-reference.md](./05-implementation-reference.md) | Bicep implementation reference | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [04-dependency-diagram.png](./04-dependency-diagram.png)       | Step 4 dependency diagram | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)             | Step 4 runtime diagram    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-05-11 |
| [06-deployment-summary.md](./06-deployment-summary.md)         | Deployment results        | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                     | Description                     |                                Status                                 | Created |
| -------------------------------------------------------- | ------------------------------- | :-------------------------------------------------------------------: | ------- |
| [07-documentation-index.md](./07-documentation-index.md) | Documentation master index      | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |
| [07-design-document.md](./07-design-document.md)         | Comprehensive design document   | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 operational procedures    | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Complete resource inventory     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup & disaster recovery plan | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | As-built cost estimate          | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Bicep Templates** | [`infra/bicep/nordic-foods/`](../../infra/bicep/nordic-foods/) (created in Step 5)                                 |
| **Workflow Docs**   | [Published workflow guide](https://jonathan-vella.github.io/azure-agentic-infraops/concepts/workflow/)             |
| **Troubleshooting** | [Published troubleshooting guide](https://jonathan-vella.github.io/azure-agentic-infraops/guides/troubleshooting/) |

---

<div align="center">

**Generated by [APEX](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
