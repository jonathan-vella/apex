<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-2%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-~%2450%2Fmo-purple?style=for-the-badge)

# 🏗️ iis-hello-world

**Windows VM running IIS with Hello World page behind a public Azure Load Balancer**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value         |
| ------------------ | ------------- |
| **Created**        | 2026-03-06    |
| **Last Updated**   | 2026-03-06    |
| **Region**         | swedencentral |
| **Environment**    | dev           |
| **Estimated Cost** | ~$50/month    |
| **AVM Coverage**   | TBD           |

---

## ✅ Workflow Progress

```text
[███░░░░░░░░░░░] 29% Complete
```

| Step | Phase          |                                    Status                                     | Artifact                                                           |
| :--: | -------------- | :---------------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   |     ![Done](https://img.shields.io/badge/-Done-success?style=flat-square)     | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | —                                                                  |
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

| Resource                   | Type                    | SKU          | Purpose                   |
| -------------------------- | ----------------------- | ------------ | ------------------------- |
| rg-iis-hello-world-dev     | Resource Group          | N/A          | Resource container        |
| vnet-iis-hello-world-dev   | Virtual Network         | N/A          | Network isolation         |
| nsg-web-dev                | Network Security Group  | N/A          | HTTP allow, RDP restrict  |
| pip-lb-iis-hello-world-dev | Public IP Address       | Standard     | Load Balancer frontend    |
| lb-iis-hello-world-dev     | Load Balancer           | Standard     | HTTP traffic distribution |
| vm-iis-dev                 | Windows Virtual Machine | Standard_B2s | IIS web server            |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

| File                                       | Description                 |                                Status                                 | Created    |
| ------------------------------------------ | --------------------------- | :-------------------------------------------------------------------: | ---------- |
| [01-requirements.md](./01-requirements.md) | Project requirements & NFRs | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-06 |

</details>

<details open>
<summary><strong>📁 Step 2: Architecture</strong></summary>

| File                                                             | Description                   |                                Status                                 | Created    |
| ---------------------------------------------------------------- | ----------------------------- | :-------------------------------------------------------------------: | ---------- |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment & architecture | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-06 |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Detailed cost estimate        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | 2026-03-06 |

</details>

---

<div align="center">

🏠 [Back to Agent Output Index](../README.md)

</div>
