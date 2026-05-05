---
description: "Bad prompt: uses generic agent: agent but omits model:. Should fire prompt-model-source-001."
agent: agent
---

# Bad Generic-Agent Prompt Fixture

This fixture uses `agent: agent` (generic) but does NOT declare `model:`.
Without an inherited model from a custom agent, the validator cannot
classify the family — `prompt-model-source-001` (severity error) must fire.
