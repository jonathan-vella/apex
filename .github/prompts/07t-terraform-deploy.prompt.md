---
description: "Deploy Terraform configurations to Azure with plan preview and phased execution."
agent: "07t-Terraform Deploy"
argument-hint: "Deploy the Terraform configuration for a specific project"
---

# Step 6 — Terraform Deployment

Execute Azure deployment using generated Terraform configurations.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm IaC tool is `Terraform` and
   Step 5 is complete.
2. Read `.github/skills/iac-common/SKILL.md` for deploy patterns and known issues.
3. Validate Azure CLI authentication: `az account show`.
4. Run `terraform init` in `infra/terraform/{project}/`.
5. Run `terraform plan -out=tfplan` and present the plan to the user.
6. Wait for explicit user approval before applying.
7. Execute `terraform apply tfplan`.
8. Verify resource health post-deployment.
9. Save deployment summary to `agent-output/{project}/06-deployment-summary.md`.
10. Update `agent-output/{project}/00-session-state.json`: mark Step 6 `complete`.

## Constraints

- NEVER apply without explicit user approval after plan review.
- If plan shows policy violations, halt and report — do not attempt to override.
- All destructive operations (destroy, replace) require separate user confirmation.
- Read `.github/skills/iac-common/references/circuit-breaker.md` for failure handling.
