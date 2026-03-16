<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Documentation%20Complete-green?style=for-the-badge)
![Step](https://img.shields.io/badge/Workflow-Dry--Run%20Validated-blue?style=for-the-badge)

# 🏗️ e2e-ralph-loop

**Nordic Fresh Foods Lite — simple Azure ordering platform for the E2E evaluation run.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) ·
[View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                                      |
| ------------------ | ------------------------------------------ |
| **Created**        | 2026-03-15                                 |
| **Last Updated**   | 2026-03-16                                 |
| **Region**         | swedencentral                              |
| **Environment**    | Production only                            |
| **Estimated Cost** | ~€15.68/month (validated dry-run baseline) |
| **Pattern**        | App Service + Azure SQL + Storage Account  |

---

## ✅ Workflow Progress

```text
[████████████████] Documentation complete, dry-run validated
```

| Step | Phase          |                                   Status                                   | Artifact                                                           |
| :--: | -------------- | :------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [03-des-adr-001-compute-tier.md](./03-des-adr-001-compute-tier.md) |
| 3.5  | Governance     |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [04-governance-constraints.md](./04-governance-constraints.md)     |
|  4   | Planning       |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Validated-success?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | [07-documentation-index.md](./07-documentation-index.md)           |

---

## 🏛️ Architecture

### Key Resources

| Resource             | Type                          | SKU              | Purpose                              |
| -------------------- | ----------------------------- | ---------------- | ------------------------------------ |
| App Service          | Microsoft.Web/sites           | B1 Linux         | Web frontend and application runtime |
| Azure SQL Database   | Microsoft.Sql                 | Basic (5 DTU)    | Orders, catalog, and customer data   |
| Storage Account      | Microsoft.Storage             | Standard LRS Hot | Product images and file storage      |
| Key Vault            | Microsoft.KeyVault            | Standard         | Secret storage and access control    |
| Application Insights | Microsoft.Insights            | Workspace-based  | Application telemetry                |
| Log Analytics        | Microsoft.OperationalInsights | Pay-as-you-go    | Central log retention and queries    |

---

## 📄 Generated Artifacts

| File                                                               | Description                                                                |                                   Status                                   | Created    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- | :------------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                         | Project requirements baseline                                              |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-15 |
| [02-architecture-assessment.md](./02-architecture-assessment.md)   | Architecture assessment and WAF trade-offs                                 |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-15 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)               | Design-phase cost estimate                                                 |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-15 |
| [03-des-diagram.py](./03-des-diagram.py)                           | Python source for the architecture diagram                                 |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [03-des-diagram.png](./03-des-diagram.png)                         | Rendered architecture diagram                                              |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [03-des-adr-001-compute-tier.md](./03-des-adr-001-compute-tier.md) | ADR for App Service B1 compute tier selection                              |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Governance constraints artifact for the project baseline                   |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance constraint baseline                            |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Bicep implementation planning artifact                                     |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-15 |
| [04-preflight-check.md](./04-preflight-check.md)                   | AVM and governance preflight validation for Bicep code generation          |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [05-implementation-reference.md](./05-implementation-reference.md) | Implementation summary and validation status for generated Bicep templates |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Dry-run deployment validation summary                                      | ![Done](https://img.shields.io/badge/-Validated-success?style=flat-square) | 2026-03-16 |
| [07-documentation-index.md](./07-documentation-index.md)           | Master index for the Step 7 documentation suite                            |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-design-document.md](./07-design-document.md)                   | Validated infrastructure design document                                   |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-operations-runbook.md](./07-operations-runbook.md)             | Day-2 operations and maintenance runbook                                   |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-resource-inventory.md](./07-resource-inventory.md)             | Validated target resource inventory                                        |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)                     | Backup and disaster recovery plan                                          |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)               | Compliance and security control mapping                                    |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)                 | Dry-run validated Step 7 cost baseline                                     |   ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)    | 2026-03-16 |

---

## 🔗 Related Resources

| Resource            | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/`](../../infra/bicep/)                       |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)               |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)**

<a href="#readme-top">⬆️ Back to Top</a>

</div>
