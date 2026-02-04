# static-webapp-test - Workload Documentation

**Generated**: December 17, 2025
**Version**: 1.0
**Status**: Complete

## 1. Document Package Contents

| Document                                         | Description                                  | Status |
| ------------------------------------------------ | -------------------------------------------- | ------ |
| [Design Document](./07-design-document.md)       | Comprehensive 10-section architecture design | ✅     |
| [Operations Runbook](./07-operations-runbook.md) | Day-2 operational procedures                 | ✅     |
| [Resource Inventory](./07-resource-inventory.md) | Complete resource listing from IaC           | ✅     |
| [Compliance Matrix](./07-compliance-matrix.md)   | Security controls mapping                    | ✅     |
| [Backup & DR Plan](./07-backup-dr-plan.md)       | Recovery procedures                          | ✅     |

## 2. Source Artifacts

These documents were generated from the following agentic workflow outputs:

| Artifact            | Source                                                                     | Generated  |
| ------------------- | -------------------------------------------------------------------------- | ---------- |
| Requirements        | [01-requirements.md](./01-requirements.md)                                 | 2024-12-17 |
| WAF Assessment      | [02-architecture-assessment.md](./02-architecture-assessment.md)           | 2024-12-17 |
| Cost Estimate       | [03-des-cost-estimate.md](./03-des-cost-estimate.md)                       | 2024-12-17 |
| Design Diagram      | [03-des-diagram.png](./03-des-diagram.png)                                 | 2024-12-17 |
| Governance          | [04-governance-constraints.md](./04-governance-constraints.md)             | 2024-12-17 |
| Implementation Plan | [04-implementation-plan.md](./04-implementation-plan.md)                   | 2024-12-17 |
| Implementation Ref  | [05-implementation-reference.md](./05-implementation-reference.md)         | 2024-12-17 |
| Deployment Summary  | [06-deployment-summary.md](./06-deployment-summary.md)                     | 2024-12-17 |
| As-Built Diagram    | [07-ab-diagram.png](./07-ab-diagram.png)                                   | 2024-12-17 |
| Bicep Code          | [`infra/bicep/static-webapp/`](../../infra/bicep/static-webapp/) | 2024-12-17 |

## 3. Project Summary

| Attribute          | Value                   |
| ------------------ | ----------------------- |
| **Project Name**   | static-webapp-test      |
| **Environment**    | Development             |
| **Primary Region** | swedencentral           |
| **Compliance**     | None (internal tool)    |
| **WAF Score**      | 7.2/10 (Cost optimized) |
| **Monthly Cost**   | ~$15                    |
| **Target Users**   | 5-10 internal           |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Static Web Apps                     │
│                         (Free Tier)                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Static    │    │   Azure     │    │   Azure     │         │
│  │   Content   │───▶│  Functions  │───▶│   SQL DB    │         │
│  │   (HTML/JS) │    │ (Integrated)│    │  (Basic S0) │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Related Resources

- **Infrastructure Code**: [`infra/bicep/static-webapp/`](../../infra/bicep/static-webapp/)
- **Workflow Documentation**: [workflow.md](../../docs/workflow.md)

## 5. Quick Links

- [Deployment Script](../../infra/bicep/static-webapp/deploy.ps1)
- [Main Bicep Template](../../infra/bicep/static-webapp/main.bicep)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
