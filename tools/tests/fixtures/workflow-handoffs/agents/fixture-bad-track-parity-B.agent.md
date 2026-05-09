---
name: fixture-track-parity-B
description: "Fixture: B4 track parity test (Terraform-side). Paired with fixture-track-parity-A."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self refresh"
    agent: fixture-track-parity-B
    prompt: "Refresh B. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
  - label: "▶ Run Plan Terraform Only"
    agent: fixture-track-parity-B
    prompt: "Run plan. Input: agent-output/{project}/x.md. Output: agent-output/{project}/x.md."
    send: true
---

# Track Parity B

Role: Terraform-side track-parity fixture.

# Goal

Trip B4 when paired with fixture-track-parity-A (label "Plan" vs "What-If" diverges after token strip).

# Success criteria

- workflow-handoff-track-parity-001 fires

# Constraints

Run with `WORKFLOW_HANDOFFS_TEST_TRACK_PAIRS='[["fixture-track-parity-A","fixture-track-parity-B"]]'`.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected finding.
