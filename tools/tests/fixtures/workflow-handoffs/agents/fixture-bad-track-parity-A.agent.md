---
name: fixture-track-parity-A
description: "Fixture: B4 track parity test (Bicep-side). Paired with fixture-track-parity-B."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self refresh"
    agent: fixture-track-parity-A
    prompt: "Refresh A. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Run What-If Bicep Only"
    agent: fixture-track-parity-A
    prompt: "Run what-if. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
---

# Track Parity A

Role: Bicep-side track-parity fixture.

# Goal

Trip B4 when paired with fixture-track-parity-B (label "Run What-If" vs "Run Plan" diverges after token strip).

# Success criteria

- workflow-handoff-track-parity-001 fires

# Constraints

Run with `WORKFLOW_HANDOFFS_TEST_TRACK_PAIRS='[["fixture-track-parity-A","fixture-track-parity-B"]]'`.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected finding.
