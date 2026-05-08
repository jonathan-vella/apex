---
name: fixture-good-claude
description: "Good Claude agent fixture — should produce no vendor-prompting findings. Used by tools/tests/vendor-prompting/run.test.mjs."
model: ["Claude Opus 4.7"]
user-invocable: true
agents: []
tools: [read]
handoffs:
  - label: "▶ Self"
    agent: fixture-good-claude
    prompt: "Re-read agent-output/{project}/01-requirements.md and update. Output: 02-architecture-assessment.md."
    send: true
---

# Good Claude Agent Fixture

<investigate_before_answering>
Read all source files before responding. Cite line numbers.
</investigate_before_answering>

<output_contract>
Produce a markdown report saved to `agent-output/{project}/02-architecture-assessment.md`.
</output_contract>

Role: research Azure architecture decisions for the requirements above.

This agent simulates a compliant Claude research agent. It should pass:

- legacy-004 (has investigate block)
- claude-output-contract-001 (has output_contract; handoff references agent-output/)
- claude-no-prefill-001 (no prefill instructions)
- handoff-enrichment-001 (handoff has both Input + Output references)
