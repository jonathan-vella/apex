<!-- markdownlint-disable MD033 MD041 -->
<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)
![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)
![Cost](https://img.shields.io/badge/Est.%20Cost-$0.10%2Fmo-purple?style=for-the-badge)

# 🧪 e2e-conductor-test

**E2E validation of the 7-step orchestration workflow with Azure Static Web App + CDN**

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property | Value |
|----------|-------|
| **Created** | 2026-02-05 |
| **Last Updated** | 2026-02-06 |
| **Region** | `westeurope` |
| **Environment** | Development |
| **Estimated Cost** | ~$0.10/month |
| **AVM Coverage** | 100% (3/3 modules deployed) |
| **Purpose** | Validate Conductor workflow E2E |
| **Status** | ✅ Complete |

---

## ✅ Workflow Progress

```
[████████████████████] 100% Complete
```

| Step | Phase | Status | Artifact |
|:----:|-------|:------:|----------|
| 1 | Requirements | ✅ | [01-requirements.md](./01-requirements.md) |
| 2 | Architecture | ✅ | [02-architecture-assessment.md](./02-architecture-assessment.md) |
| 3 | Design | ✅ | [03-des-diagram.py](./03-des-diagram.py), [03-des-adr-0001-static-webapp-with-cdn.md](./03-des-adr-0001-static-webapp-with-cdn.md) |
| 4 | Planning | ✅ | [04-implementation-plan.md](./04-implementation-plan.md), [04-governance-constraints.md](./04-governance-constraints.md), [04-preflight-check.md](./04-preflight-check.md) |
| 5 | Implementation | ✅ | [05-implementation-reference.md](./05-implementation-reference.md) |
| 6 | Deployment | ✅ | [06-deployment-summary.md](./06-deployment-summary.md) |
| 7 | Documentation | ✅ | [07-documentation-index.md](./07-documentation-index.md), [07-resource-inventory.md](./07-resource-inventory.md), +5 more |

> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ⏭️ Skipped

---

## 🏛️ Architecture

<div align="center">

![Architecture Diagram](./03-des-diagram.png)

*Generated with [azure-diagrams](../../.github/skills/azure-diagrams/SKILL.md) skill*

</div>

### Key Resources

| Resource | Type | SKU | Purpose |
|----------|------|-----|---------|
| Static Web App | `Microsoft.Web/staticSites` | Free | Host static content |
| CDN Profile | `Microsoft.Cdn/profiles` | Standard_Microsoft | Global content delivery |
| Log Analytics | `Microsoft.OperationalInsights/workspaces` | Free tier | Centralized logging |
| Action Group | `Microsoft.Insights/actionGroups` | N/A | Alert notifications |
| Metric Alert | `Microsoft.Insights/metricAlerts` | N/A | CDN health monitoring |
| Resource Group | `Microsoft.Resources/resourceGroups` | N/A | Deployment scope |

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1-3: Requirements, Architecture & Design</strong></summary>

| File | Description | Created |
|------|-------------|---------|
| [01-requirements.md](./01-requirements.md) | Project requirements with NFRs | 2026-02-05 |
| [02-architecture-assessment.md](./02-architecture-assessment.md) | WAF assessment with pillar scores | 2026-02-05 |
| [03-des-diagram.py](./03-des-diagram.py) | Architecture diagram source | 2026-02-05 |
| [03-des-diagram.png](./03-des-diagram.png) | Architecture diagram image | 2026-02-05 |
| [03-des-adr-0001-static-webapp-caching.md](./03-des-adr-0001-static-webapp-caching.md) | ADR: Caching strategy decision | 2026-02-05 |

</details>

<details open>
<summary><strong>📁 Step 4: Planning & Governance</strong></summary>

| File | Description | Created |
|------|-------------|---------|
| [04-governance-constraints.md](./04-governance-constraints.md) | Azure Policy constraints (127 policies analyzed) | 2026-02-05 |
| [04-governance-constraints.json](./04-governance-constraints.json) | Machine-readable governance data | 2026-02-05 |
| [04-implementation-plan.md](./04-implementation-plan.md) | Bicep implementation plan (6 resources, 100% AVM) | 2026-02-05 |

</details>

<details open>
<summary><strong>📁 Step 5: Implementation</strong></summary>

| File | Description | Created |
|------|-------------|---------||
| [05-implementation-reference.md](./05-implementation-reference.md) | Bicep code reference and validation | 2026-02-05 |

</details>

<details open>
<summary><strong>📁 Step 6: Deployment</strong></summary>

| File | Description | Created |
|------|-------------|---------||
| [06-deployment-summary.md](./06-deployment-summary.md) | Deployment results (4 resources) | 2026-01-27 |

</details>

<details open>
<summary><strong>📁 Step 7: Workload Documentation</strong></summary>

| File | Description | Created |
|------|-------------|---------||
| [07-documentation-index.md](./07-documentation-index.md) | Master documentation hub | 2026-02-06 |
| [07-resource-inventory.md](./07-resource-inventory.md) | Complete resource listing | 2026-02-06 |
| [07-design-document.md](./07-design-document.md) | Technical design document | 2026-02-06 |
| [07-operations-runbook.md](./07-operations-runbook.md) | Day-2 operational procedures | 2026-02-06 |
| [07-backup-dr-plan.md](./07-backup-dr-plan.md) | Backup & DR plan | 2026-02-06 |
| [07-ab-cost-estimate.md](./07-ab-cost-estimate.md) | As-built cost estimate | 2026-02-06 |
| [07-compliance-matrix.md](./07-compliance-matrix.md) | Security compliance mapping | 2026-02-06 |

</details>

---

## 💰 Cost Summary

| Resource | Monthly Cost | Notes |
|----------|-------------|-------|
| Static Web App | $0.00 | Free tier |
| CDN | $0.00 | Disabled (deprecated SKU) |
| Log Analytics | $0.00 | Free tier (10 GB/month) |
| Monitoring | $0.10 | Alert rules |
| **Total** | **~$0.10** | 99% under $20 budget |

---

## 🔗 Related Resources

| Resource | Path |
|----------|------|
| **Bicep Templates** | [`infra/bicep/e2e-conductor-test/`](../../infra/bicep/e2e-conductor-test/) |
| **Workflow Docs** | [`docs/workflow.md`](../../docs/workflow.md) |
| **Troubleshooting** | [`docs/troubleshooting.md`](../../docs/troubleshooting.md) |

---

## 🚀 Deployment Summary

**Status**: ✅ Complete
**Date**: 2025-01-27
**Resources Deployed**: 4
**Region**: westeurope
**Cost**: ~$0.10/month

### Deployed Resources

- Static Web App: `swa-e2e-conductor-test-dev`
- Log Analytics: `log-e2e-conductor-test-dev`
- Action Group: `ag-e2e-conductor-test-dev`
- Resource Group: `rg-e2e-conductor-test-dev-weu`

### Documentation Package

**Generated**: 2026-02-06
**Total Files**: 13 artifacts (Requirements → Documentation)
**Documentation Lines**: ~1,800 lines across 7 workload documents

---

<div align="center">

**Generated by [Agentic InfraOps](../../README.md)** · [Report Issue](https://github.com/jonathan-vella/azure-agentic-infraops/issues/new)

<a href="#readme-top">⬆️ Back to Top</a>

</div>
