---
description: "Assess the .github folder (agents, skills, instructions, copilot-instructions.md) and produce a prioritized, read-only remediation plan. Plans only — never edits in the same pass."
model: "Claude Opus 5"
agent: agent
tools:
  - read
  - search
  - execute
  - todo
argument-hint: "Optional: scope to one domain (agents | skills | instructions | copilot-instructions | all). Defaults to all."
---

# .github Folder Assessment → Remediation Plan

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-context-management](../../../.github/skills/apex-context-management/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-context-management/references/assess-github-folder.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
