---
name: azure-adr
description: >
  Creates Architecture Decision Records (ADRs) for Azure infrastructure decisions.
  Documents architectural choices with WAF pillar mapping, alternatives analysis,
  and consequence assessment. Outputs follow the standard ADR format with Azure-specific
  sections for compliance, cost impact, and operational considerations.
  **Triggers**: "create ADR", "document decision", "architecture decision record"
compatibility: >
  Works with Claude Code, GitHub Copilot, VS Code, and any Agent Skills compatible tool.
  No external dependencies required.
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

| Trigger Phrase | Use Case |
|----------------|----------|
| "Create an ADR for..." | Document a specific architectural decision |
| "Document the decision to use..." | Record technology/pattern choice |
| "Record why we chose..." | Capture decision rationale |
| "Architecture decision record for..." | Formal ADR creation |

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

| Option | Pros | Cons | WAF Impact |
|--------|------|------|------------|
| Option A | ... | ... | Security: +, Cost: - |
| Option B | ... | ... | Reliability: +, Performance: + |

## Consequences

### Positive
- List of positive outcomes

### Negative
- List of trade-offs or risks

### Neutral
- List of neutral observations

## WAF Pillar Analysis

| Pillar | Impact | Notes |
|--------|--------|-------|
| Security | ↑/↓/→ | ... |
| Reliability | ↑/↓/→ | ... |
| Performance | ↑/↓/→ | ... |
| Cost | ↑/↓/→ | ... |
| Operations | ↑/↓/→ | ... |

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

| Step | Context | ADR Type |
|------|---------|----------|
| Step 2 (Architect) | After WAF assessment | Design ADR (`03-des-adr-*`) |
| Step 5 (Bicep Code) | After implementation choices | As-built ADR (`07-ab-adr-*`) |
| Step 6 (Deploy) | After deployment decisions | As-built ADR (`07-ab-adr-*`) |

## Best Practices

1. **One decision per ADR** - Keep ADRs focused on a single decision
2. **Include alternatives** - Always document what was considered and rejected
3. **Map to WAF pillars** - Show impact on each Well-Architected pillar
4. **Link to requirements** - Reference the requirement that drove the decision
5. **Keep it concise** - ADRs should be readable in 5 minutes

## Common ADR Topics

| Category | Example Decisions |
|----------|-------------------|
| **Compute** | AKS vs App Service, Container Apps vs Functions |
| **Data** | Cosmos DB vs SQL, Redis vs Table Storage |
| **Networking** | Hub-spoke vs flat, Private Link vs Service Endpoints |
| **Security** | Managed Identity vs SPN, Key Vault vs App Config |
| **Integration** | Event Grid vs Service Bus, API Management tiers |

## What This Skill Does NOT Do

- ❌ Generate Bicep or Terraform code
- ❌ Create architecture diagrams (use `azure-diagrams` skill)
- ❌ Deploy resources (use `deploy` agent)
- ❌ Create implementation plans (use `bicep-plan` agent)
