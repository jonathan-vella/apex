---
description: "Generate the as-built documentation suite from all prior artifacts and deployed state."
agent: "08-As-Built"
---

# Step 7 — As-Built Documentation

Local operational adapter for `08-As-Built`. Read
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
