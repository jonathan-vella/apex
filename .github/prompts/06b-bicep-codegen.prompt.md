---
description: "Generate near-production-ready Bicep templates from the implementation plan."
agent: "06b-Bicep CodeGen"
---

# Step 5 — Bicep Code Generation

Generate Bicep templates from the approved implementation plan.

## Instructions

1. Read `agent-output/{project}/00-session-state.json` to confirm IaC tool is `Bicep` and
   Step 4 is complete.
2. Read `agent-output/{project}/04-implementation-plan.md` for the approved plan.
3. Read `agent-output/{project}/04-governance-constraints.json` for policy constraints.
4. Read `.github/skills/azure-bicep-patterns/SKILL.md` for Bicep patterns and AVM conventions.
5. Read `.github/skills/azure-defaults/SKILL.digest.md` for naming, tags, and security baseline.
6. Generate Bicep templates under `infra/bicep/{project}/`:
   - `main.bicep` — orchestrator with `uniqueString(resourceGroup().id)` suffix.
   - `modules/*.bicep` — one module per resource type, using AVM where available.
   - `main.bicepparam` — parameter file for Dev environment.
   - `deploy.ps1` — deployment script.
7. Run `bicep lint` and `bicep build` to validate all templates.
8. Save implementation reference to `agent-output/{project}/05-implementation-reference.md`.
9. Run adversarial review passes per complexity matrix in session state.
10. Apply all `must_fix` findings and re-validate.
11. Update `agent-output/{project}/00-session-state.json`: mark Step 5 `complete`.

## Constraints

- Every resource must include the 4 required tags (Environment, ManagedBy, Project, Owner).
- Security baseline is non-negotiable: TLS 1.2, HTTPS-only, no public blob access, Managed Identity.
- `uniqueSuffix` is generated once in `main.bicep` and passed to all modules.
- Governance constraints from `04-governance-constraints.json` always win over design preferences.
