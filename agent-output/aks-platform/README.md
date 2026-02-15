<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-1%20of%207-blue?style=for-the-badge)

# 🏗️ aks-platform

**Enterprise AKS platform with Application Gateway (AGIC/WAF), Azure SQL Database, and NAT Gateway for deterministic outbound traffic.**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value               |
| ------------------ | ------------------- |
| **Created**        | 2026-02-15          |
| **Last Updated**   | 2026-02-15          |
| **Region**         | swedencentral       |
| **Environment**    | Dev + Production    |
| **Estimated Cost** | ~$3,000-5,000/month |
| **AVM Coverage**   | TBD%                |

---

## ✅ Workflow Progress

<!-- Visual progress bar -->

```
[██░░░░░░░░░░░░] 14% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [03-des-\*.md](.)                                                  |
|  4   | Planning       | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)           |
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

### Key Resources

| Resource                  | Type                     | SKU                        | Purpose                            |
| ------------------------- | ------------------------ | -------------------------- | ---------------------------------- |
| aks-aksplatform-{env}     | Azure Kubernetes Service | Standard tier              | Container orchestration platform   |
| agw-aksplatform-{env}     | Application Gateway      | WAF_v2                     | Ingress controller with WAF        |
| sql-aksplatform-{env}     | Azure SQL Server         | General Purpose (4 vCores) | Relational database backend        |
| natgw-aksplatform-{env}   | NAT Gateway              | Standard                   | Deterministic outbound IPs         |
| acr-aksplatform-{env}     | Azure Container Registry | Premium                    | Private container image registry   |
| kv-aksplat-{env}-{suffix} | Azure Key Vault          | Standard                   | Secrets and certificate management |
| log-aksplatform-{env}     | Log Analytics Workspace  | Per-GB                     | Centralized logging and monitoring |
| vnet-aksplatform-{env}    | Virtual Network          | —                          | Network isolation (10.0.0.0/16)    |

---

## 📄 Generated Artifacts

<details>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                       | Description                    |                                Status                                 | Created    |
| ------------------------------------------ | ------------------------------ | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-02-15 |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File | Description |                                    Status                                     | Created |
| ---- | ----------- | :---------------------------------------------------------------------------: | ------- |
| —    | Pending     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File | Description |                                    Status                                     | Created |
| ---- | ----------- | :---------------------------------------------------------------------------: | ------- |
| —    | Pending     | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —       |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                           |
| ------------------- | -------------------------------------------------------------- |
| **Bicep Templates** | [`infra/bicep/aks-platform/`](../../infra/bicep/aks-platform/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                   |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)     |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
