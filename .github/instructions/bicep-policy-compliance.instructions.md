---
description: "MANDATORY Azure Policy compliance rules for Bicep code generation and agent definitions"
applyTo: "**/*.bicep, **/*.agent.md"
---

# Bicep Policy Compliance Instructions

**First Principle: Azure Policy always wins.** Current Azure Policy
implementation cannot be changed. Code MUST adapt to policy, never
the reverse.

## Mandate

ALL Bicep code generation MUST cross-reference
`04-governance-constraints.md` and `04-governance-constraints.json`
before writing templates. These artifacts contain the discovered
Azure Policy constraints for the target subscription.

## Dynamic Tag List

Tags MUST come from governance constraints, not hardcoded defaults.
The 4 baseline defaults in `bicep-code-best-practices.instructions.md`
(`Environment`, `ManagedBy`, `Project`, `Owner`) are a **MINIMUM** —
discovered policies always win. If governance constraints specify
9 tags, the Bicep code MUST include all 9.

### Example

```text
Defaults (azure-defaults skill):  4 tags
Governance constraints discovered: 9 tags (environment, owner,
  costcenter, application, workload, sla, backup-policy,
  maint-window, tech-contact)
Required in Bicep code:           9 tags (governance wins)
```

## Policy Compliance Checklist

For every policy in `04-governance-constraints.json`:

### Deny Policies

- [ ] Prefer `azurePropertyPath` from JSON; fall back to `bicepPropertyPath` if absent
- [ ] Translate `azurePropertyPath` to Bicep ARM property: drop the leading resource-type
      segment (e.g. `storageAccount.`) and use the remainder as the ARM property path
- [ ] Extract `requiredValue` and verify the generated Bicep code sets the property
      to that value
- [ ] If the property is missing from Bicep code, add it
- [ ] If the property value conflicts, change it to match policy

### Modify Policies

- [ ] Document expected auto-modifications in the implementation
      reference
- [ ] Do NOT set values that Modify policies auto-apply (avoid
      conflicts)

### DeployIfNotExists Policies

- [ ] Document auto-deployed resources in the implementation
      reference
- [ ] Include expected resources in cost estimates

### Audit Policies

- [ ] Document compliance expectations
- [ ] Set compliant values where feasible (best effort)

## Enforcement Rule

> [!CAUTION]
> **Azure Policy always wins.** Current Azure Policy implementation
> cannot be changed. Code MUST adapt to policy, never the reverse.
> A governance compliance failure is a HARD GATE — the Bicep Code
> Generator MUST NOT proceed past Phase 1.5 with unresolved
> policy violations.

## Anti-Patterns

| Anti-Pattern                                                     | Why It Fails                                                                              | Correct Approach                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Assume 4 tags are sufficient                                     | Azure Policy may enforce 9+ tags                                                          | Read `04-governance-constraints.md` for actual tag list |
| Ignore `publicNetworkAccess` constraints                         | Deny policy blocks deployment                                                             | Check network policies in governance constraints        |
| Skip governance constraints reading ("trust artifact chain")     | Trusting the chain means accepting architecture decisions, NOT skipping compliance checks | Always read and enforce governance constraints          |
| Hardcode security settings without checking policy               | Policy may require stricter values                                                        | Cross-reference `04-governance-constraints.json`        |
| Generate Bicep without checking `04-governance-constraints.json` | Governance-blind code fails deployment                                                    | Phase 1.5 is a HARD GATE                                |

## Cross-References

- **Governance constraints artifact**: `agent-output/{project}/04-governance-constraints.md`
- **Governance constraints JSON**: `agent-output/{project}/04-governance-constraints.json`
- **Governance discovery instructions**: `.github/instructions/governance-discovery.instructions.md`
- **Azure defaults (baseline tags)**: `.github/skills/azure-defaults/SKILL.md`
- **Bicep best practices**: `.github/instructions/bicep-code-best-practices.instructions.md`
