---
description: "Assess an existing Azure workload from IaC, architecture diagrams and optional read-only multi-subscription inventory."
agent: 01-Orchestrator
---

# Assess an existing workload

Coordinate a standalone existing-workload Well-Architected assessment, not an infrastructure delivery run.
Load [standalone assessment](../skills/apex-workflow-engine/references/standalone-assessment.md).
Select `workflow_mode=assessment` explicitly with an authorized upfront scope.
Offer evidence-only (no business interview) or requirements-led discovery; source is IaC, Azure or combined.
Do not require `01-requirements.md` or a numeric Step 1 approval for evidence-only work.
Use supplied IaC, architecture diagrams and explicitly authorized tenant/subscription read scope.
Load `.github/skills/apex-azure-defaults/references/existing-workload-intake.md` at evidence intake.
Treat this as assessment-only, not implementation planning. Reuse captured answers and ask only when
assessment scope, read authorization, or business intent is genuinely ambiguous. Do not require future
service/SKU choices, budget-cap classification, cost-alert recipients, performance targets, or other
implementation preferences to begin or complete the assessment. Record unavailable targets and controls
as explicit unknowns/evidence gaps; do not infer answers, compliance, remediation ability, or approval.

Follow [input request provenance](../skills/apex-workflow-engine/references/practical-workflow.md#input-request-provenance):
persist the discovery helper's APEX-local `request_id` before displaying only its native `form`,
then retain the actual response receipt and record confirmed material inputs through `apex-recall`.
Do not require `ask_user` to return an SDK request ID. Recover already-captured answers with a labelled,
source-linked local receipt instead of inventing native IDs or repeating settled questions.
Capture receipts do not replace independent reviews, human gates or Azure authorization.

Deliver a WAF report, required architecture diagram and Cost Management report as one bundle.
For Azure report actual spend, trends and available forecast; for IaC report labelled estimates.
Missing cost evidence is not zero. Keep a prioritized nonbinding roadmap and explicit coverage gaps.
Run internal owner handoffs and both independent WAF/cost-quality reviews automatically within granted scope.
There is one final bundle acceptance, not intermediate Requirements/Architecture/Design approval gates.
Gate 1 approves assessment scope and requirements only in existing legacy delivery projects; do not
silently rewrite their histories. New standalone assessments end after final acceptance with no formal
Governance, policy-feasibility prerequisite, IaC planning or deployment continuation.
