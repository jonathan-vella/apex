---
description: "Generate the as-built documentation suite from all prior artifacts and deployed state."
agent: "08-As-Built"
---

# Step 7 — As-Built Documentation

Generate comprehensive workload documentation after successful deployment.

## Prerequisites

Before running, confirm these artifacts exist in `agent-output/{project}/`:

- `01-requirements.md` — Original requirements (required)
- `02-architecture-assessment.md` — WAF assessment (required)
- `04-implementation-plan.md` — Planned architecture (required)
- `06-deployment-summary.md` — Deployment results (required)
- `03-des-cost-estimate.md` — Original cost estimate (optional)
- `05-implementation-reference.md` — IaC validation results (optional)

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm Step 6 is complete.
2. Read all prior artifacts (Steps 1-6) from `agent-output/{project}/`.
3. Read `.github/skills/azure-artifacts/references/07-docs-template.md` for the documentation
   template structure.
4. Query deployed resource state via `az resource list` for the project resource group.
5. Generate the following documents in `agent-output/{project}/`:
   - `07-design-document.md` — comprehensive design document.
   - `07-operations-runbook.md` — day-2 operational procedures.
   - `07-ab-cost-estimate.md` — as-built cost estimate (use Azure Pricing MCP).
   - `07-compliance-matrix.md` — compliance control mapping.
   - `07-backup-dr-plan.md` — backup and disaster recovery plan.
   - `07-resource-inventory.md` — complete resource inventory.
   - `07-documentation-index.md` — master documentation index.
6. Update the project `README.md` with final progress and artifact links.
7. Update `agent-output/{project}/00-session-state.json`: mark Step 7 `complete`.

## Constraints

- All 7 documents are mandatory — do not skip any.
- Follow the H2 structure from templates exactly.
- Use real deployed resource data where available; fall back to planned values if not deployed.
- No challenger review is required for Step 7.
