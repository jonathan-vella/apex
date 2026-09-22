---
description: "Generate near-production-ready Bicep templates from the implementation plan."
agent: "06b-Bicep CodeGen"
---

# Step 5 — Bicep Code Generation

Local operational adapter for `06b-Bicep CodeGen`. Read
[apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md),
then follow the [shared entry contract][entry] for this named owner.

Pass the supplied project, scope, and revision request unchanged. Require the
owner and its configured model; stop if unavailable. Do not widen its tools or
run the operation under a different agent. Validate current required inputs
and graph prerequisites before work; preserve reviews and human approvals.

Return the canonical output artifacts, actual check results, and any blockers.
The owner body and workflow graph control execution, completion, and handoffs.
Agent Host uses the distinct /apex-host-workflow-start skill after manual owner
selection; this Local file does not bind a Host session.

[entry]: ../../../.github/skills/apex-workflow-engine/references/workflow-entry.md
