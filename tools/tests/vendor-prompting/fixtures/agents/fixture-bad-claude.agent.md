---
name: fixture-bad-claude
description: "Bad Claude agent fixture — intentionally violates several vendor-prompting rules to validate detection logic."
model: ["Claude Opus 5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Vague"
    agent: fixture-bad-claude
    prompt: "Begin work."
    send: true
---

# Bad Claude Agent Fixture

This fixture uses an explicit prefill instruction, which Anthropic deprecated:
"prefill the assistant turn with the JSON skeleton". It also asks the model to
think step by step and show your reasoning in the reply.

It should produce these findings:

- claude-no-prefill-001 (matches "prefill the assistant")
- claude-reasoning-extraction-001 (matches "think step by step")
- handoff-enrichment-001 (handoff missing input + output references)
