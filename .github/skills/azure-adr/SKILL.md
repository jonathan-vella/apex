---
name: azure-adr
description: '**ANALYSIS SKILL** — Creates Azure Architecture Decision Records (ADRs) with WAF pillar mapping, alternatives, and consequences. WHEN: "create ADR", "document decision", "architecture decision record", "record why we chose", "WAF pillar justification", "trade-off analysis". DO NOT USE FOR: IaC code (06b/06t agents), architecture diagrams (drawio), cost estimates (cost-estimate-subagent).'
compatibility: Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool; no external dependencies required.
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  category: document-creation
---

# Azure Architecture Decision Records (ADR) Skill

Create formal Architecture Decision Records that document significant infrastructure
decisions with Azure-specific context, WAF pillar analysis, and implementation guidance.

## When to Use This Skill

| Trigger Phrase                        | Use Case                                   |
| ------------------------------------- | ------------------------------------------ |
| "Create an ADR for..."                | Document a specific architectural decision |
| "Document the decision to use..."     | Record technology/pattern choice           |
| "Record why we chose..."              | Capture decision rationale                 |
| "Architecture decision record for..." | Formal ADR creation                        |

## Output Format

ADRs are saved to the project's agent-output folder:

```text
agent-output/{project}/
├── 03-des-adr-0001-{short-title}.md    # Design phase ADRs
└── 07-ab-adr-0001-{short-title}.md     # As-built phase ADRs
```

### Naming Convention

- **Prefix**: `03-des-adr-` (design) or `07-ab-adr-` (as-built)
- **Number**: 4-digit sequence (0001, 0002, etc.)
- **Title**: Lowercase with hyphens (e.g., `use-cosmos-db-for-state`)

## ADR Template Structure

📋 **Reference**: Read `references/adr-template.md` for the full ADR template
with all sections (Context, Decision, Alternatives, Consequences,
WAF Pillar Analysis, Compliance, Implementation Notes).

## Example Prompts

### Design Phase ADR

```text
Create an ADR documenting our decision to use Azure Cosmos DB
instead of Azure SQL for the e-commerce catalog service.
Consider WAF implications and cost trade-offs.
```

### As-Built ADR

```text
Document the architectural decision we made during implementation
to use Azure Front Door instead of Application Gateway.
Include the performance testing results that informed this choice.
```

### From Assessment

```text
Use the azure-adr skill to document the database decision from
the architecture assessment above as a formal ADR.
```

## Integration with Workflow

| Step                | Context                      | ADR Type                     |
| ------------------- | ---------------------------- | ---------------------------- |
| Step 2 (Architect)  | After WAF assessment         | Design ADR (`03-des-adr-*`)  |
| Step 5 (Bicep Code) | After implementation choices | As-built ADR (`07-ab-adr-*`) |
| Step 6 (Deploy)     | After deployment decisions   | As-built ADR (`07-ab-adr-*`) |

## Rules

1. **One decision per ADR** - Keep ADRs focused on a single decision
2. **Include alternatives** - Always document what was considered and rejected
3. **Map to WAF pillars** - Show impact on each Well-Architected pillar
4. **Link to requirements** - Reference the requirement that drove the decision
5. **Keep it concise** - ADRs should be readable in 5 minutes

## Common ADR Topics

| Category        | Example Decisions                                    |
| --------------- | ---------------------------------------------------- |
| **Compute**     | AKS vs App Service, Container Apps vs Functions      |
| **Data**        | Cosmos DB vs SQL, Redis vs Table Storage             |
| **Networking**  | Hub-spoke vs flat, Private Link vs Service Endpoints |
| **Security**    | Managed Identity vs SPN, Key Vault vs App Config     |
| **Integration** | Event Grid vs Service Bus, API Management tiers      |

## What This Skill Does NOT Do

- ❌ Generate Bicep or Terraform code
- ❌ Create architecture diagrams (use `drawio` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create implementation plans (use `iac-planner` agent)

## Workflow Integration

This skill produces artifacts in **Step 3** (design) or **Step 7** (as-built).

| Workflow Step     | ADR Prefix    | Status Default | Purpose                         |
| ----------------- | ------------- | -------------- | ------------------------------- |
| Step 3 (Design)   | `03-des-adr-` | Proposed       | Document decisions before build |
| Step 7 (As-Built) | `07-ab-adr-`  | Accepted       | Document implemented decisions  |

### Artifact Suffix Rules

1. When called from Architect → use `03-des-adr-` prefix
2. When called after deployment (Step 6) → use `07-ab-adr-` prefix
3. When called standalone:
   - Design/proposal/planning language → use `03-des-adr-`
   - Deployed/implemented/current state language → use `07-ab-adr-`

**Important**: The `07-ab-adr-` ADR may differ from `03-des-adr-` if implementation required changes.
Document any deviations in the "Implementation Notes" section.

## Steps

Follow these steps when creating ADRs:

1. **Gather Information** - Collect decision context, alternatives, stakeholders
2. **Determine Number** - Check existing ADRs in `agent-output/{project}/` for next sequence
3. **Determine Phase** - Design (`03-des-`) or As-Built (`07-ab-`) based on context
4. **Generate Document** - Create ADR following template structure
5. **Include WAF Analysis** - Map decision impact to all 5 WAF pillars
6. **Document Alternatives** - List at least 2-3 alternatives with rejection reasons

## Quality Checklist

Before finalizing the ADR, verify:

- [ ] ADR number is sequential and correct
- [ ] File name follows naming convention (`{step}-adr-NNNN-{title-slug}.md`)
- [ ] Status is set appropriately (Proposed for design, Accepted for as-built)
- [ ] Date is in YYYY-MM-DD format
- [ ] Context clearly explains the problem/opportunity
- [ ] Decision is stated clearly and unambiguously
- [ ] At least 1 positive consequence documented
- [ ] At least 1 negative consequence documented
- [ ] At least 1 alternative documented with rejection reasons
- [ ] WAF pillar analysis includes all 5 pillars
- [ ] Implementation notes provide actionable guidance

## Guardrails

📋 **Reference**: Read `references/guardrails.md` for detailed DO/DON'T rules and anti-pattern table.

**Key rules**: Always include WAF analysis, document 2-3 alternatives,
include both positive and negative consequences, use specific decision statements.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                    | When to Load                              |
| ---------------------------- | ----------------------------------------- |
| `references/adr-template.md` | Full ADR template with all sections       |
| `references/guardrails.md`   | Guardrails, DO/DON'T rules, anti-patterns |
