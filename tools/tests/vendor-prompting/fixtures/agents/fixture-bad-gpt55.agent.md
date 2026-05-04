---
name: fixture-bad-gpt55
description: "Bad GPT-5.5 agent fixture — missing skeleton sections, contains Claude-only XML, empty stop rules."
model: ["GPT-5.5"]
user-invocable: false
agents: []
tools: [read]
handoffs:
  - label: "▶ Vague"
    agent: fixture-bad-gpt55
    prompt: "Run."
    send: true
---

# Bad GPT-5.5 Agent Fixture

<context_awareness>
This block is Claude-only and should not appear in a GPT agent.
</context_awareness>

<output_contract>
Forbidden Claude XML for GPT.
</output_contract>

# Personality

This is an internal pipeline subagent — Personality should NOT appear here.

# Goal

Some goal.

# Stop rules

Expected findings:

- gpt55-skeleton-001 (missing # Success criteria, # Constraints, # Output)
- gpt-no-claude-xml-001 × 2 (<context_awareness>, <output_contract>)
- personality-scoping-001 (Personality on non-user-facing agent)
- handoff-enrichment-001 (handoff missing input + output)
- gpt55-stop-rules-non-empty-001 — actually this section IS non-empty
  because it contains this prose; rule should not fire.
