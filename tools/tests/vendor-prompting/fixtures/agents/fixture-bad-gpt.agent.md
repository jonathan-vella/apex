---
name: fixture-bad-gpt
description: "Bad GPT agent fixture — missing skeleton sections, contains Claude-only XML, empty stop rules."
model: ["GPT-5.6-Terra"]
user-invocable: false
agents: []
tools: [read]
handoffs:
  - label: "▶ Vague"
    agent: fixture-bad-gpt
    prompt: "Run."
    send: true
---

# Bad GPT-5.6-Terra Agent Fixture

<context_awareness>
This block is Claude-only and should not appear in a GPT agent.
</context_awareness>

<output_contract>
Forbidden Claude XML for GPT.
</output_contract>

# Personality

This is an internal pipeline subagent — Personality should NOT appear here.

# Goal

Some goal. Ask first before reading. Wait for user approval before editing.
Get approval before running tests. Do not mutate anything without approval.

# Stop rules

Expected findings:

- gpt-outcome-contract-001 (missing # Success criteria, # Constraints, # Output)
- gpt-no-claude-xml-001 × 2 (<context_awareness>, <output_contract>)
- personality-scoping-001 (Personality on non-user-facing agent)
- gpt-approval-repetition-001 (approval phrases repeated in # Goal)
- handoff-enrichment-001 (handoff missing input + output)
- gpt-stop-rules-non-empty-001 — actually this section IS non-empty
  because it contains this prose; rule should not fire.
