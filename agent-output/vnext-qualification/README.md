<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-3.5%20of%207-blue?style=for-the-badge)

# 🏗️ vnext-qualification

**Exact-head VS Code, GitHub approval, OIDC, Bicep, and Terraform release qualification.**

[View Architecture](#%EF%B8%8F-architecture) · [View Artifacts](#-generated-artifacts) ·
[View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property | Value |
| --- | --- |
| **Created** | 2026-07-15 |
| **Last Updated** | 2026-07-15 |
| **Region** | `swedencentral` |
| **Environment** | `vnext-qualification` sandbox |
| **Estimated Cost** | Ephemeral pay-as-you-go usage; final live cost not yet measured |
| **AVM Coverage** | 100% for planned Azure resources |

## ✅ Workflow Progress

```text
[████████░░░░░░░░░░░░] 43% Complete
```

| Step | Phase | Status | Artifact |
| :--: | --- | :---: | --- |
| 1 | Requirements | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Issue requirements [#543](https://github.com/jonathan-vella/apex/issues/543) |
| 2 | Architecture | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Approved local deployment plans |
| 3 | Design | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [ADR 0001](./03-des-adr-0001-use-split-encrypted-ci-transport.md) |
| 3.5 | Governance | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [Governance](./04-governance-constraints.md) |
| 4 | Planning | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) | Local Bicep and Terraform plans |
| 5 | Implementation | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) | Dual-track IaC in `infra/` |
| 6 | Deployment | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | No deployment performed |
| 7 | Documentation | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) | Final qualification dossier |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete |
> ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress |
> ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending

## 🏛️ Architecture

No diagram is generated yet. The current design isolates a control resource group, Bicep workload resource group, and
Terraform workload resource group. Azure Blob carries encrypted local-to-CI state, while immutable GitHub Actions
artifacts carry encrypted Terraform plans between CI jobs.

### Key Resources

| Resource | Type | SKU | Purpose |
| --- | --- | --- | --- |
| Qualification backend | Azure Storage | Standard LRS GPv2 | Terraform state and encrypted handoff envelopes |
| Bicep workload marker | Azure Storage | Standard LRS GPv2 | Deployment-stack lifecycle proof |
| Terraform workload marker | Azure Storage | Standard LRS GPv2 | Saved-plan lifecycle proof |
| Qualification logs | Log Analytics | PerGB2018 | Diagnostics and read-only evidence |
| Approval boundary | GitHub Environment | Required reviewer | Human approval and OIDC subject binding |

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Design and Governance</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| [03-des-adr-0001-use-split-encrypted-ci-transport.md](./03-des-adr-0001-use-split-encrypted-ci-transport.md) | Split encrypted transport decision | Accepted | 2026-07-15 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Live Azure Policy constraints | Complete | 2026-07-15 |
| [04-governance-constraints.md](./04-governance-constraints.md) | Human-readable governance and exception record | Complete | 2026-07-15 |
| [sku-manifest.json](./sku-manifest.json) | Canonical Standard LRS dual-track SKU decision | Locked | 2026-07-15 |
| [sku-manifest.md](./sku-manifest.md) | Deterministic human-readable SKU rendering | Locked | 2026-07-15 |

</details>

<details>
<summary><strong>📁 Implementation and Deployment</strong></summary>

| File | Description | Status | Created |
| --- | --- | :---: | --- |
| `infra/bicep/vnext-qualification/` | Subscription bootstrap and deployment-stack workload | In progress | 2026-07-15 |
| `infra/terraform/vnext-qualification/` | Secured backend client and exact-plan workload | In progress | 2026-07-15 |
| `06-deployment-summary.md` | Live deployment and cleanup record | Pending | Not created |

</details>

## 🔗 Related Resources

| Resource | Path |
| --- | --- |
| **Bicep Templates** | [`infra/bicep/vnext-qualification/`](../../infra/bicep/vnext-qualification/) |
| **Terraform Templates** | [`infra/terraform/vnext-qualification/`](../../infra/terraform/vnext-qualification/) |
| **Milestone D** | [Issue #543](https://github.com/jonathan-vella/apex/issues/543) |
| **Plan Transport** | [Issue #544](https://github.com/jonathan-vella/apex/issues/544) |

---

<div align="center">

**Generated by [APEX](../../README.md)** ·
[Report Issue](https://github.com/jonathan-vella/apex/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
