<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-3%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-$20K--22K%2Fmo-purple?style=for-the-badge)

# 🏗️ infonova-fabric-bid

**AWS-to-Microsoft Fabric analytics migration for a UAE telecom platform.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                                    |
| ------------------ | ---------------------------------------- |
| **Created**        | 2026-03-24                               |
| **Last Updated**   | 2026-03-27                               |
| **Region**         | `uaenorth`                               |
| **Environment**    | Production design baseline               |
| **Estimated Cost** | $20K-$22K/month                          |
| **AVM Coverage**   | Planned in Terraform implementation step |

---

## ✅ Workflow Progress

```text
[###----] 35% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                         |
| :--: | -------------- | :---------------------------------------------------------------------------: | ---------------------------------------------------------------- |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                       |
|  2   | Architecture   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [02-architecture-assessment.md](./02-architecture-assessment.md) |
|  3   | Design         |      ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square)       | [03-des-diagram.drawio](./03-des-diagram.drawio)                 |
|  4   | Planning       | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Pending                                                          |
|  5   | Implementation | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Pending                                                          |
|  6   | Deployment     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Pending                                                          |
|  7   | Documentation  | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Pending                                                          |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete |
> ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress |
> ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending

---

## 🏛️ Architecture

The editable architecture diagram is available in [03-des-diagram.drawio](./03-des-diagram.drawio).

### Key Resources

| Resource                   | Type               | SKU          | Purpose                                                    |
| -------------------------- | ------------------ | ------------ | ---------------------------------------------------------- |
| Microsoft Fabric           | Analytics platform | F64          | Lakehouse, pipelines, real-time intelligence, and Power BI |
| Azure Kubernetes Service   | Compute            | Standard     | Hosts Infonova applications and Kong ingress               |
| PostgreSQL Flexible Server | Database           | GP D4s_v3 HA | Transactional system of record                             |
| Event Hubs                 | Streaming          | Premium      | IoT telemetry ingestion and capture                        |
| Azure Storage              | Storage            | ZRS Hot      | SFTP exchange and Event Hubs capture archive               |
| Azure AI Search            | Search             | Standard S1  | Semantic discovery layer                                   |

---

## 📄 Generated Artifacts

<details>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                             | Description                            |                                Status                                 | Created    |
| ---------------------------------------------------------------- | -------------------------------------- | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md)                       | Project requirements with NFRs         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-24 |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment and target architecture | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-24 |
| [03-des-diagram.drawio](./03-des-diagram.drawio)                 | Draw.io design architecture diagram    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-27 |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File    | Description                                                                            |                                    Status                                     | Created |
| ------- | -------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------: | ------- |
| Pending | Governance discovery, Terraform plan, implementation reference, and deployment summary | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File    | Description                                                      |                                    Status                                     | Created |
| ------- | ---------------------------------------------------------------- | :---------------------------------------------------------------------------: | ------- |
| Pending | As-built diagram, documentation index, runbook, and DR artifacts | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

---

## 🔗 Related Resources

| Resource                | Path                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| **Terraform Templates** | [`../../infra/terraform/test01/`](../../infra/terraform/test01/) |
| **Workflow Docs**       | [`../../docs/workflow.md`](../../docs/workflow.md)               |
| **Troubleshooting**     | [`../../docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)**

<a href="#readme-top">Back to Top</a>

</div>
