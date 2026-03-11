<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-4%20of%207-blue?style=for-the-badge)

# 🏗️ nordic-fresh-foods

**Cloud-based farm-to-table ordering platform connecting organic farmers with restaurants and consumers across Scandinavia.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value            |
| ------------------ | ---------------- |
| **Created**        | 2026-03-11       |
| **Last Updated**   | 2026-03-11       |
| **Region**         | swedencentral    |
| **Environment**    | Dev + Production |
| **Estimated Cost** | ~$204/month      |
| **AVM Coverage**   | 18/19 (95%)      |

---

## ✅ Workflow Progress

```text
[████████░░░░░░░] 57% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | 03-des-\*.md                                                       |
|  4   | Planning       |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

> Architecture diagram will be generated in Step 3 (Design).

### Key Resources

| Resource             | Type                | SKU           | Purpose                       |
| -------------------- | ------------------- | ------------- | ----------------------------- |
| App Service          | Microsoft.Web/sites | S1 (×2 prod)  | Web portal + API backend      |
| Azure SQL Database   | Microsoft.Sql       | S0 (10 DTU)   | Orders, inventory, user data  |
| Key Vault            | Microsoft.KeyVault  | Standard      | Secrets and certificate mgmt  |
| Application Insights | Microsoft.Insights  | Pay-per-GB    | Monitoring and diagnostics    |
| Storage Account      | Microsoft.Storage   | Standard LRS  | Static assets, product images |
| Virtual Network      | Microsoft.Network   | 3 subnets     | Network isolation             |
| Private Endpoints    | Microsoft.Network   | SQL + Storage | GDPR/PCI compliance           |
| Entra External ID    | Microsoft.Entra     | Free tier     | Consumer identity             |

---

## 📄 Generated Artifacts

<details>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                             | Description                    |                                Status                                 | Created    |
| ---------------------------------------------------------------- | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                       | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-11 |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF architecture assessment    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-11 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Detailed cost estimate         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-11 |
| [03-des-adr-0001-cost-optimized-n-tier-azure-architecture.md](./03-des-adr-0001-cost-optimized-n-tier-azure-architecture.md) | ADR: cost-optimized n-tier architecture | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-11 |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

No artifacts generated yet.

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

No artifacts generated yet.

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/nordic-fresh-foods/`](../../infra/bicep/nordic-fresh-foods/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                               |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)                 |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
