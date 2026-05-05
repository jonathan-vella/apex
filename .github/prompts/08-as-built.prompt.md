---
description: "Generate the as-built documentation suite from all prior artifacts and deployed state."
agent: "08-As-Built"
---

# Step 7 — As-Built Documentation

Generate comprehensive workload documentation after successful deployment.

# Goal

Produce the full as-built documentation suite (7 documents + updated project
README) for the deployed workload, grounded in real Azure resource state where
available.

# Success criteria

All seven documents exist in `agent-output/{project}/` and follow the H2
template structure exactly:

- `07-design-document.md`
- `07-operations-runbook.md`
- `07-ab-cost-estimate.md` (as-built cost via Azure Pricing MCP)
- `07-compliance-matrix.md`
- `07-backup-dr-plan.md`
- `07-resource-inventory.md`
- `07-documentation-index.md` (master index)

The project `README.md` is updated with final progress and artifact links.
Session state has Step 7 `status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json`; confirm Step 6 is
  `complete` before proceeding.
- Required prior artifacts: `01-requirements.md`,
  `02-architecture-assessment.md`, `04-implementation-plan.md`,
  `06-deployment-summary.md`. Optional: `03-des-cost-estimate.md`,
  `05-implementation-reference.md`.
- Read `.github/skills/azure-artifacts/references/07-docs-template.md` for
  the H2 template structure.
- Query deployed resource state via `az resource list` for the project
  resource group; use planned values as fallback only when resources are
  not yet deployed.
- All 7 documents are mandatory — do not skip any.
- No challenger review is required for Step 7.

# Output

- `agent-output/{project}/07-*.md` (7 files listed above)
- Updated project `README.md`
- Updated `agent-output/{project}/00-session-state.json`

# Stop rules

- Stop if any required prior artifact is missing — name the file and exit.
- Stop if `az resource list` fails for an undeployed resource group; switch
  to planned-values fallback and note the substitution in each document.
- Stop if the H2 template file is missing — do not invent structure.
