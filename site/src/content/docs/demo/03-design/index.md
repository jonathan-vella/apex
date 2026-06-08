---
title: "Design Artifacts Overview"
description: "Architecture Decision Records, cost estimates, and design diagrams produced by the Design Agent for the Malta catering online ordering app"
sidebar:
  order: 3
---

:::tip[Editorial Context]
This artifact was produced by the **Design Agent** (Step 3 of the APEX pipeline).
The Design Agent takes the approved architecture from Step 2 and produces detailed
design artifacts: architecture diagrams, Architecture Decision Records (ADRs) with
WAF pillar analysis, and cost visualization charts. These artifacts provide the
rationale and visual context that feeds into the Governance check (Step 3.5) and
the IaC Planner (Step 4).
:::

## Architecture Diagram

The Design Agent generates a component-level architecture diagram showing all
Azure resources, their connectivity, and network segmentation:

![Architecture Diagram](/demo/03-des-diagram.png)

## Key Artifacts

The Design Agent produced the following artifacts for the Malta Catering project:

### Architecture Decision Records

Three ADRs document the key technical decisions, alternatives considered, and
WAF pillar impact for each choice:

| ADR                 | Title                     | Status             | Key Trade-off                                                            |
| ------------------- | ------------------------- | ------------------ | ------------------------------------------------------------------------ |
| [ADR-0001](./adrs/) | App Service S1 Compute    | Accepted (Revised) | Always-on reliability vs. higher base cost (~$73/mo vs ~$11/mo for ACA)  |
| [ADR-0002](./adrs/) | Table Storage Persistence | Accepted           | Ultra-low cost ($8.47/mo) vs. no native backup (accepted for demo)       |
| [ADR-0003](./adrs/) | VNet + Private Endpoints  | Accepted (Revised) | Enterprise-grade security posture (+$23/mo) vs. simpler public endpoints |

Each ADR includes alternatives considered, WAF pillar scoring, GDPR compliance
considerations, and implementation notes.

### Cost Estimate

The [cost estimate](./cost/) provides a detailed breakdown of the ~$154.87/month
architecture cost, including:

- Line-item cost breakdown by service
- Top 5 cost drivers with optimization opportunities
- Savings opportunities (1-year RI saves ~36% on compute)
- Cost risk indicators and watch items
- 6-month cost projection

All prices were sourced from the Azure Pricing MCP server with `swedencentral`
region filters.
