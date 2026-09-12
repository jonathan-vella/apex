---
description: "Review all published docs for accuracy, UX, and contradictions using three independent reviewers, then consolidate into an actionable triage report."
agent: agent
model: "Claude Opus 4.7"
tools:
  - vscode
  - read
  - search
  - execute
  - agent
  - web
  - "azure-mcp/*"
argument-hint: "Optional: scope to a specific docs section (e.g., 'how-it-works only')"
---

# Docs Peer Review

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the
[canonical procedure](../../../.github/skills/apex-workflow-engine/references/plan-docs-peer-review.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
