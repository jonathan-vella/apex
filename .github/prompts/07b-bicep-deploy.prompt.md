---
description: "Deploy Bicep templates to Azure with what-if analysis and deployment validation."
agent: "07b-Bicep Deploy"
argument-hint: "Deploy the Bicep templates for a specific project"
---

# Step 6 — Bicep Deployment

Execute Azure deployment using generated Bicep templates.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm IaC tool is `Bicep` and
   Step 5 is complete.
2. Read `.github/skills/iac-common/SKILL.md` for deploy patterns and known issues.
3. Validate Azure CLI authentication: `az account show`.
4. Run what-if analysis: `az deployment group what-if` using the parameter file.
5. Present the what-if results to the user and wait for explicit approval before deploying.
6. Execute deployment via `deploy.ps1` in `infra/bicep/{project}/`.
7. Verify resource health post-deployment.
8. Save deployment summary to `agent-output/{project}/06-deployment-summary.md`.
9. Update `agent-output/{project}/00-session-state.json`: mark Step 6 `complete`.

## Constraints

- NEVER deploy without explicit user approval after what-if review.
- If what-if shows policy violations, halt and report — do not attempt to override.
- All destructive operations (delete, replace) require separate user confirmation.
- Read `.github/skills/iac-common/references/circuit-breaker.md` for failure handling.
