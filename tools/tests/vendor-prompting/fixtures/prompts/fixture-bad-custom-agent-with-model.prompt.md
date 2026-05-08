---
description: "Bad prompt: targets a custom agent AND declares a redundant model:. Should fire prompt-model-source-001."
agent: "02-Requirements"
model: "Claude Opus 4.7"
---

# Bad Custom-Agent Prompt Fixture

This fixture targets a known custom agent (`02-Requirements`) AND declares
`model:`. The validator should fire `prompt-model-source-001` (severity
error) because the prompt-level `model:` is redundant — the agent's own
`model:` is the source of truth.
