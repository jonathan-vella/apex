---
name: azure-adr
description: Creates Azure Architecture Decision Records (ADRs) with WAF mapping, alternatives, consequences, and implementation guidance; use for architecture decision documentation requests.
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

```
agent-output/{project}/
├── 03-des-adr-0001-{short-title}.md    # Design phase ADRs
└── 07-ab-adr-0001-{short-title}.md     # As-built phase ADRs
```

### Naming Convention

- **Prefix**: `03-des-adr-` (design) or `07-ab-adr-` (as-built)
- **Number**: 4-digit sequence (0001, 0002, etc.)
- **Title**: Lowercase with hyphens (e.g., `use-cosmos-db-for-state`)

## ADR Template Structure

```markdown
# ADR-{NNNN}: {Decision Title}

> Status: Proposed | Accepted | Deprecated | Superseded
> Date: {YYYY-MM-DD}
> Deciders: {team/person}

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Alternatives Considered

| Option   | Pros | Cons | WAF Impact                     |
| -------- | ---- | ---- | ------------------------------ |
| Option A | ...  | ...  | Security: +, Cost: -           |
| Option B | ...  | ...  | Reliability: +, Performance: + |

## Consequences

### Positive

- List of positive outcomes

### Negative

- List of trade-offs or risks

### Neutral

- List of neutral observations

## WAF Pillar Analysis

| Pillar      | Impact | Notes |
| ----------- | ------ | ----- |
| Security    | ↑/↓/→  | ...   |
| Reliability | ↑/↓/→  | ...   |
| Performance | ↑/↓/→  | ...   |
| Cost        | ↑/↓/→  | ...   |
| Operations  | ↑/↓/→  | ...   |

## Compliance Considerations

- List any regulatory or compliance implications

## Implementation Notes

- Key implementation details or constraints
```

## Example Prompts

### Design Phase ADR

```
Create an ADR documenting our decision to use Azure Cosmos DB
instead of Azure SQL for the e-commerce catalog service.
Consider WAF implications and cost trade-offs.
```

### As-Built ADR

```
Document the architectural decision we made during implementation
to use Azure Front Door instead of Application Gateway.
Include the performance testing results that informed this choice.
```

### From Assessment

```
Use the azure-adr skill to document the database decision from
the architecture assessment above as a formal ADR.
```

## Integration with Workflow

| Step                | Context                      | ADR Type                     |
| ------------------- | ---------------------------- | ---------------------------- |
| Step 2 (Architect)  | After WAF assessment         | Design ADR (`03-des-adr-*`)  |
| Step 5 (Bicep Code) | After implementation choices | As-built ADR (`07-ab-adr-*`) |
| Step 6 (Deploy)     | After deployment decisions   | As-built ADR (`07-ab-adr-*`) |

## Best Practices

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
- ❌ Create architecture diagrams (use `azure-diagrams` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create implementation plans (use `bicep-plan` agent)

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

## Generation Workflow

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

### DO

- ✅ Create ADR files in `agent-output/{project}/`
- ✅ Use step-prefixed filenames (`03-des-adr-*` or `07-ab-adr-*`)
- ✅ Use 4-digit sequential numbering (0001, 0002, etc.)
- ✅ Include WAF pillar analysis for every ADR
- ✅ Document at least 2-3 alternatives considered
- ✅ Be honest about both benefits and drawbacks
- ✅ Keep ADRs focused on a single decision
- ✅ Use specific, measurable consequences

### DO NOT

- ❌ Use vague decision statements ("We decided to use a database")
- ❌ Skip alternatives section or use "none considered"
- ❌ List only positive consequences
- ❌ Skip WAF pillar analysis
- ❌ Use placeholder text like "TBD" or "Insert here"
- ❌ Create ADRs that cover multiple unrelated decisions
- ❌ Use generic implementation notes ("Deploy to Azure")

## Patterns to Avoid

| Anti-Pattern                 | Problem                                          | Solution                                                              |
| ---------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Vague decision statements    | "We decided to use a database" lacks specificity | State exact technology: "Use Azure SQL Database with geo-replication" |
| Missing alternatives         | No record of other options considered            | Document at least 2-3 alternatives with rejection rationale           |
| One-sided consequences       | Only listing positives                           | Include both positive AND negative consequences                       |
| Incomplete context           | Decision without background                      | Explain the problem, constraints, and forces at play                  |
| Generic implementation notes | "Deploy to Azure"                                | Provide specific, actionable steps with commands/configs              |
| Missing WAF alignment        | No framework reference                           | Document which WAF pillars are affected and how                       |
