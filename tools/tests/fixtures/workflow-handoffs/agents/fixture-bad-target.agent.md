---
name: fixture-handoff-target-bad
description: "Fixture: trips workflow-handoff-target-001 by handing off to a target with no DAG edge."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "Step 6: Deploy"
    agent: 07b-Bicep Deploy
    prompt: "Deploy the templates. Input: agent-output/{project}/04-implementation-plan.md. Output: agent-output/{project}/06-deployment-summary.md."
    send: true
---

# Bad Target Fixture

Role: jump from a non-existent step to a deploy step (no DAG edge).

# Goal

Trip the target rule.

# Success criteria

- One workflow-handoff-target-001 finding for handoffs[0]

# Constraints

None.

# Output

Used for fixture testing only.

# Stop rules

When the validator emits the expected finding.
