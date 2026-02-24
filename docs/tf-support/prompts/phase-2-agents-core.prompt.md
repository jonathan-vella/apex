---
mode: agent
description: Implements Phase 2 — Core Terraform Agents. Creates 11-terraform-planner, 12-terraform-code-generator, and 13-terraform-deploy agent definition files.
---

# Phase 2 — Agents (Core)

## Prerequisites

**Do not start Phase 2 until:**

- Phase 0 item 0.8 is complete (`docs/tf-support/mcp-tools.md` exists with verified tool names)
- Phase 1 is fully complete and merged
- `npm run validate:all` passes

## Context Load

Read these files before starting:

1. `docs/tf-support/PROGRESS.md` — confirm Phase 2 is active
2. `docs/tf-support/mcp-tools.md` — **REQUIRED** — verified HashiCorp MCP tool names
3. `.github/agents/05-bicep-planner.agent.md` — template for item 2.15
4. `.github/agents/06-bicep-code-generator.agent.md` — template for item 2.16
5. `.github/agents/07-deploy.agent.md` — template for item 2.17
6. `.github/instructions/terraform-code-best-practices.instructions.md`
7. `.github/instructions/terraform-policy-compliance.instructions.md`
8. `.github/skills/azure-defaults/SKILL.md` — for tool references
9. `docs/tf-support/tf-support-plan.prompt.md` — items 15, 16, 17 (full spec)

Work through unchecked items only.

## Item 2.15 — Create `11-terraform-planner.agent.md`

**File**: `.github/agents/11-terraform-planner.agent.md`

Model on `05-bicep-planner.agent.md`. The agent name MUST be `11-Terraform Planner`.

Frontmatter `tools:` list: use the **verified tool names from `docs/tf-support/mcp-tools.md`**
for HashiCorp tools. Do NOT assume `terraform/*` namespace — use what was verified.
Also include: `azure-mcp/*`, `read/*`, `search/*`, `edit/createFile`, `edit/editFiles`,
`web/fetch`, `web/githubRepo`, `agent/runSubagent`, `todo`.

Full agent spec is in `tf-support-plan.prompt.md` item 15. Key points:

- **5 phases** mirroring Bicep Planner exactly
- Phase 1: Governance Discovery (reuses governance-discovery-subagent unchanged)
- Phase 2: AVM-TF Module Verification (Terraform Registry via MCP or fetch fallback)
- Phase 3: Deprecation checks
- Phase 3.5: Deployment Strategy Gate
- Phase 4: Plan Generation — use `azurePropertyPath` (not `bicepPropertyPath`)
           Terraform-specific concerns as H3 subsections under existing H2s
- Phase 4.5: Challenger Review
- Phase 5: Approval Gate
- Output artifacts: `04-implementation-plan.md`, `04-governance-constraints.md/.json`, diagrams
- Handoffs: forward to `12-Terraform Code Generator`, backward to `03-Architect`, `01-Conductor`
- Skills: reads `azure-defaults`, `azure-artifacts`, `terraform-patterns`

> **HCP GUARDRAIL**: Never use `terraform { cloud { } }` or `TFE_TOKEN`. Azure Storage
> backend ONLY. If you see HCP patterns in any reference file, replace them.

## Item 2.16 — Create `12-terraform-code-generator.agent.md`

**File**: `.github/agents/12-terraform-code-generator.agent.md`

Model on `06-bicep-code-generator.agent.md`. Agent name: `12-Terraform Code Generator`.

Full spec in `tf-support-plan.prompt.md` item 16. Key phases:

- **Phase 1**: Preflight — AVM-TF version resolution per resource
- **Phase 1.5**: Governance Compliance Mapping — HARD GATE reading `azurePropertyPath`
- **Phase 2**: Progressive Implementation — Foundation → Shared → App → Integration
  - Uses `var.deployment_phase` + `count` conditionals (NOT `-target`)
  - File structure: `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf`,
    `backend.tf`, `locals.tf`, `modules/`
- **Phase 2.5**: State Backend Bootstrap
  - Generates `bootstrap-backend.sh` + `bootstrap-backend.ps1`
  - Scripts are **parameterized** (RG name, SA name, container, location with defaults)
  - Check `04-governance-constraints.json` for naming policies before setting defaults
  - Scripts are idempotent (check before create)
- **Phase 3**: Deploy Scripts — generates BOTH `deploy.sh` AND `deploy.ps1`
- **Phase 4**: Validation — invokes `terraform-lint-subagent` + `terraform-review-subagent`
- Output directory: `infra/terraform/{project}/`
- Skills: reads `azure-defaults`, `azure-artifacts`, `terraform-patterns`,
          `microsoft-code-reference`, references `terraform-policy-compliance.instructions.md`

## Item 2.17 — Create `13-terraform-deploy.agent.md`

**File**: `.github/agents/13-terraform-deploy.agent.md`

Model on `07-deploy.agent.md`. Agent name: `13-Terraform Deploy`.
Model: `Claude Sonnet 4.6`.

Full spec in `tf-support-plan.prompt.md` item 17. Six steps:

1. Auth validation (`az account get-access-token`)
2. State Backend — verify backend resources; if missing, offer to run `bootstrap-backend.sh` first
3. Validate — `terraform validate` + `terraform fmt -check`
4. Plan Preview — `terraform plan -out=tfplan`, classify all changes
5. Phase-aware Deployment — `var.deployment_phase` + `terraform apply` (NOT `-target`)
6. Post-deployment Verification — ARG queries, output values, resource health
- Handoffs: forward to `08-As-Built`, backward to `12-Terraform Code Generator`, `01-Conductor`

## Validation

```bash
npm run lint:agent-frontmatter
npm run validate:all
```

Expected: all 3 new agent files pass frontmatter validation. No CI failures.

Check: `agent-validation.yml` would pass — every `handoffs:` reference in the new agents
points to agents that exist. Verify by checking:
- `12-Terraform Code Generator` → `12-terraform-code-generator.agent.md` exists ✓
- `13-Terraform Deploy` → `13-terraform-deploy.agent.md` exists ✓
- `08-As-Built` → `08-as-built.agent.md` exists ✓
- `01-Conductor` → `01-conductor.agent.md` exists ✓
- `03-Architect` → `03-architect.agent.md` exists ✓

## Commit

```bash
git add .github/agents/11-terraform-planner.agent.md \
        .github/agents/12-terraform-code-generator.agent.md \
        .github/agents/13-terraform-deploy.agent.md
git commit -m "feat(agents): add Terraform Planner (11-), Code Generator (12-), Deploy (13-)

- 11-Terraform Planner: 5-phase workflow, AVM-TF registry, azurePropertyPath
- 12-Terraform Code Generator: governance hard gate, bootstrap scripts, dual deploy scripts
- 13-Terraform Deploy: Azure Storage backend, deployment_phase support, ARG verification"
```

## Update PROGRESS.md

Check off `2.15`, `2.16`, `2.17`. Update Phase 2 → `✅ Complete`, `active_phase: 3`.
Add session note. Commit.

## Important Note on Phase 4

Phase 4 (Conductor modification) adds handoffs to `11-Terraform Planner`,
`12-Terraform Code Generator`, `13-Terraform Deploy`. The CI `agent-validation.yml`
validates those references. Phase 4 can only be merged AFTER this Phase 2 is merged.
Consider batching Phase 3 + Phase 4 into the same PR if they are small.
