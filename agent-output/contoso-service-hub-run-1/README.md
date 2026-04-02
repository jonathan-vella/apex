<!-- markdownlint-disable MD033 MD041 -->

<a id="readme-top"></a>

<div align="center">

![Status](https://img.shields.io/badge/Status-Complete-brightgreen?style=for-the-badge)

![Step](https://img.shields.io/badge/Step-7%20of%207-blue?style=for-the-badge)

# 🏗️ Contoso Service Hub

**Unified digital services platform for EU real estate and lifestyle ecosystem.**

Bookings, payments, content delivery, and customer engagement.

[View Architecture](#-architecture) · [View Artifacts](#-generated-artifacts) · [View Progress](#-workflow-progress)

</div>

---

## 📋 Project Summary

| Property           | Value                        |
| ------------------ | ---------------------------- |
| **Created**        | 2026-04-01                   |
| **Last Updated**   | 2026-04-01 (Step 7)          |
| **Region**         | swedencentral                |
| **Environment**    | Dev, Staging, Production     |
| **IaC Tool**       | Bicep                        |
| **Estimated Cost** | ~$10,085/month (~€9,338)     |
| **Complexity**     | Complex                      |

---

## ✅ Workflow Progress

```text
[██████████] 100% Complete
```

- Step 1, Requirements: done.
	Artifact: [01-requirements.md](./01-requirements.md)
- Step 2, Architecture: done.
	Artifact: [02-architecture-assessment.md](./02-architecture-assessment.md)
- Step 3, Design: done.
	Artifact: [03-des-architecture-diagram.png](./03-des-architecture-diagram.png)

- Step 3.5, Governance: done.
	Artifact: [04-governance-constraints.md](./04-governance-constraints.md)
- Step 4, Planning: done.
	Artifact: [04-implementation-plan.md](./04-implementation-plan.md)
- Step 5, Implementation: done.
	Artifact: [../../infra/bicep/contoso-service-hub-run-1/main.bicep](../../infra/bicep/contoso-service-hub-run-1/main.bicep)
- Step 6, Deployment: done (`validated-not-deployed`).
	Artifact: [06-deployment-summary.md](./06-deployment-summary.md)
- Step 7, Documentation: done.
	Artifact: [07-documentation-index.md](./07-documentation-index.md)

---

## 🏛️ Architecture

_Architecture diagram and ADRs were generated in Step 3 (Design)._

### Key Resources (from RFQ)

- Azure Front Door: CDN and WAF, `Standard / Premium`, edge security and content delivery.
- Entra External ID: CIAM, `P1`, customer identity for 15K MAU.
- Azure API Management: API gateway, `Standard`, 5M requests per month.
- Container Compute: AKS, `Standard 8 vCPU`, application containers.
- PostgreSQL Flexible Server: managed database, `General Purpose, 256 GB`.
- Azure Managed Redis: in-memory cache, `Enterprise E100, 128 GB`.
- Azure Key Vault: secrets, keys, and certificates, `Standard`.
- Azure Monitor: observability, `Pay-as-you-go`.

---

## 📄 Generated Artifacts

<details open>
<summary><strong>📁 Step 1: Requirements</strong></summary>

- [01-requirements.md](./01-requirements.md): project requirements extracted from the RFQ.

</details>

<details open>
<summary><strong>📁 Step 4: Implementation Plan</strong></summary>

- [04-implementation-plan.md](./04-implementation-plan.md):
	comprehensive Bicep implementation plan with AVM modules, phased deployment, governance compliance.
- [04-dependency-diagram.py](./04-dependency-diagram.py):
	Python `diagrams` source for module dependencies.
- [04-dependency-diagram.png](./04-dependency-diagram.png):
	rendered module dependency diagram.
- [04-runtime-diagram.py](./04-runtime-diagram.py):
	Python `diagrams` source for runtime data flow.
- [04-runtime-diagram.png](./04-runtime-diagram.png):
	rendered runtime flow diagram.

</details>

<details open>
<summary><strong>📁 Step 5: Bicep Implementation</strong></summary>

- [../../infra/bicep/contoso-service-hub-run-1/main.bicep](../../infra/bicep/contoso-service-hub-run-1/main.bicep):
	validated orchestration template for the Contoso Service Hub platform.
- [../../infra/bicep/contoso-service-hub-run-1/main.bicepparam](../../infra/bicep/contoso-service-hub-run-1/main.bicepparam):
	dev parameter baseline used for validation.
- [../../infra/bicep/contoso-service-hub-run-1/azure.yaml](../../infra/bicep/contoso-service-hub-run-1/azure.yaml):
	deployment manifest for `azd provision`.

</details>

<details open>
<summary><strong>📁 Step 6: Deployment Validation</strong></summary>

- [06-deployment-summary.md](./06-deployment-summary.md):
	validated-not-deployed summary confirming build, lint, and governance checks passed.

</details>

<details open>
<summary><strong>📁 Step 7: Documentation</strong></summary>

- [07-documentation-index.md](./07-documentation-index.md):
	master index for the Step 7 package.
- [07-design-document.md](./07-design-document.md):
	detailed technical design for the validated Azure baseline.
- [07-operations-runbook.md](./07-operations-runbook.md):
	day-2 operating guidance and incident procedures.
- [07-resource-inventory.md](./07-resource-inventory.md):
	validated inventory of resources, SKUs, regions, and tags.
- [07-backup-dr-plan.md](./07-backup-dr-plan.md):
	single-region backup and recovery plan.
- [07-compliance-matrix.md](./07-compliance-matrix.md):
	GDPR and PCI-DSS control mapping against the design baseline.
- [07-ab-cost-estimate.md](./07-ab-cost-estimate.md):
	as-built cost baseline for dev, staging, and prod.

</details>

<details open>
<summary><strong>📁 Step 3.5: Governance</strong></summary>

- [04-governance-constraints.md](./04-governance-constraints.md):
	GDPR-focused governance template baseline for the planned Azure services.
- [04-governance-constraints.json](./04-governance-constraints.json):
	machine-readable governance constraints for downstream planning and code generation.

</details>

<details open>
<summary><strong>📁 Step 3: Design</strong></summary>

- [03-des-adr-001-container-platform.md](./03-des-adr-001-container-platform.md):
	ADR for AKS versus Container Apps.
- [03-des-adr-002-caching-tier.md](./03-des-adr-002-caching-tier.md):
	ADR for Redis Enterprise E100 selection.
- [03-des-adr-003-eu-data-boundary.md](./03-des-adr-003-eu-data-boundary.md):
	ADR for the EU Data Boundary strategy.
- [03-des-architecture-diagram.py](./03-des-architecture-diagram.py):
	Python `diagrams` source.
- [03-des-architecture-diagram.png](./03-des-architecture-diagram.png):
	rendered architecture diagram.

</details>

<details open>
<summary><strong>📁 Step 2: Architecture Assessment</strong></summary>

- [02-architecture-assessment.md](./02-architecture-assessment.md):
	WAF assessment across all five pillars.
- [03-des-cost-estimate.md](./03-des-cost-estimate.md):
	detailed cost estimate per service.
- [02-waf-scores.png](./02-waf-scores.png): WAF pillar scores chart.
- [03-des-cost-distribution.png](./03-des-cost-distribution.png):
	cost distribution donut chart.
- [03-des-cost-projection.png](./03-des-cost-projection.png):
	six-month cost projection chart.

</details>

---

## 🔗 Related Resources

- Well-Architected Framework:
	[Overview](https://learn.microsoft.com/azure/well-architected/)
- Azure Compliance:
	[Compliance](https://learn.microsoft.com/azure/compliance/)
- EU Data Boundary:
	[EU Data Boundary](https://learn.microsoft.com/privacy/eudb/eu-data-boundary-learn)

---

<div align="center">

<sub>Generated by Agentic PlatformOps · Step 7 of 7</sub>

</div>
