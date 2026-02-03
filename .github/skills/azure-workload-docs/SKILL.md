---
name: azure-workload-docs
description: >
  Generates comprehensive Azure workload documentation from deployed infrastructure.
  Creates 7 document types: design document, operations runbook, resource inventory,
  backup/DR plan, compliance matrix, cost estimate, and documentation index.
  Synthesizes from WAF assessments, Bicep templates, and deployment artifacts.
  **Triggers**: "generate documentation", "create workload docs", "document the deployment"
compatibility: >
  Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
  No external dependencies required.
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  category: workflow-automation
---

# Azure Workload Documentation Skill

Generate comprehensive, production-ready documentation for deployed Azure infrastructure.
This skill creates a complete documentation package from existing artifacts.

## When to Use This Skill

| Trigger Phrase | Use Case |
|----------------|----------|
| "Generate workload documentation" | Create full doc package |
| "Document the deployment" | Post-deployment documentation |
| "Create operations runbook" | Specific runbook generation |
| "Generate resource inventory" | List all deployed resources |

## Output Files

All documentation is saved to `agent-output/{project}/`:

| File | Purpose | Template |
|------|---------|----------|
| `07-documentation-index.md` | Master index linking all docs | Required |
| `07-design-document.md` | 10-section technical design | Required |
| `07-operations-runbook.md` | Day-2 operational procedures | Required |
| `07-resource-inventory.md` | Complete resource listing | Required |
| `07-ab-cost-estimate.md` | As-built cost analysis | Required |
| `07-compliance-matrix.md` | Security control mapping | Optional |
| `07-backup-dr-plan.md` | Disaster recovery procedures | Optional |

## Source Artifacts

This skill synthesizes from existing project artifacts:

| Source | Information Extracted |
|--------|----------------------|
| `01-requirements.md` | Business context, NFRs, compliance needs |
| `02-architecture-assessment.md` | WAF scores, SKU recommendations |
| `04-implementation-plan.md` | Resource inventory, dependencies |
| `06-deployment-summary.md` | Deployed resources, outputs |
| `infra/bicep/{project}/` | Actual configuration values |

## Example Prompts

### Full Documentation Package

```
Generate comprehensive workload documentation for the ecommerce project.
Include all 7 document types with resource inventory from the deployed infrastructure.
```

### Specific Documents

```
Create an operations runbook for the ecommerce deployment.
Focus on daily operations, incident response, and maintenance procedures.
```

```
Generate a resource inventory from the deployed Bicep templates.
Include resource names, SKUs, and monthly cost estimates.
```

### Post-Deployment

```
Use the azure-workload-docs skill to document the infrastructure 
we just deployed. Synthesize from the deployment summary and Bicep templates.
```

## Document Templates

### 07-design-document.md Structure

```markdown
## 1. Introduction
## 2. Azure Architecture Overview
## 3. Networking
## 4. Storage
## 5. Compute
## 6. Identity & Access
## 7. Security & Compliance
## 8. Backup & Disaster Recovery
## 9. Management & Monitoring
## 10. Appendix
```

### 07-operations-runbook.md Structure

```markdown
## Quick Reference
## 1. Daily Operations
## 2. Incident Response
## 3. Common Procedures
## 4. Maintenance Windows
## 5. Contacts & Escalation
## 6. Change Log
```

### 07-resource-inventory.md Structure

```markdown
## Summary
## Resource Listing

| Resource | Type | SKU | Location | Resource Group | Monthly Cost |
|----------|------|-----|----------|----------------|--------------|
```

## Integration with Workflow

This skill is typically invoked:

1. **After Step 6 (Deploy)** - Document what was deployed
2. **Via handoff button** - From deploy or bicep-code agents
3. **Explicitly** - User requests documentation at any time

```
Workflow Step 6 (Deploy) → azure-workload-docs skill → Step 7 outputs
```

## Best Practices

1. **Run after deployment** - Ensures documentation reflects actual state
2. **Include cost estimates** - Use Azure Pricing MCP for accuracy
3. **Map to compliance frameworks** - Reference specific controls
4. **Keep runbooks actionable** - Include actual commands, not just concepts
5. **Version documentation** - Include generation date and source artifacts

## What This Skill Does NOT Do

- ❌ Generate Bicep or Terraform code (use `bicep-code` agent)
- ❌ Create architecture diagrams (use `azure-diagrams` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create ADRs (use `azure-adr` skill)
- ❌ Perform WAF assessments (use `architect` agent)

## Required Context

For best results, ensure these artifacts exist before invoking:

```
agent-output/{project}/
├── 01-requirements.md          # Optional but helpful
├── 02-architecture-assessment.md  # WAF scores, recommendations
├── 04-implementation-plan.md   # Resource inventory
└── 06-deployment-summary.md    # Deployed resources

infra/bicep/{project}/
├── main.bicep                  # Entry point
└── modules/                    # Module configurations
```

## Output Quality Checklist

- [ ] All resources from deployment summary are documented
- [ ] SKUs and configurations match Bicep templates
- [ ] Cost estimates reflect actual deployed SKUs
- [ ] Runbook procedures are specific, not generic
- [ ] Compliance controls map to actual implementations
- [ ] DR procedures include RTO/RPO from requirements
