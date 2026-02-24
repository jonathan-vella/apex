---
mode: agent
description: Implements Phase 3 — Subagents. Creates terraform-lint-subagent, terraform-review-subagent, and terraform-plan-subagent.
---

# Phase 3 — Subagents

## Prerequisites

Phase 2 must be complete and merged.

## Context Load

1. `docs/tf-support/PROGRESS.md` — confirm Phase 3 is active
2. `.github/agents/_subagents/bicep-lint-subagent.agent.md` — template for 3.18
3. `.github/agents/_subagents/bicep-review-subagent.agent.md` — template for 3.19
4. `.github/agents/_subagents/bicep-whatif-subagent.agent.md` — template for 3.20
5. `.github/instructions/terraform-policy-compliance.instructions.md`

## Item 3.18 — `terraform-lint-subagent.agent.md`

**File**: `.github/agents/_subagents/terraform-lint-subagent.agent.md`

Model on `bicep-lint-subagent.agent.md`. Key differences:

- Runs `terraform fmt -check -recursive` (not `bicep lint`)
- Runs `terraform validate`
- Runs `tfsec .` if available (check with `command -v tfsec`)
- READ-ONLY — never modifies files
- Returns structured PASS/FAIL JSON with same schema as bicep-lint-subagent
- Includes exit codes and remediation hint for each failure

## Item 3.19 — `terraform-review-subagent.agent.md`

**File**: `.github/agents/_subagents/terraform-review-subagent.agent.md`

Model on `bicep-review-subagent.agent.md`. 7-section checklist adapted:

1. **AVM-TF module usage** — all resources use `Azure/avm-res-*/azurerm` modules
2. **CAF naming** — resource names follow CAF conventions, use `random_string` for unique suffix
3. **Required tags** — `Environment`, `ManagedBy = "Terraform"`, `Project`, `Owner` present
4. **Security baseline** — TLS 1.2, HTTPS-only, managed identity, no public access
5. **Unique names** — uses `random_string.suffix` not hardcoded names
6. **Code quality** — `description` on all variables, module organization, `terraform fmt` clean
7. **Governance compliance** — Deny policies satisfied via `azurePropertyPath` translation (read from `04-governance-constraints.json`)

Returns APPROVED / NEEDS_REVISION / FAILED with per-section scores and actionable feedback.

## Item 3.20 — `terraform-plan-subagent.agent.md`

**File**: `.github/agents/_subagents/terraform-plan-subagent.agent.md`

Model on `bicep-whatif-subagent.agent.md`. Key differences:

- Runs `terraform plan -out=tfplan` (equivalent to what-if)
- Parses output for: create count, update count, destroy count, replace count
- Classifies resources into: Create / Update / Destroy / Replace / No-Change
- Highlights any **destroys** or **replaces** — these require explicit approval
- Auth via `az account get-access-token` before running
- Returns structured change summary JSON

## Validation

```bash
npm run lint:agent-frontmatter
```

All 3 new subagent files should pass. Check they appear in the subagents list.

## Commit

```bash
git add .github/agents/_subagents/terraform-lint-subagent.agent.md \
        .github/agents/_subagents/terraform-review-subagent.agent.md \
        .github/agents/_subagents/terraform-plan-subagent.agent.md
git commit -m "feat(agents): add Terraform lint, review, and plan subagents

- terraform-lint-subagent: fmt-check + validate + tfsec, PASS/FAIL output
- terraform-review-subagent: 7-section checklist, azurePropertyPath compliance
- terraform-plan-subagent: plan parse, create/update/destroy/replace classification"
```

## Update PROGRESS.md

Check off `3.18`, `3.19`, `3.20`. Phase 3 → `✅ Complete`, `active_phase: 4`. Commit.
