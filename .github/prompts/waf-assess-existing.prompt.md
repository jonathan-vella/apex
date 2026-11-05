---
description: "Assess an existing Azure workload from IaC, architecture diagrams and optional read-only multi-subscription inventory."
agent: 01-Orchestrator
---

# Assess an existing workload

Coordinate an existing-workload Well-Architected assessment through Requirements and Architect.
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

Deliver requirements, redacted discovery evidence, subscription-attributed observed/recommended SKUs,
an evidence-backed WAF assessment, verified cost estimate when evidence supports one, and a prioritized
remediation roadmap. Label unavailable cost inputs and unresolved controls rather than blocking on
implementation details. Gate 1 approves assessment scope and requirements, not gap closure or compliance.
Preserve independent reviews and human gates. At Gate 2 offer assessment-only pause or continuation
through the existing workflow; neither approval provisions resources or applies remediation.
