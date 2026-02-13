<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)
![SLA](https://img.shields.io/badge/SLA-99.9%25-green?style=for-the-badge)

# 🌐 static-webapp

**Azure Static Web App with full 7-step workflow validation and MCP pricing integration**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property         | Value        |
| ---------------- | ------------ |
| **Created**      | 2024-12-17   |
| **Last Updated** | 2024-12-17   |
| **Region**       | `westeurope` |
| **Environment**  | Production   |
| **SLA Target**   | 99.9%        |

---

## ✅ Workflow Progress

```
[████████████████████] 100% Complete
```

| Step | Phase          | Status | Artifact                                                                                                                                                           |
| :--: | -------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1   | Requirements   |   ✅   | [01-requirements.md](./01-requirements.md)                                                                                                                         |
|  2   | Architecture   |   ✅   | [02-architecture-assessment.md](./02-architecture-assessment.md)                                                                                                   |
|  3   | Design         |   ✅   | [03-des-diagram.py](./03-des-diagram.py), [03-des-cost-estimate.md](./03-des-cost-estimate.md)                                                                     |
|  4   | Planning       |   ✅   | [04-implementation-plan.md](./04-implementation-plan.md), [04-dependency-diagram.py](./04-dependency-diagram.py), [04-runtime-diagram.py](./04-runtime-diagram.py) |
|  5   | Implementation |   ✅   | [05-implementation-reference.md](./05-implementation-reference.md)                                                                                                 |
|  6   | Deployment     |   ✅   | [06-deployment-summary.md](./06-deployment-summary.md)                                                                                                             |
|  7   | Documentation  |   ✅   | [07-documentation-index.md](./07-documentation-index.md)                                                                                                           |

> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ⏭️ Skipped

---

## 🏛️ Architecture

<div align="center">

![Architecture Diagram](./03-des-diagram.png)

_Generated with [azure-diagrams](../../.github/skills/azure-diagrams/SKILL.md) skill_

</div>

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                             | Description                     | Created    |
| ---------------------------------------------------------------- | ------------------------------- | ---------- |
| [01-requirements.md](./01-requirements.md)                       | Project requirements with NFRs  | 2024-12-17 |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with MCP pricing | 2024-12-17 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Detailed cost breakdown         | 2024-12-17 |
| [03-des-diagram.py](./03-des-diagram.py)                         | Design phase diagram source     | 2024-12-17 |
| [03-des-diagram.png](./03-des-diagram.png)                       | Design phase diagram image      | 2024-12-17 |

</details>

<details open>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                      | Created    |
| ------------------------------------------------------------------ | -------------------------------- | ---------- |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Azure Policy constraints         | 2024-12-17 |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Bicep implementation plan        | 2024-12-17 |
| [04-dependency-diagram.py](./04-dependency-diagram.py)             | Step 4 dependency diagram source | 2026-02-13 |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Step 4 dependency diagram image  | 2026-02-13 |
| [04-runtime-diagram.py](./04-runtime-diagram.py)                   | Step 4 runtime diagram source    | 2026-02-13 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Step 4 runtime diagram image     | 2026-02-13 |
| [05-implementation-reference.md](./05-implementation-reference.md) | Link to Bicep code               | 2024-12-17 |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Deployment results (simulated)   | 2024-12-17 |

</details>

<details open>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                     | Description                   | Created    |
| -------------------------------------------------------- | ----------------------------- | ---------- |
| [07-ab-diagram.py](./07-ab-diagram.py)                   | As-built diagram source       | 2024-12-17 |
| [07-ab-diagram.png](./07-ab-diagram.png)                 | As-built diagram image        | 2024-12-17 |
| [07-documentation-index.md](./07-documentation-index.md) | Workload documentation hub    | 2024-12-17 |
| [07-design-document.md](./07-design-document.md)         | Comprehensive design document | 2024-12-17 |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 operational procedures  | 2024-12-17 |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Complete resource inventory   | 2024-12-17 |
| [07-compliance-matrix.md](./07-compliance-matrix.md)     | Security controls mapping     | 2024-12-17 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup & disaster recovery    | 2024-12-17 |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                             |
| ------------------- | ---------------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/static-webapp/`](../../infra/bicep/static-webapp/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                     |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)       |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
