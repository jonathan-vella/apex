---
description: "Generate near-production-ready Terraform configurations from the implementation plan."
agent: "06t-Terraform CodeGen"
---

# Step 5 — Terraform Code Generation

Generate Terraform configurations from the approved implementation plan.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm IaC tool is `Terraform` and
   Step 4 is complete.
2. Read `agent-output/{project}/04-implementation-plan.md` for the approved plan.
3. Read `agent-output/{project}/04-governance-constraints.json` for policy constraints.
4. Read `.github/skills/terraform-patterns/SKILL.md` for Terraform patterns and AVM-TF conventions.
5. Read `.github/skills/azure-defaults/SKILL.digest.md` for naming, tags, and security baseline.
6. Generate Terraform configurations under `infra/terraform/{project}/`:
   - `main.tf` — root module with provider configuration.
   - `variables.tf` — input variables with validation rules.
   - `outputs.tf` — key resource outputs.
   - `modules/` — one module per resource type, using AVM-TF where available.
   - `terraform.tfvars` — variable values for Dev environment.
   - `backend.tf` — Azure Storage backend configuration.
   - `bootstrap.sh` and `deploy.sh` — deployment scripts.
7. Run `terraform fmt -check` and `terraform validate` on all configurations.
8. Save implementation reference to `agent-output/{project}/05-implementation-reference.md`.
9. Run adversarial review passes per complexity matrix in session state.
10. Apply all `must_fix` findings and re-validate.
11. Update `agent-output/{project}/00-session-state.json`: mark Step 5 `complete`.

## Constraints

- Provider pin: `~> 4.0` (AzureRM). Backend: Azure Storage Account.
- Every resource must include the 4 required tags (Environment, ManagedBy, Project, Owner).
- Security baseline is non-negotiable: TLS 1.2, HTTPS-only, no public blob access, Managed Identity.
- `random_string` (4 chars, lowercase) generated once and passed to all modules.
- Governance constraints from `04-governance-constraints.json` always win over design preferences.
