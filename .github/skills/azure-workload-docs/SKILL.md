---
name: azure-workload-docs
# yamllint disable-line rule:line-length
description: >
  Generate comprehensive Azure workload documentation packages. Use when asked to "generate
  documentation", "create workload docs", "write design document", "create operations runbook",
  "generate resource inventory", "create backup plan", "write compliance matrix", or
  "document the deployment". Produces 7 document types: design document, operations runbook,
  resource inventory, cost estimate, compliance matrix, backup/DR plan, and documentation index.
  Synthesizes outputs from Bicep templates, WAF assessments, and deployment summaries.
license: MIT
metadata:
  category: workflow-automation
  version: "1.0"
---

# Azure Workload Documentation Skill

Generate customer-deliverable documentation packages by synthesizing outputs from Azure
infrastructure workflows. Creates comprehensive documentation from Bicep templates,
WAF assessments, cost estimates, and deployment summaries.

## When to Use This Skill

- User asks to "generate documentation" or "create workload docs"
- User wants to "document the deployment" or "create design document"
- User needs an "operations runbook" or "resource inventory"
- User requests "backup plan", "DR plan", or "compliance matrix"
- After deployment (Step 6) to create as-built documentation
- When preparing customer deliverables for Azure projects

## Do NOT Use For

- Requirements gathering (use requirements agent)
- Architecture assessment or WAF analysis (use architect agent)
- Creating Bicep templates (use bicep-code agent)
- Deployment execution (use deploy agent)
- Single ADRs (use azure-adr skill)

---

## Output Files

| File | Purpose | Required |
|------|---------|----------|
| `07-documentation-index.md` | Master index of all docs | Yes |
| `07-design-document.md` | 10-section design document | Yes |
| `07-operations-runbook.md` | Day-2 operational procedures | Yes |
| `07-resource-inventory.md` | Resource listing from IaC | Yes |
| `07-ab-cost-estimate.md` | As-built cost analysis | Yes |
| `07-compliance-matrix.md` | Security control mappings | Optional |
| `07-backup-dr-plan.md` | DR procedures | Optional |

---

## Documentation Workflow

### Step 1: Gather Source Artifacts

Before generating documentation, read existing artifacts:

| Artifact | Purpose | Location |
|----------|---------|----------|
| WAF Assessment | Architecture context | `agent-output/{project}/02-*.md` |
| Cost Estimate | Pricing details | `agent-output/{project}/03-des-cost-*.md` |
| Implementation Plan | Resource specs | `agent-output/{project}/04-*.md` |
| Bicep Templates | Technical details | `infra/bicep/{project}/` |
| Deployment Summary | Deployed resources | `agent-output/{project}/06-*.md` |

### Step 2: Generate Documentation Index

Create `07-documentation-index.md` listing all documents:

```markdown
## Document Package Contents

| Document | Status | Description |
|----------|--------|-------------|
| Design Document | ✅ | 10-section architecture design |
| Operations Runbook | ✅ | Day-2 procedures |
| Resource Inventory | ✅ | IaC resource listing |
| Cost Estimate | ✅ | As-built pricing |
```

### Step 3: Generate Design Document

Create `07-design-document.md` with 10 required sections:

1. Introduction
2. Architecture Overview
3. Networking
4. Storage
5. Compute
6. Identity & Access
7. Security & Compliance
8. Backup & DR
9. Monitoring
10. Appendix

See [references/design-document-sections.md](references/design-document-sections.md).

### Step 4: Generate Operations Runbook

Create `07-operations-runbook.md` with:

- Quick Reference (region, RG, contacts)
- Daily Operations (health checks)
- Incident Response (severity, resolution)
- Maintenance (weekly/monthly tasks)
- Scaling (up/down procedures)
- Deployment (standard, emergency, rollback)

### Step 5: Generate Resource Inventory

Create `07-resource-inventory.md` by parsing Bicep templates:

```markdown
## Summary

| Category | Count |
|----------|-------|
| Compute | X |
| Storage | X |
| Networking | X |

## Resource Listing

| Name | Type | SKU | Location |
|------|------|-----|----------|
| {name} | {type} | {sku} | {region} |
```

### Step 6: Generate Cost Estimate

Create `07-ab-cost-estimate.md` using Azure Pricing MCP tools:

1. Parse Bicep templates for resource types and SKUs
2. Query Azure Pricing MCP for each resource
3. Calculate monthly/annual totals
4. Compare to design estimate if available

### Step 7: Generate Optional Documents

If requested:

- `07-compliance-matrix.md` - Security control mappings
- `07-backup-dr-plan.md` - Detailed DR procedures

---

## Template Compliance

**Non-negotiable rules:**

- Keep template H2 headings exactly and in order
- Do NOT add H2 headings beyond the template
- Put extra detail under H3 headings within required H2s

Templates: See `.github/templates/07-*.template.md`

---

## Quality Checklist

Before finalizing:

- [ ] All 10 sections of design document populated
- [ ] Resource inventory matches Bicep definitions
- [ ] Diagrams referenced correctly
- [ ] ADRs linked appropriately
- [ ] Cost estimate generated with current pricing
- [ ] Operations runbook has actionable procedures
- [ ] Tags and naming conventions documented
- [ ] Regional choices documented with rationale
- [ ] Document index complete and accurate

---

## References

- [Design Document Sections](references/design-document-sections.md)
- [Operations Runbook Structure](references/runbook-structure.md)
- Template Files:
  - [07-design-document.template.md](../../templates/07-design-document.template.md)
  - [07-operations-runbook.template.md](../../templates/07-operations-runbook.template.md)
  - [07-resource-inventory.template.md](../../templates/07-resource-inventory.template.md)
  - [07-backup-dr-plan.template.md](../../templates/07-backup-dr-plan.template.md)
  - [07-compliance-matrix.template.md](../../templates/07-compliance-matrix.template.md)
  - [07-documentation-index.template.md](../../templates/07-documentation-index.template.md)
