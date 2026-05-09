---
name: fixture-handoff-artifact-sync-bad
description: "Fixture: trips workflow-handoff-artifact-sync-001 by claiming Output of an artifact no step produces."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self refresh"
    agent: fixture-handoff-artifact-sync-bad
    prompt: "Refresh state. Input: agent-output/{project}/00-fake-input.md. Output: agent-output/{project}/00-fake-output.md."
    send: true
---

# Bad Artifact-Sync Fixture

Role: reference artifacts no step produces.

# Goal

Trip the artifact-sync rule.

# Success criteria

- workflow-handoff-artifact-sync-001 fires

# Constraints

None.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected finding.
