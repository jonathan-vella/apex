---
description: "Model evaluation Run A: Architect agent with Claude Opus 4.6 on aks-platform requirements"
agent: "Architect"
---

# Run A: Architect (Claude Opus 4.6)

## Context

This is a model evaluation run. The Architect agent's frontmatter already uses
`model: ["Claude Opus 4.6"]`, so no changes are needed.

## Task

Create a WAF assessment with cost estimates for the **aks-platform-opus** project.

1. Read requirements from `agent-output/aks-platform-opus/01-requirements.md`
2. Follow the standard Architect agent workflow (read skills, WAF assessment, cost estimate)
3. Save output to:
   - `agent-output/aks-platform-opus/02-architecture-assessment.md`
   - `agent-output/aks-platform-opus/03-des-cost-estimate.md`
4. Update `agent-output/aks-platform-opus/README.md` to mark Step 2 complete

**Important**: This is an evaluation run. Do NOT proceed past Step 2. Do NOT
hand off to bicep-plan. Just generate the assessment and stop.

## Prompt

@Architect Create a WAF assessment with cost estimates based on the requirements
in `agent-output/aks-platform-opus/01-requirements.md`. Save to
`agent-output/aks-platform-opus/02-architecture-assessment.md` and
`agent-output/aks-platform-opus/03-des-cost-estimate.md`. This is a model
evaluation run — stop after generating the assessment, do not proceed to
planning.
