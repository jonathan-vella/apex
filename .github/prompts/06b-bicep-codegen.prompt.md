---
description: "Generate near-production-ready Bicep templates from the implementation plan."
agent: "06b-Bicep CodeGen"
---

# Step 5 — Bicep Code Generation

Generate Bicep templates from the approved implementation plan.

# Goal

Produce near-production-ready Bicep templates under `infra/bicep/{project}/`
that deploy the architecture from the approved implementation plan while
honouring all governance constraints and the security baseline.

# Success criteria

- `infra/bicep/{project}/main.bicep`, `modules/*.bicep`, `main.bicepparam`,
  `azure.yaml`, and `deploy.ps1` exist.
- `bicep lint` and `bicep build` succeed for every file.
- Every resource includes the 4 required tags (`Environment`, `ManagedBy`,
  `Project`, `Owner`).
- AVM modules are used where available; raw resource definitions are justified.
- Adversarial review passes (per complexity matrix) have run; all `must_fix`
  findings applied.
- Session state has Step 5 `status = "complete"`.

# Constraints

- Read `agent-output/{project}/00-session-state.json`; confirm `iac_tool` is
  `Bicep` and Step 4 is `complete`.
- Read `agent-output/{project}/04-implementation-plan.md` (approved plan).
- Read `agent-output/{project}/04-governance-constraints.json` — these
  constraints always win over design preferences.
- Read `.github/skills/azure-bicep-patterns/SKILL.md` for Bicep patterns
  and AVM conventions.
- Read `.github/skills/azure-defaults/SKILL.digest.md` for naming, tags,
  and security baseline.
- Security baseline is non-negotiable: TLS 1.2, HTTPS-only, no public blob
  access, Managed Identity over keys.
- `uniqueSuffix` generated once in `main.bicep` (via
  `uniqueString(resourceGroup().id)`) and passed to all modules.
- `azure.yaml` is the primary deployment method; `deploy.ps1` is a deprecated
  fallback retained for legacy projects.

# Output

- `infra/bicep/{project}/main.bicep`
- `infra/bicep/{project}/modules/*.bicep` (one per resource type)
- `infra/bicep/{project}/main.bicepparam` (Dev environment)
- `infra/bicep/{project}/azure.yaml`
- `infra/bicep/{project}/deploy.ps1` (fallback)
- `agent-output/{project}/05-implementation-reference.md`
- Updated `agent-output/{project}/00-session-state.json`

# Stop rules

- Stop if `iac_tool` is not `Bicep` — route to `06t-Terraform CodeGen` instead.
- Stop if Step 4 is not complete or the implementation plan is missing.
- Stop if `bicep lint` or `bicep build` fails after one self-correction
  attempt; surface the diagnostics for human review.
- Do not advance until every `must_fix` review finding is resolved.
