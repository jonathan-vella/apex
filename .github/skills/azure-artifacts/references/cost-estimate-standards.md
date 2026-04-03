<!-- ref:cost-estimate-standards-v1 -->

# Azure Cost Estimate Documentation Standards

## Document Purpose

Cost estimates provide financial clarity, architecture-to-cost traceability,
optimization guidance, and fast "what changes cost" decisions.

## General Requirements

- Lines ≤ 120 chars; ATX headings; consistent emoji callouts; prefer tables.
- Small workloads: same sections, shorter content.

## Canonical Templates (Golden Source)

Agents MUST start from the appropriate template:

- `.github/skills/azure-artifacts/templates/03-des-cost-estimate.template.md`
- `.github/skills/azure-artifacts/templates/07-ab-cost-estimate.template.md`

H2 headings validated by `azure-artifacts.instructions.md` + `validate-artifact-templates.mjs`.
Use `→` (not `->`) in the Requirements heading.

## Required Sections (21)

1. 💵 Cost At-a-Glance — monthly/annual, budget utilization
2. ✅ Decision Summary — approved, deferred, redesign triggers
3. 🔁 Requirements → Cost Mapping — req-to-SKU mapping
4. 📊 Top 5 Cost Drivers — top contributors
5. Summary — aggregates + business context
6. 🏛️ Architecture Overview — cost distribution + design decisions
7. 🧾 What We Are Not Paying For (Yet) — conscious deferrals
8. ⚠️ Cost Risk Indicators — risk levels + mitigations
9. 🎯 Quick Decision Matrix — "if X, pay Y more"
10. 🧩 Change Control — top 3 likely changes + delta
11. 💰 Savings Opportunities — potential savings + strategies
12. 🧾 Detailed Cost Breakdown — by category with subtotals
13. 📋 Monthly Cost Summary — summary + distribution
14. 🧮 Base Run vs Growth-Variable — variance drivers
15. 🌍 Regional Comparison — primary vs alternative
16. 🔧 Environment Strategy (FinOps) — prod vs non-prod
17. 🔄 Environment Cost Comparison — multi-env table
18. 🛡️ Cost Guardrails — enforcement thresholds
19. 📝 Testable Assumptions — assumptions + measurement
20. 📊 Pricing Data Accuracy — sources + disclaimers
21. 🔗 References — pricing calculator, API, docs

Section templates and visual styling:
`azure-artifacts/references/cost-estimate-sections.md`

## Pricing Sources (Priority Order)

1. Azure Pricing MCP (`azure_price_search`, `azure_cost_estimate`, `azure_bulk_estimate`)
2. Azure Pricing Calculator (manual validation)
3. Azure Retail Prices API (programmatic)

## Patterns to Avoid

| Anti-Pattern           | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Missing cost drivers   | Include top 5 drivers table                      |
| Missing assumptions    | Document usage and pricing basis                 |
| No "what changes cost" | Include the decision matrix                      |
| No risk callouts       | Include cost risk indicators + watch item        |
| No savings section     | Always include savings, even if optimized        |
| `$0.00` savings rows   | Never show `$0.00` — use "Not Quantified" state  |
| Stale prices           | Note query date; re-validate periodically        |
| Missing change control | Include top 3 likely change requests + delta     |
| Hidden trade-offs      | Add "What we are not paying for (yet)"           |
| Unclear variance       | Add confidence, variance, base vs variable split |
