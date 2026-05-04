---
name: fixture-good-gpt55
description: "Good GPT-5.5 agent fixture — should produce no vendor-prompting findings."
model: ["GPT-5.5"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self"
    agent: fixture-good-gpt55
    prompt: "Read agent-output/{project}/04-implementation-plan.md. Output: 06-deployment-summary.md."
    send: true
---

# Good GPT-5.5 Agent Fixture

Role: deploy infrastructure based on the plan above.

# Goal

Apply the implementation plan to the target Azure subscription.

# Success criteria

- All resources from the plan exist in the target subscription
- All policy assignments evaluated successfully
- Deployment summary written to the artifact path

# Constraints

Use the smallest set of az commands needed. Halt on policy denials.

# Output

A deployment summary markdown file at the artifact path.

# Stop rules

Stop when every resource is deployed or when a policy denial blocks
forward progress.
