---
name: review-imported-iac
agent: agent
# Migrated 2026-07 to GPT-5.6-Terra. The outcome-first skeleton remains in
# place from the 2026-05 vendor-prompting alignment sweep; the
# vendor-prompting prompt-alignment sweep; procedural detail preserved below.
model: "GPT-5.6-Terra"
description: "Ingest pasted or existing Bicep or Terraform, normalize it into the repo, run static review plus AVM and governance checks, and generate WAF review artifacts."
argument-hint: "Paste or select IaC, or provide a workspace path plus a project name"
---

# Review Imported IaC

Local operational adapter. Preserve this prompt's agent, model, and tool routing.
Read [apex-workflow-engine](../../../.github/skills/apex-workflow-engine/SKILL.md), then
follow the [canonical procedure](../../../.github/skills/apex-workflow-engine/references/review-imported-iac.md).

Pass supplied inputs, scope, and options unchanged. Preserve the procedure's
required inputs, activities, output paths, approval gates, and bounded failures.
A reference grants no tools or model changes. Stop on unavailable prerequisites;
never silently inherit a different model, widen access, or invent success.
