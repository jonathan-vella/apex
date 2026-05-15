---
description: "Deploy Terraform configurations to Azure with plan preview and phased execution."
agent: "07t-Terraform Deploy"
argument-hint: "Deploy the Terraform configuration for a specific project"
---

# Step 6 — Terraform Deployment

Execute Azure deployment using generated Terraform configurations.

# Goal

Provision the Azure resources defined in `infra/terraform/{project}/` to the
target subscription, gated on a `terraform plan` preview and explicit user
approval, then capture a deployment summary.

# Success criteria

- `terraform init` succeeded with the configured backend.
- `terraform plan -out=tfplan` ran cleanly and was reviewed by the user.
- User explicitly approved the apply.
- `terraform apply tfplan` completed without errors.
- Resource health verified post-deployment.
- `agent-output/{project}/06-deployment-summary.md` exists and lists every
  deployed resource with its status.
- Session state has Step 6 `status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json`; confirm `iac_tool` is
  `Terraform` and Step 5 is `complete`.
- Read `.github/skills/iac-common/SKILL.md` for deploy patterns and known issues.
- Read `.github/skills/iac-common/references/circuit-breaker.md` for failure
  handling.
- Validate Azure CLI authentication first (`az account show`).
- Never apply without explicit user approval after the plan review.
- If plan shows policy violations, halt and report — do not attempt to
  override.
- All destructive operations (destroy, replace) require separate user
  confirmation.

# Output

- `terraform plan` output captured for the user
- `infra/terraform/{project}/tfplan` (binary plan file applied)
- `agent-output/{project}/06-deployment-summary.md` with deployed resources,
  outputs, and verification results
- Updated `agent-output/{project}/00-session-state.json`

# Stop rules

- Stop if `az account show` fails — do not proceed without verified auth.
- Stop if `terraform init` cannot reach the backend; surface the error.
- Stop if plan shows policy violations or unexpected destructive changes;
  return control to the user.
- Stop if apply fails after the documented retry window in
  `circuit-breaker.md`; surface the error and do not auto-retry indefinitely.
- Do not mark Step 6 complete until resource health is verified.
