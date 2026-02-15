---
description: "Score two Architect agent outputs side-by-side using the evaluation rubric"
agent: "Architect"
---

# Score: Architect Model Evaluation

## Task

Compare the two Architect agent outputs and fill in the scoring rubric.

### Inputs

| Run | Model         | Assessment                                                      | Cost Estimate                                             |
| --- | ------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| A   | Opus 4.6      | `agent-output/aks-platform-opus/02-architecture-assessment.md`  | `agent-output/aks-platform-opus/03-des-cost-estimate.md`  |
| B   | GPT-5.3-Codex | `agent-output/aks-platform-codex/02-architecture-assessment.md` | `agent-output/aks-platform-codex/03-des-cost-estimate.md` |

### Scoring rubric

Read `agent-output/model-eval-scoring.md` for the full rubric.

### Instructions

1. Read both `02-architecture-assessment.md` files side by side
2. Read both `03-des-cost-estimate.md` files side by side
3. Read the requirements from `agent-output/aks-platform-opus/01-requirements.md` as ground truth
4. For each criterion in the rubric:
   - Score each model 1–5 with brief justification in the Notes column
   - Flag any hallucinated facts in the Hallucination Log
5. Calculate weighted totals
6. Fill in the Qualitative Observations and Recommendation sections
7. Save the completed rubric back to `agent-output/model-eval-scoring.md`

### Evaluation guidelines

- **Be objective** — score based on evidence, not preference
- **Check prices** — validate SKU names and prices against Azure Pricing MCP
- **Check facts** — verify service constraints (e.g., AGIC + private cluster)
- **Check template compliance** — verify H2 headings match the artifact template
- **Severity ratings**: H = blocks implementation, M = causes confusion, L = cosmetic
