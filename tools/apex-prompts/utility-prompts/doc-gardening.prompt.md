---
description: "Scan for stale docs, instruction drift, quality score degradation, and tech debt. Updates QUALITY_SCORE.md and tech-debt-tracker.md."
agent: agent
model: "Claude Opus 4.7"
tools: [vscode, execute, read, agent, browser, edit, search, web, azure-mcp/search, todo]
---

# Doc Gardening

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-workflow-engine/references/doc-gardening.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
