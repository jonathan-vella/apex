---
name: fixture-handoff-self-loop-bad
description: "Fixture: trips workflow-handoff-self-loop-bound-001 by declaring 7 self-loop handoffs."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self 1"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 1. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 2"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 2. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 3"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 3. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 4"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 4. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 5"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 5. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 6"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 6. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Self 7"
    agent: fixture-handoff-self-loop-bad
    prompt: "Self refresh 7. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
---

# Bad Self-Loop Fixture

Role: declare more self-loop handoffs than the cap allows.

# Goal

Trip the self-loop bound rule.

# Success criteria

- workflow-handoff-self-loop-bound-001 fires

# Constraints

None.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected finding.
