# Project README Template

> **Template for project-level README files in `agent-output/{project}/`**

---

## Template Instructions

When generating a project README, agents MUST:

1. Replace all `{{PLACEHOLDER}}` values with actual project data
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
![Step](https://img.shields.io/badge/Step-{{CURRENT_STEP}}%20of%207-blue?style=for-the-badge)

<!-- Cost Badge (if known) -->
![Cost](https://img.shields.io/badge/Est.%20Cost-${{MONTHLY_COST}}%2Fmo-purple?style=for-the-badge)

# 🏗️ {{PROJECT_NAME}}

**{{PROJECT_DESCRIPTION}}**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property | Value |
|----------|-------|
| **Created** | {{CREATED_DATE}} |
| **Last Updated** | {{UPDATED_DATE}} |
| **Region** | {{AZURE_REGION}} |
| **Environment** | {{ENVIRONMENT}} |
| **Estimated Cost** | {{MONTHLY_COST}}/month |
| **AVM Coverage** | {{AVM_PERCENTAGE}}% |

---

## ✅ Workflow Progress

<!-- Visual progress bar -->
```
[{{PROGRESS_BAR}}] {{COMPLETION_PERCENTAGE}}% Complete
```

| Step | Phase | Status | Artifact |
|:----:|-------|:------:|----------|
| 1 | Requirements | {{STEP1_STATUS}} | [01-requirements.md](./01-requirements.md) |
| 2 | Architecture | {{STEP2_STATUS}} | [02-architecture-assessment.md](./02-architecture-assessment.md) |
| 3 | Design | {{STEP3_STATUS}} | [03-des-*.md](.) |
| 4 | Planning | {{STEP4_STATUS}} | [04-implementation-plan.md](./04-implementation-plan.md) |
| 5 | Implementation | {{STEP5_STATUS}} | [05-implementation-reference.md](./05-implementation-reference.md) |
| 6 | Deployment | {{STEP6_STATUS}} | [06-deployment-summary.md](./06-deployment-summary.md) |
| 7 | Documentation | {{STEP7_STATUS}} | [07-documentation-index.md](./07-documentation-index.md) |

> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ⏭️ Skipped

---

## 🏛️ Architecture

<!-- Include diagram preview if available -->
{{#IF_DIAGRAM_EXISTS}}
<div align="center">

![Architecture Diagram](./{{DIAGRAM_FILENAME}})

*Generated with [azure-diagrams](../../.github/skills/azure-diagrams/SKILL.md) skill*

</div>
{{/IF_DIAGRAM_EXISTS}}

### Key Resources

| Resource | Type | SKU | Purpose |
|----------|------|-----|---------|
| {{RESOURCE_1_NAME}} | {{RESOURCE_1_TYPE}} | {{RESOURCE_1_SKU}} | {{RESOURCE_1_PURPOSE}} |
| {{RESOURCE_2_NAME}} | {{RESOURCE_2_TYPE}} | {{RESOURCE_2_SKU}} | {{RESOURCE_2_PURPOSE}} |
<!-- Add more resources as needed -->

---

## 📄 Generated Artifacts

<details>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File | Description | Created |
|------|-------------|---------|
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | {{CREATED_DATE}} |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with pillar scores | {{CREATED_DATE}} |
| [03-des-cost-estimate.md](./03-des-cost-estimate.md) | Azure pricing estimate | {{CREATED_DATE}} |
| [03-des-diagram.py](./03-des-diagram.py) | Architecture diagram source | {{CREATED_DATE}} |
| [03-des-diagram.png](./03-des-diagram.png) | Architecture diagram image | {{CREATED_DATE}} |

</details>

<details>
<summary><strong>📁 Step 4-6: Planning, Implementation & Deployment</strong></summary>

| File | Description | Created |
|------|-------------|---------|
| [04-governance-constraints.md](./04-governance-constraints.md) | Azure Policy constraints | {{CREATED_DATE}} |
| [04-implementation-plan.md](./04-implementation-plan.md) | Bicep implementation plan | {{CREATED_DATE}} |
| [05-implementation-reference.md](./05-implementation-reference.md) | Link to Bicep code | {{CREATED_DATE}} |
| [06-deployment-summary.md](./06-deployment-summary.md) | Deployment results | {{CREATED_DATE}} |

</details>

<details>
<summary><strong>📁 Step 7: As-Built Documentation</strong></summary>

| File | Description | Created |
|------|-------------|---------|
| [07-documentation-index.md](./07-documentation-index.md) | Documentation master index | {{CREATED_DATE}} |
| [07-design-document.md](./07-design-document.md) | Comprehensive design document | {{CREATED_DATE}} |
| [07-operations-runbook.md](./07-operations-runbook.md) | Day-2 operational procedures | {{CREATED_DATE}} |
| [07-resource-inventory.md](./07-resource-inventory.md) | Complete resource inventory | {{CREATED_DATE}} |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md) | Backup & disaster recovery plan | {{CREATED_DATE}} |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md) | As-built cost estimate | {{CREATED_DATE}} |

</details>

---

## 🔗 Related Resources

| Resource | Path |
|----------|------|
| **Bicep Templates** | [`infra/bicep/{{PROJECT_SLUG}}/`](../../infra/bicep/{{PROJECT_SLUG}}/) |
| **Workflow Docs** | [`docs/workflow.md`](../../docs/workflow.md) |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
