---
name: azure-adr
# yamllint disable-line rule:line-length
description: >
  Create Architecture Decision Records (ADRs) for Azure infrastructure projects.
  Use when asked to "create an ADR", "document architecture decision", "record technical
  decision", "write ADR", or when capturing trade-offs between Azure services. Generates
  structured markdown ADRs with WAF pillar analysis, alternatives comparison, and
  consequences tracking. Supports both design-phase (03-des-) and as-built (07-ab-) ADRs.
license: MIT
metadata:
  category: document-creation
  version: "1.0"
---

# Azure ADR Skill

Create well-structured Architecture Decision Records (ADRs) that document important
technical decisions with clear rationale, consequences, and alternatives. ADRs are
essential for onboarding new team members and maintaining architectural consistency.

## When to Use This Skill

- User asks to "create an ADR" or "document architecture decision"
- User wants to "record a technical decision" or "capture trade-offs"
- User needs to document why a specific Azure service was chosen
- After architect assessment when design decisions need formal documentation
- After deployment when as-built decisions need recording

## Do NOT Use For

- General documentation or meeting notes (use standard markdown)
- Requirements gathering (use requirements agent)
- WAF assessments (use architect agent - ADR captures the resulting decisions)
- Implementation planning (use bicep-plan agent)

---

## ADR Workflow

### Step 1: Gather Required Information

Before creating an ADR, collect:

| Input | Description | Example |
|-------|-------------|---------|
| Decision Title | Clear, concise name | "Use Azure SQL over Cosmos DB" |
| Context | Problem statement, constraints | "Need relational data with ACID guarantees" |
| Alternatives | Options considered | "Cosmos DB, PostgreSQL, SQL Server" |
| Decision | Chosen solution with rationale | "Azure SQL for relational queries" |
| Consequences | Trade-offs (positive and negative) | "Lower cost, limited horizontal scaling" |

### Step 2: Determine ADR Number and Phase

**Workflow Phase Detection:**

| Phase | Prefix | When |
|-------|--------|------|
| Design (Step 3) | `03-des-adr-` | After architect assessment, before implementation |
| As-Built (Step 7) | `07-ab-adr-` | After deployment, documenting actual architecture |

**ADR Numbering:**

1. Check `agent-output/{project}/` for existing ADRs
2. Use next sequential 4-digit number (0001, 0002, etc.)
3. If starting fresh, begin with 0001

### Step 3: Generate ADR Document

Create the ADR following the template in [references/adr-template.md](references/adr-template.md).

**File naming:** `{phase}-adr-NNNN-{title-slug}.md`

Examples:

- `03-des-adr-0001-database-selection.md`
- `07-ab-adr-0002-authentication-strategy.md`

### Step 4: Apply WAF Pillar Analysis

For each ADR affecting architecture, document alignment with Well-Architected Framework:

| Pillar | Question to Answer |
|--------|-------------------|
| Security | How does this decision impact identity, data protection, network security? |
| Reliability | What are the availability, resiliency, and DR implications? |
| Performance | How does this affect scalability and capacity? |
| Cost | What are the cost trade-offs? |
| Operations | How does this impact automation, monitoring, management? |

---

## ADR Status Lifecycle

| Status | When to Use |
|--------|-------------|
| **Proposed** | New ADR awaiting review (default) |
| Accepted | Decision approved and in effect |
| Rejected | Decision considered but not adopted |
| Superseded | Replaced by newer ADR (link to replacement) |
| Deprecated | No longer relevant, kept for history |

---

## Quality Checklist

Before finalizing an ADR:

- [ ] Title clearly describes the decision
- [ ] Context explains the problem and constraints
- [ ] At least 2-3 alternatives documented with rejection reasons
- [ ] Consequences include both positive and negative impacts
- [ ] WAF pillar trade-offs documented
- [ ] Implementation notes are actionable
- [ ] Related ADRs and references linked

---

## References

- [ADR Template](references/adr-template.md) - Standard ADR structure
- [WAF Pillar Mapping](references/waf-mapping.md) - Map decisions to WAF pillars
- [Numbering Conventions](references/numbering.md) - ADR numbering scheme
