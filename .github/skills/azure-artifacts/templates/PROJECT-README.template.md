# Project README Template

> **Template for project-level README files in `agent-output/{project}/`**

---

## Template Instructions

When generating a project README, agents MUST:

1. Replace all `{placeholder}` values with actual project data
2. Include ALL H2 sections in exact order
3. Update workflow progress checkboxes based on existing artifacts
4. Populate artifact table from actual files in the folder
5. Calculate completion percentage accurately
6. Include architecture preview if diagram exists

---

## Required Structure

<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

<!-- Status Badge - Choose one based on completion -->
<!-- In Progress: -->

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow?style=for-the-badge)

<!-- OR Complete: -->

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)

<!-- Step Badge -->

![Step](https://img.shields.io/badge/Step-{current-step}%20of%207-blue?style=for-the-badge)

<!-- Cost Badge (if known) -->

![Cost](https://img.shields.io/badge/Est.%20Cost-${monthly-cost}%2Fmo-purple?style=for-the-badge)

# 🏗️ {project-name}

**{project-description}**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                |
| ------------------ | -------------------- |
| **Created**        | {created-date}       |
| **Last Updated**   | {updated-date}       |
| **Region**         | {azure-region}       |
| **Environment**    | {environment}        |
| **Estimated Cost** | {monthly-cost}/month |
| **AVM Coverage**   | {avm-percentage}%    |

---

## ✅ Workflow Progress

<!-- Visual progress bar -->

```
[{progress-bar}] {completion-percentage}% Complete
```

| Step | Phase          |                                Status                                 | Artifact                                                           |
| :--: | -------------- | :-------------------------------------------------------------------: | ------------------------------------------------------------------ |
|  1   | Requirements   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [01-requirements.md](./01-requirements.md)                         |
|  2   | Architecture   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [02-architecture-assessment.md](./02-architecture-assessment.md)   |
|  3   | Design         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [03-des-\*.md](.)                                                  |
|  4   | Planning       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [04-implementation-plan.md](./04-implementation-plan.md)           |
|  5   | Implementation | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [05-implementation-reference.md](./05-implementation-reference.md) |
|  6   | Deployment     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [06-deployment-summary.md](./06-deployment-summary.md)             |
|  7   | Documentation  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | [07-documentation-index.md](./07-documentation-index.md)           |

> **Legend**:
> ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) Complete
> | ![WIP](https://img.shields.io/badge/-WIP-yellow?style=flat-square) In Progress
> | ![Pending](https://img.shields.io/badge/-Pending-lightgrey?style=flat-square) Pending
> | ![Skip](https://img.shields.io/badge/-Skipped-blue?style=flat-square) Skipped

---

## 🏛️ Architecture

<!-- Include diagram preview if available -->
<!-- If diagram exists, include the following block -->
<div align="center">

![Architecture Diagram](./{diagram-filename})

_Generated with [azure-diagrams](../../.github/skills/azure-diagrams/SKILL.md) skill_

</div>
<!-- End diagram block -->

### Key Resources

| Resource          | Type              | SKU              | Purpose              |
| ----------------- | ----------------- | ---------------- | -------------------- |
| {resource-1-name} | {resource-1-type} | {resource-1-sku} | {resource-1-purpose} |
| {resource-2-name} | {resource-2-type} | {resource-2-sku} | {resource-2-purpose} |

<!-- Add more resources as needed -->

---

## 📄 Generated Artifacts

<details>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File                                                             | Description                       |                                Status                                 | Created        |
| ---------------------------------------------------------------- | --------------------------------- | :-------------------------------------------------------------------: | -------------- |
| [01-requirements.md](./01-requirements.md)                       | Project requirements with NFRs    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with pillar scores | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md)             | Azure pricing estimate            | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [03-des-diagram.py](./03-des-diagram.py)                         | Architecture diagram source       | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [03-des-diagram.png](./03-des-diagram.png)                       | Architecture diagram image        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File                                                               | Description                      |                                Status                                 | Created        |
| ------------------------------------------------------------------ | -------------------------------- | :-------------------------------------------------------------------: | -------------- |
| [04-governance-constraints.md](./04-governance-constraints.md)     | Azure Policy constraints         | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [04-implementation-plan.md](./04-implementation-plan.md)           | Bicep implementation plan        | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [04-dependency-diagram.py](./04-dependency-diagram.py)             | Step 4 dependency diagram source | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [04-dependency-diagram.png](./04-dependency-diagram.png)           | Step 4 dependency diagram image  | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [04-runtime-diagram.py](./04-runtime-diagram.py)                   | Step 4 runtime diagram source    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [04-runtime-diagram.png](./04-runtime-diagram.png)                 | Step 4 runtime diagram image     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [05-implementation-reference.md](./05-implementation-reference.md) | Link to Bicep code               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [06-deployment-summary.md](./06-deployment-summary.md)             | Deployment results               | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File                                                     | Description                     |                                Status                                 | Created        |
| -------------------------------------------------------- | ------------------------------- | :-------------------------------------------------------------------: | -------------- |
| [07-documentation-index.md](./07-documentation-index.md) | Documentation master index      | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [07-design-document.md](./07-design-document.md)         | Comprehensive design document   | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [07-operations-runbook.md](./07-operations-runbook.md)   | Day-2 operational procedures    | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [07-resource-inventory.md](./07-resource-inventory.md)   | Complete resource inventory     | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md)           | Backup & disaster recovery plan | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md)       | As-built cost estimate          | ![Done](https://img.shields.io/badge/-Done-success?style=flat-square) | {created-date} |

</details>

---

## 🔗 Related Resources

| Resource            | Path                                                               |
| ------------------- | ------------------------------------------------------------------ |
| **Bicep Templates** | [`infra/bicep/{project-slug}/`](../../infra/bicep/{project-slug}/) |
| **Workflow Docs**   | [`docs/workflow.md`](../../docs/workflow.md)                       |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md)         |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
