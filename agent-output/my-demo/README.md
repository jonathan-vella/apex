<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-4%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-~%249%2Fmo-purple?style=for-the-badge)

# 🏗️ my-demo

**A Star Wars themed demo web application showcasing Azure Static Web Apps and serverless patterns.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value      |
| ------------------ | ---------- |
| **Created**        | 2026-02-24 |
| **Last Updated**   | 2026-02-24 |
| **Region**         | westeurope |
| **Environment**    | Dev        |
| **Estimated Cost** | ~$9/month  |
| **AVM Coverage**   | 100% (3/3) |

---

## ✅ Workflow Progress

```text
[████████░░░░░░] 57% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [03-des-\*.md](.)                                                  |
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

<!-- Diagram will be generated in Step 3 -->

### Key Resources

| Resource      | Type           | SKU         | Purpose                                   |
| ------------- | -------------- | ----------- | ----------------------------------------- |
| stapp-my-demo | Static Web App | Standard    | Star Wars themed frontend hosting ($9/mo) |
| func-my-demo  | Functions App  | Consumption | Serverless API backend (optional, $0)     |
| appi-my-demo  | App Insights   | Free tier   | Application monitoring and telemetry ($0) |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                                                     | Description                                           |                                Status                                 | Created    |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                                               | Project requirements with NFRs                        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [02-architecture-assessment.md](./02-architecture-assessment.md)                         | WAF assessment (all 5 pillars)                        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)                                     | Detailed cost estimate (~$9/mo)                       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-diagram.py](./03-des-diagram.py)                                                 | Step 3 architecture diagram source                    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-diagram.png](./03-des-diagram.png)                                               | Step 3 architecture diagram image                     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-adr-0001-swa-standard-over-free.md](./03-des-adr-0001-swa-standard-over-free.md) | Architecture decision record (SWA Standard over Free) | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [02-waf-scores.png](./02-waf-scores.png)                                                 | WAF pillar scores chart                               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-cost-distribution.png](./03-des-cost-distribution.png)                           | Cost distribution donut chart                         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [03-des-cost-projection.png](./03-des-cost-projection.png)                               | 6-month cost projection chart                         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |

</details>

<details open>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                          |                                Status                                 | Created    |
| ------------------------------------------------------------------ | ------------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Bicep implementation plan (2 phases) | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Azure Policy governance constraints  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable policy data         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-dependency-diagram.py](./04-dependency-diagram.py)             | Module dependency diagram source     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Module dependency diagram image      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-runtime-diagram.py](./04-runtime-diagram.py)                   | Runtime flow diagram source          | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Runtime flow diagram image           | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |
| [challenge-findings.json](./challenge-findings.json)               | Challenger review findings (Step 4)  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-24 |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

_No artifacts generated yet._

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/my-demo/`](../../infra/bicep/my-demo/)       |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)               |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
