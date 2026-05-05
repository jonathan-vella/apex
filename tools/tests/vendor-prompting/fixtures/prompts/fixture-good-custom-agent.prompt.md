---
description: "Good prompt: targets a custom agent and correctly omits model: (inherits from agent)."
agent: "02-Requirements"
---

# Good Custom-Agent Prompt Fixture

This fixture targets `02-Requirements` (a known custom agent) and intentionally
omits `model:`. The validator should resolve effective family via the agent's
own `model:` and produce zero findings under `prompt-model-source-001`.
