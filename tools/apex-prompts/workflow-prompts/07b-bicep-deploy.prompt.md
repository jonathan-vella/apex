---
description: "Deploy Bicep templates to Azure with what-if analysis and deployment validation."
agent: "07b-Bicep Deploy"
argument-hint: "Deploy the Bicep templates for a specific project"
---

# Step 6 — Bicep Deployment

Execute Azure deployment using generated Bicep templates.

# Goal

Provision the Azure resources defined in `infra/bicep/{project}/` to the
target subscription, gated on a what-if preview and explicit user approval,
then capture a deployment summary.

# Success criteria

- `az deployment group what-if` ran cleanly and was reviewed by the user.
- User explicitly approved the apply.
- `azd provision` (or `deploy.ps1` fallback) completed without errors.
- Resource health verified post-deployment.
- `agent-output/{project}/06-deployment-summary.md` exists and lists every
  deployed resource with its status.
- Session state has Step 6 `status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json`; confirm `iac_tool` is
  `Bicep` and Step 5 is `complete`.
- Read `.github/skills/iac-common/SKILL.md` for deploy patterns and known issues.
- Read `.github/skills/iac-common/references/circuit-breaker.md` for failure
  handling.
- Validate Azure CLI authentication first (`az account show`).
- Use `azd provision` as the default deployment method; fall back to
  `deploy.ps1` (deprecated) only for legacy projects without `azure.yaml`.
- Never deploy without explicit user approval after the what-if review.
- If what-if shows policy violations, halt and report — do not attempt to
  override.
- All destructive operations (delete, replace) require separate user
  confirmation.

# Output

- What-if preview presented to the user (terminal output captured)
- `agent-output/{project}/06-deployment-summary.md` with deployed resources,
  outputs, and verification results
- Updated `agent-output/{project}/00-session-state.json`

# Stop rules

- Stop if `az account show` fails — do not proceed without verified auth.
- Stop if what-if reports policy violations or unexpected destructive changes;
  return control to the user.
- Stop if deployment fails after the documented retry window in
  `circuit-breaker.md`; surface the error and do not auto-retry indefinitely.
- Do not mark Step 6 complete until resource health is verified.
