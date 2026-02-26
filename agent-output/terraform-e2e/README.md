<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-~%2425--60%2Fmo-purple?style=for-the-badge)

# 🏗️ terraform-e2e

**Small ecommerce storefront on Azure — Terraform IaC end-to-end**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value         |
| ------------------ | ------------- |
| **Created**        | 2026-02-26    |
| **Last Updated**   | 2026-02-26    |
| **Region**         | swedencentral |
| **Environment**    | dev           |
| **Estimated Cost** | ~$25–60/mo    |
| **AVM Coverage**   | 7/7 services  |
| **IaC Tool**       | Terraform     |

---

## ✅ Workflow Progress

```text
[██████████████] 100% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | 03-des-\*.md                                                       |
|  4   | Planning       |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | 07-\*.md                                                           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

> Architecture diagram will be generated in Step 2/3.

### Key Resources

| Resource                | Type                              | SKU        | Est. Cost | Purpose                  |
| ----------------------- | --------------------------------- | ---------- | --------- | ------------------------ |
| Static Web App          | Microsoft.Web/staticSites         | Free       | $0        | Frontend storefront      |
| App Service Plan        | Microsoft.Web/serverfarms         | B1 (Linux) | $13.14/mo | Backend REST API         |
| Azure SQL               | Microsoft.Sql/servers/databases   | Basic      | ~$5–15/mo | Product/order data store |
| Key Vault               | Microsoft.KeyVault/vaults         | Standard   | <$1/mo    | Secrets management       |
| Application Insights    | Microsoft.Insights/components     | Pay-as-go  | ~$5–30/mo | APM & telemetry          |
| Log Analytics Workspace | Microsoft.OperationalInsights     | Per-GB     | (bundled) | Log aggregation          |
| Entra External ID       | Microsoft.AzureActiveDirectory    | Free       | $0        | Customer authentication  |
| Storage Account         | Microsoft.Storage/storageAccounts | Standard   | ~$1–2/mo  | Terraform state backend  |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                                                                                           | Description                             |                                Status                                 | Created    |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                                                                                     | Project requirements with NFRs          | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [02-architecture-assessment.md](./02-architecture-assessment.md)                                                               | WAF assessment & architecture decisions | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)                                                                           | Detailed cost estimate                  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-diagram.py](./03-des-diagram.py)                                                                                       | Python architecture diagram source      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-diagram.png](./03-des-diagram.png)                                                                                     | Non-Mermaid architecture diagram        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-adr-0001-cost-optimized-n-tier-azure-architecture.md](./03-des-adr-0001-cost-optimized-n-tier-azure-architecture.md)   | ADR: cost-optimized n-tier decision     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-adr-0002-production-availability-zone-upgrade-path.md](./03-des-adr-0002-production-availability-zone-upgrade-path.md) | ADR: P1v4 AZ upgrade path               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [02-waf-scores.png](./02-waf-scores.png)                                                                                       | WAF pillar scores chart                 | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-cost-distribution.png](./03-des-cost-distribution.png)                                                                 | Cost distribution donut chart           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [03-des-cost-projection.png](./03-des-cost-projection.png)                                                                     | 6-month cost projection chart           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                         |                                Status                                 | Created    |
| ------------------------------------------------------------------ | ----------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Terraform implementation plan       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Azure Policy governance constraints | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable policy data        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-preflight-check.md](./04-preflight-check.md)                   | AVM-TF preflight validation         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2025-07-16 |
| [05-implementation-reference.md](./05-implementation-reference.md) | Terraform implementation reference  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2025-07-16 |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Deployment execution summary        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-dependency-diagram.py](./04-dependency-diagram.py)             | Module dependency diagram source    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Module dependency diagram           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-runtime-diagram.py](./04-runtime-diagram.py)                   | Runtime flow diagram source         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Runtime flow diagram                | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                   | Description                              |                                Status                                 | Created    |
| ------------------------------------------------------ | ---------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [07-documentation-index.md](./07-documentation-index.md) | Step 7 documentation package index     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-design-document.md](./07-design-document.md)       | As-built architecture design document    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-operations-runbook.md](./07-operations-runbook.md) | Day-2 operations runbook                 | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-resource-inventory.md](./07-resource-inventory.md) | Deployed resource inventory              | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)         | Backup and disaster recovery plan        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)   | Compliance controls and gap tracking     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)     | As-built cost estimate and variance view | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-26 |

</details>

---

## 🔗 Related Resources

| Resource                | Path                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| **Terraform Templates** | [`infra/terraform/terraform-e2e/`](../../infra/terraform/terraform-e2e/) |
| **Workflow Docs**       | [`docs/workflow.md`](../../docs/workflow.md)                             |
| **Troubleshooting**     | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)               |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
