---
description: "Score every agent (main + subagents) across the four assessment layers — deterministic L1/L2 via the assess-agents harness, judgment L2 role clarity + L4 adversarial via Explore fan-out, optional L3 runtime from a debug-log profile. Produces per-agent scorecards + a ranked fleet plan. Plans only — never edits an agent in the same pass."
model: "Claude Opus 5"
agent: agent
tools:
  - read
  - search
  - execute
  - agent
  - todo
argument-hint: "Optional: a scope filter (main | subagents | all) and/or --profile=<debug-log.json> for L3. Defaults to all, L3 = N/A."
---

# 4-Layer Per-Agent Assessment → Fleet Plan

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-context-management](../../../.github/skills/apex-context-management/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-context-management/references/assess-agents.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
