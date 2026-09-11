<!-- ref:guardrails-v1 -->

# ADR Guardrails & Patterns to Avoid

Rules for maintaining ADR quality and common anti-patterns to avoid.

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
