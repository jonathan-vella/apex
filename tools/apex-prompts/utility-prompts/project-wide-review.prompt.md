---
description: "Conduct a phased, dependency-aware review of the entire project. Builds a transient review-index first, then walks every domain in upstream-to-downstream order with explicit blast-radius analysis at each gate."
agent: agent
model: "Claude Opus 4.7"
tools:
  - vscode
  - read
  - search
  - execute
  - agent
  - edit
  - todo
  - "azure-mcp/*"
argument-hint: "Optional: scope to one domain (validators, registries, agents, prompts, skills, instructions, iac, mcp, site, tests) or 'all'"
---

# Project-Wide Dependency-Aware Review

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-workflow-engine/references/project-wide-review.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
