# Plan: Add Terraform Support to Agentic InfraOps

**TL;DR** — Extend the 7-step workflow to support Terraform as a first-class IaC option alongside Bicep. This creates 3 new Terraform agents (Planner `11-`, Code Gen `12-`, Deploy `13-`), 3 new subagents (lint, review, plan-preview), supporting skills/instructions/hooks, and modifies the Conductor + Requirements agents to offer IaC selection. Azure Storage backend for state management. HashiCorp Terraform MCP Server (npx-based, pre-installed as devDependency) for registry integration. Governance uses a dual-field approach — the governance-discovery-subagent produces both `bicepPropertyPath` AND `azurePropertyPath` in `04-governance-constraints.json` so both Bicep and Terraform code generators can consume their native field. IaC preference is captured once in Requirements and auto-routed by the Conductor — no re-asking. All existing Bicep quality gates, governance enforcement, and CI/CD patterns are replicated for Terraform. Issue #85 is updated with refined scope and broken into focused child issues.

> **Challenger findings applied**: All 14 findings from v1 challenge (`agent-output/terraform-support/challenge-findings.json`) and all 6 findings from v2 challenge (`agent-output/terraform-support/challenge-findings-v2.json`) have been incorporated into this plan revision.

**Steps**

> [!IMPORTANT]
> **Phase merge ordering**: Phases MUST be merged in sequential order. The CI `agent-validation.yml` workflow validates handoff references — modifying the Conductor (Phase 4) to reference Terraform agents requires those agents (Phase 2) to already exist in the branch. Similarly, Phase 5 quality gates reference artifacts from Phases 1-2. Merge as: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 (deferrable) → Phase 7. Alternatively, batch Phase 2 + Phase 4 into a single PR to avoid intermediate validation failures. _(V2 Finding #5)_

## Phase 0 — Branch & Foundation

1. Create branch `tf-dev` from `main`
2. Update `.devcontainer/devcontainer.json` — add Terraform feature (`ghcr.io/devcontainers/features/terraform:1` with `installTFsec: true`), add Go feature for future Terratest, set `TF_PLUGIN_CACHE_DIR` env var, add `[terraform]` editor settings (tabSize: 2, formatOnSave)
3. Update `.devcontainer/devcontainer.json` extensions — add `HashiCorp.terraform`, `ms-azuretools.vscode-azureterraform`
4. Update `.gitignore` — add `*.tfstate`, `*.tfstate.backup`, `.terraform/`, `*.tfvars` (not `terraform.tfvars.example`), `crash.log`, `.infracost/`. **Do NOT gitignore `.terraform.lock.hcl`** — per HashiCorp best practice, the lock file MUST be committed for reproducible provider versions. Only the `.terraform/` plugin cache directory is gitignored. _(Finding #14)_
5. Update `.gitattributes` — add `*.tf`, `*.tfvars`, `*.hcl` linguist detection
6. Add HashiCorp Terraform MCP Server to `.vscode/mcp.json` — **npx-based** using `npx @hashicorp/terraform-mcp-server` (NOT Docker). This avoids requiring Docker-in-Docker in the devcontainer, which is not currently configured. **Pre-install `@hashicorp/terraform-mcp-server` as a devDependency** in `package.json` so `npx` resolves locally with zero startup latency — avoids re-download on VS Code restart or devcontainer rebuild. _(Finding #5, V2 Finding #4)_
7. Create directory `infra/terraform/` with a `.gitkeep`
8. **[NEW] Verify MCP tool names** — After adding the HashiCorp MCP server and restarting VS Code, enumerate the actual tool names it exposes using `tool_search_tool_regex` with pattern `terraform|hashicorp`. Document the discovered tool names (e.g., whether they are `terraform/get_module_details` or `mcp_terraform_get_module_details` or another convention). These verified names will be used in all agent frontmatter `tools:` lists in Phase 2. **If the MCP server does not expose module lookup tools**, fall back to web/fetch against the Terraform Registry API (`registry.terraform.io/v1/modules/Azure/{module}/azurerm/versions`) as the AVM verification mechanism. _(Finding #1)_

## Phase 1 — Instructions, Skills & Dual-Field Governance

9. **[MOVED from Phase 6] Update `.github/instructions/governance-discovery.instructions.md`** — extend `applyTo` to include `**/*.tf` alongside existing `**/*.bicep`. This is a **prerequisite** for Phase 2 agents, not a documentation task. The governance-discovery-subagent must trigger for Terraform files before the Terraform Planner is created. _(Finding #9)_

10. **[NEW — Phase 6 split] Update `governance-discovery-subagent` for dual-field output** — Modify the governance-discovery-subagent to produce **BOTH** `bicepPropertyPath` AND `azurePropertyPath` in `04-governance-constraints.json` entries. During the transition period, existing Bicep agents continue reading `bicepPropertyPath` (unchanged), while new Terraform agents read `azurePropertyPath`. The `azurePropertyPath` uses IaC-agnostic Azure resource property paths (e.g., `storageAccount.properties.minimumTlsVersion`). Each IaC code generator translates `azurePropertyPath` to its native path. This dual-field approach avoids breaking existing Bicep agents when Terraform support is added and eliminates the dependency inversion where Phase 2 agents would reference a field not yet produced. _(Finding #2, V2 Finding #1)_

11. Create `.github/instructions/terraform-code-best-practices.instructions.md` (`applyTo: **/*.tf`) — adapted from `bicep-code-best-practices.instructions.md` but with Terraform conventions: provider config standards (azurerm features block, version pinning), AVM-TF-first mandate (`source = "Azure/avm-res-{service}-{resource}/azurerm"`), module structure (`main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf`, `locals.tf`), naming conventions (CAF), `ManagedBy = "Terraform"` tag, security defaults (TLS 1.2, HTTPS-only, managed identity), Azure Storage state backend pattern. Draws from all 5 tf-support reference files in `docs/tf-support/`.

12. Create `.github/instructions/terraform-policy-compliance.instructions.md` (`applyTo: **/*.tf, **/*.agent.md`) — adapted from `bicep-policy-compliance.instructions.md`. Same "Azure Policy always wins" mandate but maps Deny policies to `azurerm` resource property paths using the **IaC-agnostic `azurePropertyPath`** from `04-governance-constraints.json`. Each IaC code generator is responsible for translating `azurePropertyPath` (e.g., `storageAccount.properties.minimumTlsVersion`) to its native path format (Bicep: `resource.properties.minimumTlsVersion`, Terraform: `azurerm_storage_account.min_tls_version`). _(Finding #2)_

13. Create `.github/skills/terraform-patterns/SKILL.md` — adapted from `azure-bicep-patterns/SKILL.md`. Same 7 patterns (Hub-Spoke, Private Endpoints, Diagnostics, Conditional Deployment, Module Composition, Managed Identity, Plan Interpretation) but in HCL. Uses AVM-TF modules, `for_each`/`count` for conditionals, `random_string` for unique suffixes. **Includes a "Terraform AVM Known Pitfalls" section** covering: Set-type attribute ordering diffs (from `docs/tf-support/SKILL.md` AzureRM Set Diff Analyzer), provider version constraint gotchas, `ignore_changes` lifecycle patterns for false-positive diffs, and common AzureRM provider breaking changes. _(Finding #11)_

14. Update `azure-defaults/SKILL.md` — add a `## Terraform Conventions` section covering: AVM-TF registry lookup pattern (`registry.terraform.io/modules/Azure/{module}/azurerm/latest`), tag syntax in HCL, `ManagedBy = "Terraform"`, `terraform fmt` / `terraform validate` commands, Azure Storage state backend pattern, `random_string` instead of `uniqueString()`. **Include a "Common AVM-TF Modules" table** mapping the same 16 resources from the Bicep AVM table to their Terraform Registry equivalents (e.g., Key Vault → `Azure/avm-res-keyvault-vault/azurerm`, Storage Account → `Azure/avm-res-storage-storageaccount/azurerm`). _(Finding #10)_

## Phase 2 — Agents (Core)

> **IMPORTANT — HCP Terraform guardrail**: The reference files in `docs/tf-support/` (especially `terraform.agent.md`) use HCP Terraform Cloud patterns (`terraform { cloud { } }`, `TFE_TOKEN`). These patterns **MUST NOT** leak into the Azure-focused agents. All backend configuration MUST use Azure Storage Account patterns. When drawing from tf-support references, systematically replace HCP patterns with Azure Storage backend equivalents. Include the correct Azure Storage backend template: _(Finding #13)_
>
> ```hcl
> terraform {
>   backend "azurerm" {
>     resource_group_name  = "rg-tfstate"
>     storage_account_name = "sttfstate{unique}"
>     container_name       = "tfstate"
>     key                  = "{project}.terraform.tfstate"
>   }
> }
> ```
>
> These are **default values** — the bootstrap scripts accept custom names as parameters to comply with governance naming policies. _(V2 Finding #6)_

15. Create `.github/agents/11-terraform-planner.agent.md` — modeled on `05-bicep-planner.agent.md` with identical phased workflow. **Numbered `11-`** to avoid prefix collision with Bicep agents (`05-`, `06-`, `07-`). _(Finding #6)_
    - **Frontmatter**: `name: 11-Terraform Planner`, `model: Claude Opus 4.6`, `agents: ["governance-discovery-subagent", "10-Challenger"]`, tools include `azure-mcp/*` + **verified MCP tool names from Phase 0 step 8** (NOT assumed `terraform/*` namespace). If MCP tools are unavailable, use `#fetch` against Terraform Registry API as fallback. _(Finding #1)_
    - **Phase 1**: Governance Discovery — reuses `governance-discovery-subagent` unchanged (IaC-agnostic)
    - **Phase 2**: AVM-TF Module Verification — queries Terraform Registry via **verified MCP tools** or via fetch to `registry.terraform.io/v1/modules/Azure/{module}/azurerm/versions` as fallback _(Finding #1)_
    - **Phase 3**: Deprecation checks for non-AVM resources
    - **Phase 3.5**: Deployment Strategy Gate (phased vs single) — identical UX
    - **Phase 4**: Plan Generation — YAML resource specs use `avmModule: registry.terraform.io/Azure/avm-res-...` format, **`azurePropertyPath`** (IaC-agnostic) instead of `bicepPropertyPath` or `terraformPropertyPath` _(Finding #2)_. Terraform-specific concerns (state backend, provider pinning, workspace strategy) are documented as **H3 subsections under existing H2 headings** to pass artifact template validation. _(Finding #7)_
    - **Phase 4.5**: Challenger Review — identical
    - **Phase 5**: Approval Gate — identical
    - **Skills**: reads `azure-defaults`, `azure-artifacts`, `terraform-patterns` (new)
    - **Output**: same artifacts (`04-implementation-plan.md`, `04-governance-constraints.md/.json`, diagrams)
    - **Handoffs**: forward to `12-Terraform Code Generator`, backward to `03-Architect` and `01-Conductor`

16. Create `.github/agents/12-terraform-code-generator.agent.md` — modeled on `06-bicep-code-generator.agent.md`. **Numbered `12-`**. _(Finding #6)_
    - **Frontmatter**: `name: 12-Terraform Code Generator`, `model: ["Claude Opus 4.6", "Claude Sonnet 4.6"]`, `agents: ["terraform-lint-subagent", "terraform-review-subagent"]`
    - **Phase 1**: Preflight Check — **verified MCP tools** or Registry API fetch per resource, version resolution _(Finding #1)_
    - **Phase 1.5**: Governance Compliance Mapping — reads `04-governance-constraints.json`, reads **`azurePropertyPath`** field and translates each to the Terraform `azurerm` resource property equivalent (e.g., `storageAccount.properties.minimumTlsVersion` → `azurerm_storage_account.min_tls_version`). Translation mapping is documented in `terraform-policy-compliance.instructions.md`. **Same HARD GATE**. _(Finding #2)_
    - **Phase 2**: Progressive Implementation — Foundation (`providers.tf`, `versions.tf`, `backend.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `locals.tf`) → Shared → App → Integration. **Phase-aware deployment uses `var.deployment_phase` with conditional resource creation** (`count = var.deployment_phase >= 2 ? 1 : 0`) — NOT `terraform apply -target` which is a Terraform anti-pattern. Separate root modules per phase with shared state data sources are an alternative for complex projects. _(Finding #12)_
    - **Phase 2.5 [NEW]**: State Backend Bootstrap — generates `infra/terraform/{project}/bootstrap-backend.sh` (and `bootstrap-backend.ps1` for Windows) that creates the Azure Storage Account, resource group, and container for the state backend. Uses `az` CLI commands. **Scripts are parameterized** — accept resource group name, storage account name, container name, and location as arguments with sensible defaults. The Code Generator checks `04-governance-constraints.json` for naming policies before generating default names. Scripts are idempotent (check if resources exist before creating). _(Finding #4, V2 Finding #6)_
    - **Phase 3**: Deploy Script — generates **BOTH** `infra/terraform/{project}/deploy.sh` (bash) AND `infra/terraform/{project}/deploy.ps1` (PowerShell) always, for consistency with the Bicep pattern and cross-platform support. Both scripts include `terraform init/plan/apply` commands with Azure Storage backend init. _(Finding #8)_
    - **Phase 4**: Validation — parallel `terraform-lint-subagent` + `terraform-review-subagent`
    - **Output structure**: `infra/terraform/{project}/` with `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf`, `backend.tf`, `locals.tf`, `terraform.tfvars.example`, `deploy.sh`, `deploy.ps1`, `bootstrap-backend.sh`, `bootstrap-backend.ps1`, `modules/`
    - **Skills**: reads `azure-defaults`, `azure-artifacts`, `terraform-patterns`, `microsoft-code-reference`, `terraform-policy-compliance.instructions.md`

17. Create `.github/agents/13-terraform-deploy.agent.md` — modeled on `07-deploy.agent.md`. **Numbered `13-`**. _(Finding #6)_
    - **Frontmatter**: `name: 13-Terraform Deploy`, `model: Claude Sonnet 4.6`, `agents: []`
    - **Step 1**: Auth validation — `az account get-access-token` (same)
    - **Step 2**: State Backend — check if backend resources exist; if not, prompt user to run `bootstrap-backend.sh` first (or offer to run it). Then `terraform init` with Azure Storage backend, verify state lock. _(Finding #4)_
    - **Step 3**: Validate — `terraform validate` + `terraform fmt -check`
    - **Step 4**: Plan Preview — `terraform plan -out=tfplan` (saved plan file), classify Create/Update/Delete/Replace/NoChange
    - **Step 5**: Phase-aware Deployment — reads `04-implementation-plan.md`. If phased: set `var.deployment_phase` to appropriate value and run `terraform apply` (full graph, NOT `-target`). The deployment*phase variable controls which resources are created via `count` conditionals. `-target` is reserved as a **last-resort emergency option only**. If single: `terraform apply tfplan`. *(Finding #12)\_
    - **Step 6**: Post-deployment Verification — same ARG queries as Bicep Deploy
    - **New concerns**: state locking, state backup, import for existing resources
    - **Handoffs**: forward to `08-As-Built`, backward to `12-Terraform Code Generator` and `01-Conductor`

## Phase 3 — Subagents

18. Create `.github/agents/_subagents/terraform-lint-subagent.agent.md` — modeled on `bicep-lint-subagent.agent.md`. Runs `terraform fmt -check -recursive`, `terraform validate`, `tfsec .` (if available). Returns structured PASS/FAIL. READ-ONLY.

19. Create `.github/agents/_subagents/terraform-review-subagent.agent.md` — modeled on `bicep-review-subagent.agent.md`. Same 7-section review checklist adapted: (1) AVM-TF module usage, (2) CAF naming, (3) Required tags with `ManagedBy = "Terraform"`, (4) Security baseline (TLS/HTTPS/managed identity), (5) Unique names via `random_string`, (6) Code quality (`description` on vars, module organization), (7) Governance compliance (tag count, Deny policy satisfaction via `azurePropertyPath` translation). Returns APPROVED/NEEDS_REVISION/FAILED.

20. Create `.github/agents/_subagents/terraform-plan-subagent.agent.md` — modeled on `bicep-whatif-subagent.agent.md`. Runs `terraform plan -out=tfplan`, parses output for create/update/destroy counts. Auth via `az account get-access-token`. Returns structured change summary.

## Phase 4 — Conductor & Requirements Modifications

21. Modify `.github/agents/02-requirements.agent.md` — **IaC preference is the single source of truth** _(Finding #3)_:
    - Add **IaC preference** to the "Must-Have Information" table as part of Phase 5 (or as a new Phase 5 step)
    - Add a field `iac_tool: Bicep | Terraform` to the requirements output template in `01-requirements.md`
    - Default is `Bicep` if user doesn't specify
    - The workflow path string changes from hardcoded `bicep-plan → bicep-code` to `{iac}-plan → {iac}-code`
    - This is the **only place** the IaC preference is captured — downstream agents read it from `01-requirements.md`

22. Modify `.github/agents/01-conductor.agent.md` — **reads IaC preference, does NOT re-ask** _(Finding #3)_:
    - **`agents` list**: add `"11-Terraform Planner"`, `"12-Terraform Code Generator"`, `"13-Terraform Deploy"`
    - **Handoffs**: add `Step 4: Implementation Plan (Terraform)` → `11-Terraform Planner`, `Step 5: Generate Terraform` → `12-Terraform Code Generator`, `Step 6: Deploy (Terraform)` → `13-Terraform Deploy`
    - **7-step workflow table**: Step 4 becomes `IaC Plan (Bicep or Terraform)`, Step 5 becomes `IaC Code`, Step 6 becomes `Deploy`
    - **IaC Routing Logic**: Conductor reads `iac_tool` from `01-requirements.md` and auto-routes to the correct planner agent. **No re-asking**. If no requirements artifact exists (direct Step 4 entry without going through Requirements), THEN the Conductor asks "Bicep or Terraform?" as a fallback.
    - **Subagent delegation table**: add Terraform planner/code/deploy rows
    - **Subagent integration table**: add `terraform-lint-subagent`, `terraform-review-subagent`, `terraform-plan-subagent` entries

23. Modify `.github/agents/03-architect.agent.md` — add awareness of `iac_tool` from requirements so architecture recommendations note Terraform-specific considerations when applicable (e.g. state management, provider constraints). _(Finding #3)_

## Phase 5 — Quality Gates & Automation

24. Update `lefthook.yml` — add pre-commit hooks:
    - `terraform-fmt`: runs `terraform fmt -check -recursive` on staged `*.tf` files
    - `terraform-validate`: runs `terraform validate` on modified Terraform project directories (only when `*.tf` files are staged)

25. Update `package.json` — add scripts:
    - `lint:terraform-fmt`: `terraform fmt -check -recursive infra/terraform/`
    - `validate:terraform`: loops through `infra/terraform/*/` and runs `terraform init -backend=false && terraform validate`
    - Update `validate:all` to include new Terraform scripts

26. Extend `scripts/validate-governance-refs.mjs` — add parallel check groups for Terraform agents:
    - Group for `12-terraform-code-generator.agent.md` (Phase 1.5, governance references, policy compliance instruction ref)
    - Group for `terraform-review-subagent.agent.md` (Governance Compliance section)
    - Group for `11-terraform-planner.agent.md` (JSON downstream, `azurePropertyPath`) _(Finding #2 — uses `azurePropertyPath` not `terraformPropertyPath`)_
    - Group for `terraform-policy-compliance.instructions.md` (exists, applyTo `**/*.tf`, "Azure Policy always wins", references `04-governance-constraints.json`)
    - Update `governance-discovery.instructions.md` check: `applyTo` should also include `**/*.tf`
    - **Update all existing Bicep checks**: where they look for `bicepPropertyPath`, add an alternative check for `azurePropertyPath` to support the dual-field transition _(Finding #2)_

27. Create `.github/workflows/terraform-validate.yml` — CI workflow on PR for `infra/terraform/**` or `*.tf` changes: `terraform fmt -check`, `terraform init -backend=false`, `terraform validate`, optional `tfsec .`

28. Extend `.github/workflows/policy-compliance-check.yml` — trigger also on changes to Terraform agent/instruction files, run extended `validate-governance-refs.mjs`

29. **[NEW] Update artifact template H2 for IaC-neutral naming** — Rename `## 📁 Bicep Templates Location` to `## 📁 IaC Templates Location` in: (a) `validate-artifact-templates.mjs` ARTIFACT*HEADINGS for `05-implementation-reference.md`, (b) `azure-artifacts/SKILL.md` template definition, (c) `06-bicep-code-generator.agent.md` Phase 4 output instructions. This enables Terraform projects to use the same artifact template without a Bicep-specific heading. *(V2 Finding #2)\_

30. **[NEW] Update `validate-artifact-templates.mjs` AGENTS map for Terraform** — Add Terraform agent mappings to the AGENTS object so the validator correctly checks Terraform-generated artifacts against the Terraform agents (not the Bicep agents). Detect IaC type from project directory (`infra/bicep/` vs `infra/terraform/`) or artifact content to select the correct agent for validation. At minimum, suppress false failures when the producing agent is `12-terraform-code-generator.agent.md`. _(V2 Finding #3)_

## Phase 6 — Governance Property Migration (Bicep Side — Deferrable)

> **Note**: The foundational dual-field governance change (subagent producing both `bicepPropertyPath` + `azurePropertyPath`) is completed in Phase 1 item 10. Phase 6 covers the **optional Bicep-side cleanup** — migrating existing Bicep agents to read `azurePropertyPath` instead of `bicepPropertyPath`. This can be **deferred** until after all Terraform agents are working, since Bicep agents continue to function with `bicepPropertyPath` during the transition. _(V2 Finding #1)_

31. **[DEFERRABLE] Migrate Bicep agents to `azurePropertyPath`** _(Finding #2, V2 Finding #1)_:
    - Update `06-bicep-code-generator.agent.md` Phase 1.5 to read `azurePropertyPath` (with fallback to `bicepPropertyPath`)
    - Update `bicep-review-subagent.agent.md` § 7 to use `azurePropertyPath`
    - Update `validate-governance-refs.mjs` existing Bicep check groups to accept `azurePropertyPath` as primary (with `bicepPropertyPath` backward compatibility)
    - Update any existing `04-governance-constraints.json` files in `agent-output/` to include both fields
    - Eventually deprecate `bicepPropertyPath` once all agents use `azurePropertyPath`

## Phase 7 — Documentation & Housekeeping

32. Update `.github/copilot-instructions.md`:
    - Workflow table: Steps 4-6 show both Bicep and Terraform agent names (using `11-`/`12-`/`13-` numbering)
    - Skills table: add `terraform-patterns`
    - Key files: add `infra/terraform/{project}/`
    - Validation: add `terraform fmt`, `terraform validate`
    - Key conventions: add Terraform conventions alongside Bicep

33. Update `docs/terraform-roadmap.md` — mark completed items, link to actual agent/instruction files

34. Update issue #85 — revise body to match refined scope (remove Scenarios/Terratest/terraform-docs workflow), add child issues:
    - **Child 1**: Dev Container + Git Config + VS Code Extensions + MCP Tool Verification (Phase 0)
    - **Child 2**: Instructions + Skills + Dual-Field Governance Migration (Phase 1)
    - **Child 3**: Terraform Planner (`11-`) + Code Gen (`12-`) + Deploy (`13-`) agents (Phase 2)
    - **Child 4**: Subagents (Phase 3)
    - **Child 5**: Conductor + Requirements + Architect modifications (Phase 4)
    - **Child 6**: Quality gates + CI/CD + IaC-neutral templates (Phase 5)
    - **Child 7**: Governance property migration — Bicep side, deferrable (Phase 6)
    - **Child 8**: Documentation updates (Phase 7)

## Items NOT in Scope (deferred)

- **Scenarios** (S09-terraform-baseline) — deferred to a follow-up issue
- **Terratest** — Go feature added to devcontainer but Terratest setup deferred
- **terraform-docs workflow** — deferred (can use `terraform-docs` manually)
- **Infracost integration** — documented as optional future enhancement
- **terraform-adr, terraform-diagrams, terraform-workload-docs, terraform-cost-estimate skills** — not needed initially; existing IaC-agnostic skills (`azure-adr`, `azure-diagrams`, etc.) work for Terraform projects too since they're about Azure architecture, not IaC syntax

## Regarding the Terraform MCP (markaicode article)

That article is about using Terraform to deploy MCP infrastructure — it is **NOT** a Terraform MCP server for agent integration. **Not relevant** to this project. The **HashiCorp Terraform MCP Server** (from the `terraform.agent.md` reference) is the correct one — it provides registry search, module version lookup, workspace management, and run orchestration. This is what we'll add to `.vscode/mcp.json` **via npx** (not Docker), pre-installed as a devDependency.

## Tools & Extensions Summary

| Tool/Extension                          | Purpose                                         | Added Where                                                      |
| --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `HashiCorp.terraform`                   | VS Code Terraform language support              | devcontainer extensions                                          |
| `ms-azuretools.vscode-azureterraform`   | Azure Terraform integration                     | devcontainer extensions                                          |
| `@hashicorp/terraform-mcp-server` (npx) | Registry search, module versions, workspace ops | `.vscode/mcp.json` + `package.json` devDep _(Finding #5, V2 #4)_ |
| `azure-mcp/azureterraformbestpractices` | Azure best practices for Terraform              | Already in all agent tool lists                                  |
| `tfsec`                                 | Security scanning                               | Installed via Terraform devcontainer feature                     |
| `terraform fmt/validate`                | Code quality                                    | Lefthook hooks + CI workflow                                     |

## Verification

- `terraform fmt -check -recursive infra/terraform/` — format validation
- `terraform init -backend=false && terraform validate` — syntax validation per project
- `tfsec infra/terraform/` — security scanning
- `npm run validate:all` — all validation scripts pass (including extended governance refs)
- `npm run lint:governance-refs` — Terraform governance guardrails validated (checking `azurePropertyPath`)
- Agent frontmatter validation passes for all new `.agent.md` files (`11-`, `12-`, `13-`)
- Instruction frontmatter validation passes for all new `.instructions.md` files
- Skill format validation passes for `terraform-patterns/SKILL.md`
- `validate-artifact-templates.mjs` passes with IaC-neutral H2 headings and Terraform AGENTS map _(V2 Finding #2, #3)_
- End-to-end: Requirements captures `iac_tool: Terraform`, Conductor reads it and auto-routes to `11-Terraform Planner` → `12-Terraform Code Generator` → `13-Terraform Deploy` correctly _(Finding #3)_

## Decisions

- **Separate Tf Deploy agent**: Yes — Terraform deployment is state-based, fundamentally different from Bicep ARM deployments
- **State backend**: Azure Storage Account (aligns with Azure-first approach) with **parameterized bootstrap scripts** for backend resource creation — accept custom names for governance compliance _(Finding #4, V2 Finding #6)_
- **HashiCorp TF MCP**: Integrated into `.vscode/mcp.json` via **npx**, **pre-installed as devDependency** in `package.json` for zero startup latency _(Finding #5, V2 Finding #4)_
- **MCP tool verification**: Tool names verified in Phase 0 before agent authoring; fallback to Terraform Registry API via fetch _(Finding #1)_
- **Governance approach**: Dual-field — subagent produces both `bicepPropertyPath` AND `azurePropertyPath` during transition; Terraform agents read `azurePropertyPath`, Bicep agents continue reading `bicepPropertyPath`; Bicep-side migration to `azurePropertyPath` deferred (Phase 6) _(Finding #2, V2 Finding #1)_
- **IaC selection**: Captured ONCE in Requirements (`iac_tool` field); Conductor reads and routes — no re-asking _(Finding #3)_
- **Agent numbering**: `11-`, `12-`, `13-` (continuing from `10-challenger`) to avoid prefix collision with Bicep `05-`, `06-`, `07-` _(Finding #6)_
- **Artifact templates**: Terraform-specific sections as H3s under existing H2s to pass validation; Bicep-specific H2s renamed to IaC-neutral _(Finding #7, V2 Finding #2)_
- **Deploy scripts**: Both `.sh` and `.ps1` generated always for cross-platform support _(Finding #8)_
- **Phased deployment**: `var.deployment_phase` + `count` conditionals (NOT `terraform apply -target` anti-pattern) _(Finding #12)_
- **Lock file**: `.terraform.lock.hcl` committed to version control; only `.terraform/` is gitignored _(Finding #14)_
- **Skill parity**: Existing `azure-adr`, `azure-diagrams`, `azure-troubleshooting` skills are IaC-agnostic and work for Terraform — no separate `terraform-*` skills needed for those
- **Issue management**: Update #85 with refined scope + create 8 child issues per phase
- **Phase merge ordering**: Sequential phase merges required for CI handoff validation; alternatively batch Phase 2 + Phase 4 _(V2 Finding #5)_
- **Validator updates**: AGENTS map and ARTIFACT*HEADINGS updated for Terraform; IaC-type detection for dual-agent artifact validation *(V2 Finding #3)\_

---

## Challenger Findings Traceability

### V1 Findings (14 issues — all applied)

| Finding # | Severity   | Title                                 | Applied In                                                                 |
| --------- | ---------- | ------------------------------------- | -------------------------------------------------------------------------- |
| 1         | must_fix   | MCP tool namespace verification       | Phase 0 item 8, Phase 2 items 15-16                                        |
| 2         | must_fix   | IaC-agnostic azurePropertyPath        | Phase 1 items 10+12, Phase 2 items 15-16, Phase 5 item 26, Phase 6 item 31 |
| 3         | must_fix   | IaC selection single source of truth  | Phase 4 items 21-23                                                        |
| 4         | should_fix | State backend bootstrapping           | Phase 2 items 16 (2.5), 17 (Step 2)                                        |
| 5         | should_fix | npx instead of Docker for MCP         | Phase 0 item 6                                                             |
| 6         | should_fix | Agent numbering 11-/12-/13-           | Phase 2 items 15-17, all references                                        |
| 7         | should_fix | H3 subsections for Terraform sections | Phase 2 item 15 (Phase 4)                                                  |
| 8         | should_fix | Generate both deploy scripts          | Phase 2 item 16 (Phase 3)                                                  |
| 9         | should_fix | Move governance applyTo to Phase 1    | Phase 1 item 9                                                             |
| 10        | suggestion | AVM-TF module table                   | Phase 1 item 14                                                            |
| 11        | suggestion | Terraform AVM pitfalls section        | Phase 1 item 13                                                            |
| 12        | suggestion | deployment_phase variable not -target | Phase 2 items 16 (Phase 2), 17 (Step 5)                                    |
| 13        | suggestion | HCP-to-Azure-Storage guardrail        | Phase 2 callout box                                                        |
| 14        | suggestion | Commit .terraform.lock.hcl            | Phase 0 item 4                                                             |

### V2 Findings (6 issues — all applied)

| Finding # | Severity   | Title                                  | Applied In                                        |
| --------- | ---------- | -------------------------------------- | ------------------------------------------------- |
| V2-1      | should_fix | Phase 6 migration dependency inversion | Phase 1 item 10, Phase 6 item 31 (now deferrable) |
| V2-2      | should_fix | Bicep-hardcoded H2 in 05 template      | Phase 5 item 29                                   |
| V2-3      | suggestion | AGENTS map needs TF mappings           | Phase 5 item 30                                   |
| V2-4      | suggestion | npx startup latency (devDependency)    | Phase 0 item 6                                    |
| V2-5      | suggestion | CI requires ordered phase merges       | Phase merge ordering callout                      |
| V2-6      | suggestion | Parameterized bootstrap script         | Phase 2 item 16 (Phase 2.5), callout box          |
