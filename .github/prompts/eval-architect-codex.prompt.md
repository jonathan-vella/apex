---
description: "Model evaluation Run B: Architect agent with GPT-5.3-Codex on aks-platform requirements"
agent: "Architect"
---

# Run B: Architect (GPT-5.3-Codex)

## Pre-requisite: Switch model

Before running this prompt, temporarily change the Architect agent model:

**File**: `.github/agents/architect.agent.md`

```yaml
# Change FROM:
model: ["Claude Opus 4.6"]
# Change TO:
model: ["GPT-5.3-Codex"]
```

> **Remember to revert after the run!**

## Task

Create a WAF assessment with cost estimates for the **aks-platform-codex** project.

1. Read requirements from `agent-output/aks-platform-codex/01-requirements.md`
2. Follow the standard Architect agent workflow (read skills, WAF assessment, cost estimate)
3. Save output to:
   - `agent-output/aks-platform-codex/02-architecture-assessment.md`
   - `agent-output/aks-platform-codex/03-des-cost-estimate.md`
4. Update `agent-output/aks-platform-codex/README.md` to mark Step 2 complete

**Important**: This is an evaluation run. Do NOT proceed past Step 2. Do NOT
hand off to bicep-plan. Just generate the assessment and stop.

## Post-run: Revert model

```yaml
# Change back in .github/agents/architect.agent.md:
model: ["Claude Opus 4.6"]
```

## Prompt

@Architect Create a WAF assessment with cost estimates based on the requirements
in `agent-output/aks-platform-codex/01-requirements.md`. Save to
`agent-output/aks-platform-codex/02-architecture-assessment.md` and
`agent-output/aks-platform-codex/03-des-cost-estimate.md`. This is a model
evaluation run — stop after generating the assessment, do not proceed to
planning.
