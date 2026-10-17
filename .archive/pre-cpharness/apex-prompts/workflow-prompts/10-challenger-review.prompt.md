---
description: "Run an adversarial review against any agent-output artifact to find gaps and weaknesses."
agent: "10-Challenger"
argument-hint: "Provide the path to the artifact to challenge (e.g. agent-output/my-project/04-implementation-plan.md)"
---

# Adversarial Review

Local operational adapter for `10-Challenger`. Read
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
