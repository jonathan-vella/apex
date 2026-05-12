---
description: "Generate near-production-ready Terraform configurations from the implementation plan."
agent: "06t-Terraform CodeGen"
---

# Step 5 — Terraform Code Generation

Generate Terraform configurations from the approved implementation plan.

# Goal

Produce near-production-ready Terraform configurations under
`infra/terraform/{project}/` that deploy the architecture from the approved
implementation plan while honouring all governance constraints and the
security baseline.

# Success criteria

- `infra/terraform/{project}/` contains `main.tf`, `variables.tf`,
  `outputs.tf`, `modules/`, `terraform.tfvars`, `backend.tf`,
  `bootstrap.sh`, and `deploy.sh`.
- `terraform fmt -check` and `terraform validate` pass for every module.
- Every resource includes the 4 required tags (`Environment`, `ManagedBy`,
  `Project`, `Owner`).
- AVM-TF modules are used where available; raw resource blocks are justified.
- Adversarial review passes (per complexity matrix) have run; all `must_fix`
  findings applied.
- Session state has Step 5 `status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json`; confirm `iac_tool` is
  `Terraform` and Step 4 is `complete`.
- Read `agent-output/{project}/04-implementation-plan.md` (approved plan).
- Read `agent-output/{project}/04-governance-constraints.json` — these
  constraints always win over design preferences.
- Read `.github/skills/terraform-patterns/SKILL.md` for Terraform patterns
  and AVM-TF conventions.
- Read `.github/skills/azure-defaults/SKILL.md` for naming, tags,
  and security baseline.
- Provider pin: `~> 4.0` (AzureRM). Backend: Azure Storage Account.
- Security baseline is non-negotiable: TLS 1.2, HTTPS-only, no public blob
  access, Managed Identity over keys.
- `random_string` (4 chars, lowercase) generated once and passed to all modules.

# Output

- `infra/terraform/{project}/main.tf` (root module + provider)
- `infra/terraform/{project}/variables.tf` (with validation rules)
- `infra/terraform/{project}/outputs.tf`
- `infra/terraform/{project}/modules/` (one per resource type)
- `infra/terraform/{project}/terraform.tfvars` (Dev environment)
- `infra/terraform/{project}/backend.tf` (Azure Storage backend)
- `infra/terraform/{project}/bootstrap.sh` and `deploy.sh`
- `agent-output/{project}/05-implementation-reference.md`
- Updated `agent-output/{project}/00-session-state.json`

# Stop rules

- Stop if `iac_tool` is not `Terraform` — route to `06b-Bicep CodeGen` instead.
- Stop if Step 4 is not complete or the implementation plan is missing.
- Stop if `terraform fmt -check` or `terraform validate` fails after one
  self-correction attempt; surface the diagnostics for human review.
- Do not advance until every `must_fix` review finding is resolved.
