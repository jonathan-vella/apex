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

| Trigger Phrase                    | Use Case                      |
| --------------------------------- | ----------------------------- |
| "Generate workload documentation" | Create full doc package       |
| "Document the deployment"         | Post-deployment documentation |
| "Create operations runbook"       | Specific runbook generation   |
| "Generate resource inventory"     | List all deployed resources   |

## Output Files

All documentation is saved to `agent-output/{project}/`:

| File                        | Purpose                       | Template |
| --------------------------- | ----------------------------- | -------- |
| `07-documentation-index.md` | Master index linking all docs | Required |
| `07-design-document.md`     | 10-section technical design   | Required |
| `07-operations-runbook.md`  | Day-2 operational procedures  | Required |
| `07-resource-inventory.md`  | Complete resource listing     | Required |
| `07-ab-cost-estimate.md`    | As-built cost analysis        | Required |
| `07-compliance-matrix.md`   | Security control mapping      | Optional |
| `07-backup-dr-plan.md`      | Disaster recovery procedures  | Optional |

## Source Artifacts

This skill synthesizes from existing project artifacts:

| Source                          | Information Extracted                    |
| ------------------------------- | ---------------------------------------- |
| `01-requirements.md`            | Business context, NFRs, compliance needs |
| `02-architecture-assessment.md` | WAF scores, SKU recommendations          |
| `04-implementation-plan.md`     | Resource inventory, dependencies         |
| `06-deployment-summary.md`      | Deployed resources, outputs              |
| `infra/bicep/{project}/`        | Actual configuration values              |

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

Document structures are defined in the templates folder. Follow these when generating output:

| Document            | Template                                                     |
| ------------------- | ------------------------------------------------------------ |
| Design Document     | See `07-design-document.template.md` (10 sections)           |
| Operations Runbook  | See `07-operations-runbook.template.md` (6 sections)         |
| Resource Inventory  | See `07-resource-inventory.template.md` (2 sections + table) |
| Backup/DR Plan      | See `07-backup-dr-plan.template.md` (9 sections)             |
| Compliance Matrix   | See `07-compliance-matrix.template.md` (6 sections)          |
| Documentation Index | See `07-documentation-index.template.md` (5 sections)        |

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
6. **Follow visual styling** - Use callouts, emoji, collapsible sections per styling guide

## Visual Styling Standards

**MANDATORY**: All generated documentation MUST follow:

📚 **[documentation-styling.md](../../agents/_shared/documentation-styling.md)**

Key requirements:

| Element        | Usage                   | Example                                         |
| -------------- | ----------------------- | ----------------------------------------------- |
| Callouts       | Emphasis & warnings     | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`         |
| Status Emoji   | Progress indicators     | ✅ ⚠️ ❌ 💡                                     |
| Category Icons | Resource sections       | 💻 💾 🌐 🔐 📊                                  |
| Collapsible    | Long content (>10 rows) | `<details>...</details>`                        |
| References     | Evidence links          | Microsoft Learn URLs in `## References` section |

### References Section (Required)

Every document MUST include a `## References` section at the bottom with relevant Microsoft Learn links:

```markdown
---

## References

> [!NOTE]
> 📚 The following Microsoft Learn resources provide additional guidance.

| Topic                      | Link                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| Well-Architected Framework | [Overview](https://learn.microsoft.com/azure/well-architected/)                  |
| Azure Backup               | [Best Practices](https://learn.microsoft.com/azure/backup/backup-best-practices) |
```

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
- [ ] H2 headings validated with `npm run lint:artifact-templates`
- [ ] Content under each H2 semantically matches the heading text

## Template References

When generating documentation, follow these template structures:

- [07-documentation-index.template.md](../../templates/07-documentation-index.template.md)
- [07-design-document.template.md](../../templates/07-design-document.template.md)
- [07-operations-runbook.template.md](../../templates/07-operations-runbook.template.md)
- [07-resource-inventory.template.md](../../templates/07-resource-inventory.template.md)
- [07-ab-cost-estimate.template.md](../../templates/07-ab-cost-estimate.template.md)
- [07-backup-dr-plan.template.md](../../templates/07-backup-dr-plan.template.md)
- [07-compliance-matrix.template.md](../../templates/07-compliance-matrix.template.md)

## Generation Workflow

Follow these steps when generating documentation:

1. **Gather Context** - Read project artifacts (01-06), Bicep templates, deployment outputs
2. **Load Templates** - Read each template from `.github/templates/07-*.template.md`
3. **Extract Resources** - Parse deployed resources from `06-deployment-summary.md`
4. **Query Pricing** - Use Azure Pricing MCP for cost estimates (if available)
5. **Generate Documents** - Create each document following template H2 structure
6. **Cross-Reference** - Ensure consistency across all documents
7. **Create Index** - Generate `07-documentation-index.md` linking all documents
8. **Validate H2 Compliance** - Run the heading validator to verify
   all H2 headings match templates. Fix any drift before committing.
   Command: `node scripts/fix-artifact-h2.mjs agent-output/{project}/07-*.md`

## Template Compliance Rules

**CRITICAL**: Templates define the H2 structure for each document.

| Rule             | Requirement                                   |
| ---------------- | --------------------------------------------- |
| **Exact text**   | Use template's H2 text verbatim               |
| **Exact order**  | Required H2s appear in template-defined order |
| **Anchor rule**  | Extra sections allowed only AFTER last H2     |
| **No omissions** | All template H2s must appear in output        |
| **Attribution**  | Include generation date and source in header  |

Example header format:

```markdown
# Step 7: Design Document - {project-name}

> Generated by azure-workload-docs skill | {YYYY-MM-DD}
> Source artifacts: 02-architecture-assessment.md, 06-deployment-summary.md
```

## Guardrails

### DO

- ✅ Read templates BEFORE generating any output
- ✅ Run `npm run lint:artifact-templates` AFTER generating all outputs
- ✅ Verify content under each H2 semantically matches the heading text
- ✅ Parse actual Bicep for resource configurations
- ✅ Include specific Azure CLI/PowerShell commands in runbooks
- ✅ Map compliance controls to actual resource configurations
- ✅ Use actual SKU names, not generic placeholders
- ✅ Calculate costs from deployed SKUs, not estimates

### DO NOT

- ❌ Generate documents without reading templates first
- ❌ Use placeholder text like "TBD" or "Insert here"
- ❌ Create generic runbooks without project-specific commands
- ❌ Skip sections defined in templates
- ❌ Reorder H2 headings from template structure
- ❌ Generate cost estimates without checking actual SKUs
