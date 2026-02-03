# ADR Template

Use this template structure for all Architecture Decision Records.

## Front Matter

```yaml
---
title: "ADR-NNNN: [Decision Title]"
status: "Proposed"
date: "YYYY-MM-DD"
authors: "[Stakeholder Names/Roles]"
tags: ["architecture", "decision"]
supersedes: ""
superseded_by: ""
---
```

## Document Structure

### Status

State the current status: Proposed, Accepted, Rejected, Superseded, or Deprecated.

### Context

Explain the problem statement, technical constraints, business requirements, and
environmental factors requiring this decision.

**Include:**

- Forces at play (technical, business, organizational)
- Problem or opportunity description
- Relevant constraints and requirements

### Decision

State the chosen solution clearly and unambiguously. Explain why this solution was
chosen and include key factors that influenced the decision.

### Consequences

#### Positive

- **POS-001**: [Beneficial outcome]
- **POS-002**: [Performance/maintainability improvement]
- **POS-003**: [Alignment with principles]

#### Negative

- **NEG-001**: [Trade-off or limitation]
- **NEG-002**: [Technical debt introduced]
- **NEG-003**: [Risk or future challenge]

### Alternatives Considered

For each alternative:

#### [Alternative Name]

- **ALT-XXX**: **Description**: [Brief technical description]
- **ALT-XXX**: **Rejection Reason**: [Why not selected]

### Implementation Notes

- **IMP-001**: [Key implementation consideration]
- **IMP-002**: [Migration or rollout strategy]
- **IMP-003**: [Monitoring and success criteria]

### References

- **REF-001**: [Related ADRs]
- **REF-002**: [External documentation]
- **REF-003**: [Standards or frameworks]
