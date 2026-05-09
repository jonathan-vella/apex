---
name: fixture-handoff-subagent-dispatch-bad
description: "Fixture: trips workflow-handoff-subagent-dispatch-001 with an unknown subagent and a non-cross-cutting wildcard."
model: ["GPT-5.5"]
user-invocable: true
agents: ["unknown-imaginary-subagent", "*"]
tools: [read]
handoffs: []
---

# Bad Subagent Dispatch Fixture

Role: declare unknown subagents and an unauthorized wildcard.

# Goal

Trip the subagent-dispatch rule twice.

# Success criteria

- workflow-handoff-subagent-dispatch-001 fires for "\*"
- workflow-handoff-subagent-dispatch-001 fires for "unknown-imaginary-subagent"

# Constraints

None.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected findings.
