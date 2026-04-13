# Instruction Precedence Matrix

When multiple instruction files apply to the same file type (via overlapping
`applyTo` globs), this matrix defines which rules take precedence.

## Precedence Order (highest wins)

1. **Azure Policy constraints** — `references/iac-policy-compliance.md`
   - Azure Policy ALWAYS wins. If a governance Deny policy conflicts with
     any other instruction, the policy constraint takes precedence.
2. **Domain-specific IaC instructions** — `iac-bicep-best-practices.instructions.md`
   or `iac-terraform-best-practices.instructions.md`
   - AVM-first, naming conventions, security baseline, file structure.
3. **Cross-cutting IaC instructions** — `iac-plan-best-practices.instructions.md` / `references/iac-cost-monitoring.md`
   - Budget resources, forecast alerts, parameterization rules.
4. **General code quality** — `code-quality.instructions.md`
   - Comment style (WHY not WHAT), review priority tiers, security checklist.

## Overlap Map

### Files matching `**/*.bicep`

| Instruction              | Priority    | Key Rules                                               |
| ------------------------ | ----------- | ------------------------------------------------------- |
| iac-policy-compliance    | 1 (highest) | Governance Deny policies block deployment               |
| iac-bicep-best-practices | 2           | AVM-first, CAF naming, unique suffix, security defaults |
| iac-plan-best-practices  | 3           | Budget resources, forecast alerts, no hardcoded values  |
| code-quality             | 4 (lowest)  | WHY comments, security review priority                  |

### Files matching `**/*.tf`

| Instruction                  | Priority    | Key Rules                                                 |
| ---------------------------- | ----------- | --------------------------------------------------------- |
| iac-policy-compliance        | 1 (highest) | Governance Deny policies block deployment                 |
| iac-terraform-best-practices | 2           | AVM-TF, provider pin ~>4.0, CAF naming, security defaults |
| iac-plan-best-practices      | 3           | Budget resources, forecast alerts, no hardcoded values    |
| code-quality                 | 4 (lowest)  | WHY comments, security review priority                    |

### Files matching `**/*.md`

| Instruction                         | Priority   | Key Rules                              |
| ----------------------------------- | ---------- | -------------------------------------- |
| azure-artifacts (for agent-output/) | 1          | H2 heading compliance, template-first  |
| docs (for docs/)                    | 2          | Single H1, relative links, DRY         |
| markdown                            | 3 (lowest) | 120-char lines, ATX headings, alt text |

## Conflict Resolution

When two instructions at the same priority level conflict:

1. The MORE SPECIFIC instruction wins (domain > general)
2. If equally specific, the instruction with automated enforcement wins
3. If neither has enforcement, document the exception in the artifact
