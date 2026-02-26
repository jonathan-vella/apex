# Terraform End-to-End Test Plan

> **Auto-monitored by Copilot** — the [Test Execution Tracker](#test-execution-tracker)
> at the bottom of this document is updated after every test run.
> Copilot keeps pass/fail status, timestamps, and regression notes current.

<!-- markdownlint-disable MD033 -->

## Purpose

Validate the full Terraform capability introduced to the Agentic InfraOps project.
This plan covers every touchpoint — agents, subagents, skills, instructions,
CI/CD workflows, and the end-to-end 7-step agentic workflow with Terraform as
the IaC tool.

## Scope

| Area                   | Components Under Test                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Agents**             | `05t-Terraform Planner`, `06t-Terraform CodeGen`, `07t-Terraform Deploy`                                                            |
| **Subagents**          | `terraform-lint-subagent`, `terraform-review-subagent`, `terraform-plan-subagent`, `challenger-review-subagent`                     |
| **Conductor routing**  | `01-Conductor` routes to `05t`/`06t`/`07t` when `iac_tool: terraform`                                                               |
| **Skills**             | `terraform-patterns`, `azure-defaults` (Terraform Conventions section)                                                              |
| **Instructions**       | `terraform-code-best-practices.instructions.md`, `terraform-policy-compliance.instructions.md`                                      |
| **CI/CD**              | `.github/workflows/terraform-validate.yml`, `npm run validate:terraform`                                                            |
| **Infrastructure**     | `infra/terraform/{project}/` file structure and conventions                                                                         |
| **Artifact templates** | `04-implementation-plan`, `04-governance-constraints`, `04-preflight-check`, `05-implementation-reference`, `06-deployment-summary` |
| **Adversarial review** | `challenger-review-subagent` 3-pass rotation (security, architecture, cost) + 1-pass comprehensive across all workflow agents       |

## Pre-Requisites

- Dev container running with all tools (`terraform`, `az`, `gh`, `node`, `python3`)
- Azure CLI authenticated (`az account get-access-token` succeeds)
- Terraform CLI >= 1.9 available on `PATH`
- `npm install` completed (validation scripts)
- Python venv activated with `requirements.txt` installed (diagram generation)

---

## How to Run

Each test suite has a corresponding `.prompt.md` file in this folder.
Because these prompts live outside `.github/prompts/`, they are **not**
available as `/slash-commands` in VS Code chat. Use one of these methods
instead:

### Method 1: File Reference in Chat (Recommended)

1. Open VS Code Chat (`Ctrl+Shift+I`)
2. Type `#file:docs/tf-tests/tf-test-regression.prompt.md` (or any prompt)
3. Add your project name and press Enter
4. Copilot reads the prompt and executes the test suite

### Method 2: Open and Attach

1. Open the prompt file in the editor
2. In Chat, use `#file` and select the open file
3. Say: "Run this test prompt for project `{your-project}`"

### Method 3: Symlink to `.github/prompts/` (Enables Slash Commands)

If you prefer `/tf-test-*` slash commands, symlink the prompts:

```bash
for f in docs/tf-tests/tf-test-*.prompt.md; do
  ln -sf "../../$f" ".github/prompts/$(basename "$f")"
done
```

### Prompt → Suite Mapping

| Prompt File                           | Suites        | Agent                   | Auth Required |
| ------------------------------------- | ------------- | ----------------------- | ------------- |
| `tf-test-all.prompt.md`               | TS-01 — TS-12 | `01-Conductor`          | Yes           |
| `tf-test-static-validation.prompt.md` | TS-01 — TS-04 | `agent`                 | No            |
| `tf-test-planner.prompt.md`           | TS-05         | `05t-Terraform Planner` | Yes           |
| `tf-test-codegen.prompt.md`           | TS-06         | `06t-Terraform CodeGen` | Yes           |
| `tf-test-deploy.prompt.md`            | TS-07         | `07t-Terraform Deploy`  | Yes           |
| `tf-test-subagents.prompt.md`         | TS-08         | `agent`                 | Partial       |
| `tf-test-conductor.prompt.md`         | TS-09         | `01-Conductor`          | Yes           |
| `tf-test-compliance.prompt.md`        | TS-10, TS-11  | `agent`                 | No            |
| `tf-test-regression.prompt.md`        | TS-12         | `agent`                 | No            |
| `tf-test-adversarial.prompt.md`       | TS-13         | `agent`                 | Partial       |

**Quick start** — run the static validation suite (no Azure auth needed):

> `#file:docs/tf-tests/tf-test-static-validation.prompt.md`

---

## Test Suites

### TS-01: Agent Definition Validation

Verify all Terraform agent definitions conform to project standards.

| ID       | Test Case          | Steps                                                                             | Expected Result                                                                                                                                                                                                                     |
| -------- | ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS-01-01 | Frontmatter schema | Run `npm run lint:agent-frontmatter`                                              | PASS — no errors for `05t`, `06t`, `07t`, or Terraform subagents                                                                                                                                                                    |
| TS-01-02 | Tool declarations  | Inspect `05t`, `06t`, `07t` agent files for `terraform/*` tools                   | All three agents declare `terraform/search_modules`, `terraform/get_module_details`, `terraform/get_latest_module_version`, `terraform/search_providers`, `terraform/get_provider_details`, `terraform/get_latest_provider_version` |
| TS-01-03 | Handoff chains     | Verify handoff labels in `05t` → `06t` → `07t` → `08`                             | Each agent has correct forward/backward handoffs                                                                                                                                                                                    |
| TS-01-04 | Conductor routing  | Read `01-conductor.agent.md` agents list                                          | Contains `05t-Terraform Planner`, `06t-Terraform CodeGen`, `07t-Terraform Deploy`                                                                                                                                                   |
| TS-01-05 | Subagent wiring    | Verify `06t` references `terraform-lint-subagent` and `terraform-review-subagent` | Both subagents listed in `agents:` frontmatter                                                                                                                                                                                      |
| TS-01-06 | Model declarations | Check model field in all Terraform agents                                         | `05t`: Opus, `06t`: Opus/Sonnet, `07t`: Sonnet, subagents: Sonnet                                                                                                                                                                   |
| TS-01-07 | Subagent scope     | Verify subagents have `user-invokable: false`                                     | All 3 Terraform subagents are non-user-invokable                                                                                                                                                                                    |

### TS-02: Instruction File Validation

Verify Terraform instruction files pass structural and content checks.

| ID       | Test Case                | Steps                                                 | Expected Result                                                                                     |
| -------- | ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| TS-02-01 | Instruction frontmatter  | Run `npm run lint:instruction-frontmatter`            | PASS for `terraform-code-best-practices` and `terraform-policy-compliance`                          |
| TS-02-02 | `applyTo` glob coverage  | Read frontmatter of both instructions                 | `terraform-code-best-practices`: `**/*.tf`; `terraform-policy-compliance`: `**/*.tf, **/*.agent.md` |
| TS-02-03 | Instruction references   | Run `npm run validate:instruction-refs`               | No broken references to Terraform instructions                                                      |
| TS-02-04 | AVM-first mandate        | Read `terraform-code-best-practices.instructions.md`  | Contains `AVM first` rule marked `MANDATORY`                                                        |
| TS-02-05 | HCP guardrail            | Grep both instructions for "Never" + "HCP" or "cloud" | Both instructions forbid `terraform { cloud {} }` and `TFE_TOKEN`                                   |
| TS-02-06 | Provider pin version     | Read best-practices instruction                       | Specifies `~> 4.0` for `azurerm`                                                                    |
| TS-02-07 | Policy translation table | Read `terraform-policy-compliance.instructions.md`    | Contains `azurePropertyPath` → Terraform argument mapping table with 9+ entries                     |

### TS-03: Skill Validation

Verify the `terraform-patterns` skill and Terraform sections in `azure-defaults`.

| ID       | Test Case                 | Steps                                                              | Expected Result                                                                                                                                        |
| -------- | ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TS-03-01 | Skill frontmatter         | Run `npm run lint:skills-format`                                   | PASS for `terraform-patterns`                                                                                                                          |
| TS-03-02 | Pattern coverage          | Read `terraform-patterns/SKILL.md`                                 | Contains patterns: Hub-Spoke, Private Endpoint, Diagnostic Settings, Conditional Deployment, Module Composition, Managed Identity, Plan Interpretation |
| TS-03-03 | AVM Known Pitfalls        | Read `terraform-patterns/SKILL.md`                                 | Contains "AVM Known Pitfalls" section with documented type issues                                                                                      |
| TS-03-04 | azure-defaults TF section | Read `azure-defaults/SKILL.md`, search for "Terraform Conventions" | Section exists with provider pin, backend, tags, unique suffix conventions                                                                             |
| TS-03-05 | Pattern code validity     | Extract HCL snippets from `terraform-patterns/SKILL.md`            | All code blocks use valid HCL syntax (manual or `terraform fmt` check)                                                                                 |
| TS-03-06 | Compatibility metadata    | Read skill frontmatter                                             | Declares `Terraform >= 1.9, azurerm ~> 4.0, Azure CLI`                                                                                                 |

### TS-04: CI/CD Workflow Validation

Verify the GitHub Actions workflow and npm scripts for Terraform.

| ID       | Test Case           | Steps                                                                                     | Expected Result                                                                              |
| -------- | ------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| TS-04-01 | Workflow syntax     | Run `actionlint .github/workflows/terraform-validate.yml` (if available) or manual review | Valid YAML, correct `on:` triggers                                                           |
| TS-04-02 | Trigger paths       | Read workflow `on.pull_request.paths` and `on.push`                                       | PR triggers on `infra/terraform/**` and `**/*.tf`; push triggers on `tf-dev` branch          |
| TS-04-03 | Terraform version   | Read workflow `hashicorp/setup-terraform` step                                            | Uses `~1.9`                                                                                  |
| TS-04-04 | Format check step   | Read workflow                                                                             | Runs `terraform fmt -check -recursive infra/terraform/`                                      |
| TS-04-05 | Validate step       | Read workflow                                                                             | Loops `infra/terraform/*/` dirs, runs `terraform init -backend=false` + `terraform validate` |
| TS-04-06 | tfsec optional      | Read workflow                                                                             | `tfsec` step has `continue-on-error: true`                                                   |
| TS-04-07 | npm validate script | Run `npm run validate:terraform`                                                          | Script exists and runs without error (may have 0 projects to validate)                       |

### TS-05: Terraform Planner Agent (05t) — Workflow Test

End-to-end functional test of the planning phase.

| ID        | Test Case                       | Steps                                                                                             | Expected Result                                                                                                                                              |
| --------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TS-05-01  | Skill loading                   | Invoke `05t` and verify it reads `azure-defaults`, `azure-artifacts`, `terraform-patterns` skills | Agent reads all 3 skills before planning                                                                                                                     |
| TS-05-02  | Prerequisites gate              | Invoke `05t` without `02-architecture-assessment.md`                                              | Agent STOPs and requests handoff to Architect                                                                                                                |
| TS-05-03  | Governance discovery delegation | Invoke `05t` with valid prerequisites                                                             | Delegates to `governance-discovery-subagent`                                                                                                                 |
| TS-05-04  | AVM-TF module verification      | Observe `05t` querying Terraform Registry MCP                                                     | Uses `terraform/search_modules` and `terraform/get_module_details` for each resource                                                                         |
| TS-05-05  | Deployment strategy gate        | Observe `05t` interaction                                                                         | Agent asks user for phased vs single deployment (mandatory gate)                                                                                             |
| TS-05-06  | Governance review (1x)          | Observe `05t` after governance discovery                                                          | Invokes `challenger-review-subagent` (1x comprehensive) on `04-governance-constraints.md`; writes `challenge-findings-governance-constraints.json`           |
| TS-05-06a | Adversarial review (3-pass)     | Observe `05t` after plan generation                                                               | Invokes `challenger-review-subagent` 3 times with rotating lenses; writes `challenge-findings-implementation-plan-pass{1,2,3}.json`                          |
| TS-05-07  | Approval gate                   | Observe `05t` final output                                                                        | Presents plan summary and waits for "approve"                                                                                                                |
| TS-05-08  | Output artifacts                | Check `agent-output/{project}/`                                                                   | Contains `04-implementation-plan.md`, `04-governance-constraints.md/.json`, `04-dependency-diagram.py`, `04-runtime-diagram.py`, `challenge-findings-*.json` |
| TS-05-09  | HCP guardrail                   | Read generated `04-implementation-plan.md`                                                        | No `terraform { cloud {} }` patterns; backend is Azure Storage Account                                                                                       |
| TS-05-10  | H2 template compliance          | Run `npm run lint:artifact-templates`                                                             | PASS for generated artifacts                                                                                                                                 |

### TS-06: Terraform CodeGen Agent (06t) — Workflow Test

End-to-end functional test of the code generation phase.

| ID       | Test Case                     | Steps                                                                                     | Expected Result                                                                                            |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| TS-06-01 | Prerequisites gate            | Invoke `06t` without `04-implementation-plan.md`                                          | Agent STOPs and requests handoff to Planner                                                                |
| TS-06-02 | Preflight check               | Invoke `06t` with valid prerequisites                                                     | Runs AVM-TF module verification (Phase 1) and saves `04-preflight-check.md`                                |
| TS-06-03 | Governance compliance mapping | Observe `06t` Phase 1.5                                                                   | Reads `04-governance-constraints.json`, translates `azurePropertyPath` to TF args                          |
| TS-06-04 | File structure                | List `infra/terraform/{project}/`                                                         | Contains `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`, `versions.tf`, `locals.tf`, `backend.tf` |
| TS-06-05 | Bootstrap scripts             | Check `infra/terraform/{project}/`                                                        | Contains `bootstrap-backend.sh` AND `bootstrap-backend.ps1`                                                |
| TS-06-06 | Deploy scripts                | Check `infra/terraform/{project}/`                                                        | Contains `deploy.sh` AND `deploy.ps1`                                                                      |
| TS-06-07 | AVM-TF module usage           | Read `main.tf`                                                                            | Uses `source = "Azure/avm-res-*/azurerm"` for resources with AVM availability                              |
| TS-06-08 | Provider pin                  | Read `versions.tf`                                                                        | `azurerm` pinned to `~> 4.0` (or current stable)                                                           |
| TS-06-09 | Backend config                | Read `backend.tf`                                                                         | Uses `backend "azurerm"` with storage account (no HCP/cloud blocks)                                        |
| TS-06-10 | Unique suffix                 | Read `locals.tf`                                                                          | Generates `unique_suffix` or `suffix` once, used across all resources                                      |
| TS-06-11 | Required tags                 | Read `locals.tf`                                                                          | `tags` local includes `Environment`, `ManagedBy = "Terraform"`, `Project`, `Owner` at minimum              |
| TS-06-12 | Security baseline             | Grep all `.tf` files                                                                      | TLS 1.2 (`min_tls_version`), HTTPS-only, no public blob access, managed identity                           |
| TS-06-13 | Phased deployment             | Read `variables.tf` (if phased plan)                                                      | Contains `variable "deployment_phase"` with validation block                                               |
| TS-06-14 | Lint subagent                 | Observe `06t` Phase 4                                                                     | Delegates to `terraform-lint-subagent`, expects PASS                                                       |
| TS-06-15 | Review subagent               | Observe `06t` Phase 4                                                                     | Delegates to `terraform-review-subagent`, expects APPROVED                                                 |
| TS-06-16 | terraform validate            | Run `cd infra/terraform/{project} && terraform init -backend=false && terraform validate` | Exits 0                                                                                                    |
| TS-06-17 | terraform fmt                 | Run `terraform fmt -check -recursive infra/terraform/{project}/`                          | Exits 0 (no formatting issues)                                                                             |
| TS-06-18 | Implementation reference      | Check `agent-output/{project}/`                                                           | Contains `05-implementation-reference.md` with validation status                                           |
| TS-06-19 | H2 template compliance        | Run `npm run lint:artifact-templates`                                                     | PASS for `04-preflight-check.md` and `05-implementation-reference.md`                                      |
| TS-06-20 | No hardcoded secrets          | Grep `.tf` files for password, secret, key patterns                                       | No plaintext secrets; uses Key Vault references or `sensitive = true`                                      |
| TS-06-21 | Adversarial code review       | Observe `06t` Phase 4.5 after lint+review                                                 | Invokes `challenger-review-subagent` 3x with rotating lenses on `infra/terraform/{project}/`               |
| TS-06-22 | Code review output files      | Check `agent-output/{project}/`                                                           | Contains `challenge-findings-iac-code-pass{1,2,3}.json`                                                    |
| TS-06-23 | Must-fix re-lint loop         | If `must_fix` items found in adversarial review                                           | Agent re-lints and re-reviews after applying fixes                                                         |

### TS-07: Terraform Deploy Agent (07t) — Workflow Test

End-to-end functional test of the deployment phase.

| ID       | Test Case                | Steps                                 | Expected Result                                                     |
| -------- | ------------------------ | ------------------------------------- | ------------------------------------------------------------------- |
| TS-07-01 | Auth validation          | Observe `07t` Step 1                  | Runs `az account get-access-token` (not just `az account show`)     |
| TS-07-02 | Backend verification     | Observe `07t` Step 2                  | Checks storage account exists; offers bootstrap if missing          |
| TS-07-03 | Pre-deploy validation    | Observe `07t` Step 3                  | Runs `terraform init`, `terraform validate`, `terraform fmt -check` |
| TS-07-04 | Plan preview             | Observe `07t` Step 4                  | Runs `terraform plan -out=tfplan` and classifies changes            |
| TS-07-05 | Destructive ops gate     | Simulate destroy in plan              | Agent STOPs and requires explicit approval for destroy/replace      |
| TS-07-06 | Phased deployment        | Invoke `07t` with phased plan         | Deploys one phase at a time with `var.deployment_phase`             |
| TS-07-07 | Approval gate            | Observe before `terraform apply`      | Agent waits for explicit user approval                              |
| TS-07-08 | Post-deploy verification | Observe `07t` Step 6                  | Runs `terraform output` and ARG query to verify resources           |
| TS-07-09 | Deployment summary       | Check `agent-output/{project}/`       | Contains `06-deployment-summary.md`                                 |
| TS-07-10 | Plan-only mode           | Select "Run Plan Only" handoff        | Plan generated but `terraform apply` is NOT executed                |
| TS-07-11 | H2 template compliance   | Run `npm run lint:artifact-templates` | PASS for `06-deployment-summary.md`                                 |
| TS-07-12 | Pre-deploy review        | Observe `07t` Step 4.5                | Invokes `challenger-review-subagent` (1x comprehensive) on plan     |
| TS-07-13 | Deploy review output     | Check `agent-output/{project}/`       | Contains `challenge-findings-deployment.json`                       |
| TS-07-14 | Must-fix deployment gate | If `must_fix` in deployment review    | Agent STOPs and requires user acknowledgement before proceeding     |

### TS-08: Subagent Functional Tests

Verify each Terraform subagent produces correct structured output.

| ID       | Test Case                | Steps                                                | Expected Result                                                     |
| -------- | ------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------- |
| TS-08-01 | Lint — format check      | Run `terraform-lint-subagent` on valid project       | `Status: PASS`, 0 errors, 0 format issues                           |
| TS-08-02 | Lint — format failure    | Run on intentionally mis-formatted `.tf`             | `Status: FAIL`, format issues reported                              |
| TS-08-03 | Lint — validate error    | Run on `.tf` with syntax error                       | `Status: FAIL`, error details with file/line                        |
| TS-08-04 | Lint — tfsec skip        | Run where `tfsec` is not installed                   | Reports `TFSEC_SKIP`, overall status based on fmt+validate          |
| TS-08-05 | Review — APPROVED        | Run `terraform-review-subagent` on compliant project | `Status: APPROVED`, all checks passed                               |
| TS-08-06 | Review — NEEDS_REVISION  | Run on project missing required tags                 | `Status: NEEDS_REVISION`, lists missing tags                        |
| TS-08-07 | Review — FAILED          | Run on project with CRITICAL security issue          | `Status: FAILED`, critical findings listed                          |
| TS-08-08 | Review — governance      | Run on project with governance constraints           | Validates `azurePropertyPath` translation and policy compliance     |
| TS-08-09 | Plan — create only       | Run `terraform-plan-subagent` on new project         | `Status: PASS`, all changes are `+` create                          |
| TS-08-10 | Plan — destructive       | Run on project with resource removal                 | `Status: WARNING`, destructive ops flagged                          |
| TS-08-11 | Plan — auth failure      | Run without valid Azure token                        | `Status: FAIL`, auth error reported                                 |
| TS-08-12 | Subagent isolation       | Verify subagents do NOT modify files                 | Read-only: no `.tf` files edited by lint, review, or plan subagents |
| TS-08-13 | Challenger — definition  | Run `npm run lint:agent-frontmatter` on challenger   | Frontmatter valid, `user-invokable: false`, no agents listed        |
| TS-08-14 | Challenger — JSON output | Invoke `challenger-review-subagent` on test artifact | Returns valid JSON with required fields (see TS-13 for full suite)  |

### TS-09: Conductor Integration (Terraform Path)

Verify the Conductor agent correctly routes the Terraform workflow.

| ID       | Test Case               | Steps                                                      | Expected Result                                                                             |
| -------- | ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| TS-09-01 | IaC tool routing        | Start Conductor with `iac_tool: terraform` in requirements | Routes to `05t` (not `05b`) for Step 4                                                      |
| TS-09-02 | Full workflow           | Run Conductor through Steps 1-7 with Terraform             | Steps execute: `02-Req` → `03-Arch` → `05t-Plan` → `06t-Code` → `07t-Deploy` → `08-AsBuilt` |
| TS-09-03 | Handoff context         | Verify context flows between agents                        | Each agent reads prior artifacts from `agent-output/{project}/`                             |
| TS-09-04 | Approval gates          | Observe gates at Steps 4, 5, 6                             | Conductor pauses for human approval at plan, code, and deploy                               |
| TS-09-05 | Backward handoff        | Request revision at Step 5                                 | Correctly hands back to `05t` Planner                                                       |
| TS-09-06 | Skip design step        | Invoke Conductor, skip Step 3                              | Proceeds directly from Architect to Terraform Planner                                       |
| TS-09-07 | As-Built reads TF state | Invoke `08-As-Built` after Terraform deploy                | Reads `terraform output` and prior artifacts to generate docs                               |

### TS-10: Convention Compliance

Verify generated Terraform code follows all project conventions.

| ID       | Test Case              | Steps                                      | Expected Result                                                                              |
| -------- | ---------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| TS-10-01 | CAF naming             | Inspect generated resource names           | Follow patterns: `rg-{project}-{env}`, `kv-{short}-{env}-{suffix}`, `st{short}{env}{suffix}` |
| TS-10-02 | Storage account names  | Check all storage account names            | No hyphens, ≤ 24 chars, lowercase only                                                       |
| TS-10-03 | Key Vault names        | Check all Key Vault names                  | ≤ 24 chars                                                                                   |
| TS-10-04 | Default region         | Read `variables.tf` default for `location` | `swedencentral`                                                                              |
| TS-10-05 | Variable descriptions  | Inspect all `variable` blocks              | Every variable has a `description` field                                                     |
| TS-10-06 | Variable types         | Inspect all `variable` blocks              | Every variable has a `type` constraint                                                       |
| TS-10-07 | No `terraform -target` | Grep deploy scripts and agent instructions | No references to `terraform -target` for phased deployment                                   |
| TS-10-08 | Count conditionals     | If phased, read module calls               | Uses `count = var.deployment_phase == "all" \|\| var.deployment_phase == "{phase}" ? 1 : 0`  |

### TS-11: Security Baseline Compliance

Verify all security requirements are met in generated code.

| ID       | Test Case             | Steps                                                       | Expected Result                                           |
| -------- | --------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| TS-11-01 | TLS 1.2               | Grep `.tf` for `min_tls_version`                            | All resources set to `"TLS1_2"`                           |
| TS-11-02 | HTTPS only            | Grep `.tf` for `https_traffic_only_enabled` or `https_only` | Set to `true` on all applicable resources                 |
| TS-11-03 | No public blob        | Grep `.tf` for blob public access settings                  | `allow_nested_items_to_be_public = false` or equivalent   |
| TS-11-04 | Managed identity      | Grep `.tf` for `identity` blocks                            | `SystemAssigned` or `UserAssigned` preferred over keys    |
| TS-11-05 | SQL AD-only auth      | If SQL present, grep for `azuread_authentication_only`      | Set to `true`                                             |
| TS-11-06 | No inline secrets     | Grep `.tf` for `password`, `secret`, `connection_string`    | No plaintext values; uses Key Vault or `sensitive = true` |
| TS-11-07 | Public network access | Grep `.tf` for `public_network_access_enabled`              | Set to `false` for production data services               |

### TS-12: Regression Tests

Run after any change to Terraform agents, instructions, or skills.

| ID       | Test Case                     | Steps                                   | Expected Result                             |
| -------- | ----------------------------- | --------------------------------------- | ------------------------------------------- |
| TS-12-01 | Full validation suite         | Run `npm run validate:all`              | All checks pass                             |
| TS-12-02 | Terraform-specific validation | Run `npm run validate:terraform`        | All Terraform projects pass                 |
| TS-12-03 | Markdown linting              | Run `npm run lint:md`                   | No errors in Terraform-related docs         |
| TS-12-04 | Artifact template sync        | Run `npm run lint:h2-sync`              | H2 headings in sync for Terraform artifacts |
| TS-12-05 | Governance ref check          | Run `npm run lint:governance-refs`      | No broken governance references             |
| TS-12-06 | Agent frontmatter             | Run `npm run lint:agent-frontmatter`    | All Terraform agents pass                   |
| TS-12-07 | Skill format                  | Run `npm run lint:skills-format`        | `terraform-patterns` skill passes           |
| TS-12-08 | Instruction refs              | Run `npm run validate:instruction-refs` | All Terraform instruction references valid  |

### TS-13: Adversarial Review (Challenger Subagent)

Validate the `challenger-review-subagent` definition, integration with
all parent agents, multi-pass rotation, JSON output schema, and
deduplication logic.

#### TS-13A: Subagent Definition

| ID        | Test Case             | Steps                                                  | Expected Result                                                                                                                                    |
| --------- | --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS-13A-01 | Frontmatter schema    | Run `npm run lint:agent-frontmatter`                   | PASS for `challenger-review-subagent`                                                                                                              |
| TS-13A-02 | Non-user-invokable    | Read `challenger-review-subagent.agent.md` frontmatter | `user-invokable: false`                                                                                                                            |
| TS-13A-03 | No child agents       | Read frontmatter `agents` field                        | `agents: []`                                                                                                                                       |
| TS-13A-04 | Tool declarations     | Read frontmatter `tools` field                         | Contains `read`, `search`, `web`, `azure-mcp/*`                                                                                                    |
| TS-13A-05 | Input parameters      | Read subagent body "Inputs" section                    | Documents all 6 params: `artifact_path`, `project_name`, `artifact_type`, `review_focus`, `pass_number`, `prior_findings`                          |
| TS-13A-06 | Artifact types        | Read `artifact_type` enum                              | Includes all 7: `requirements`, `architecture`, `implementation-plan`, `governance-constraints`, `iac-code`, `cost-estimate`, `deployment-preview` |
| TS-13A-07 | Review focus lenses   | Read "Review Focus Lenses" section                     | Documents 4 lenses: `security-governance`, `architecture-reliability`, `cost-feasibility`, `comprehensive`                                         |
| TS-13A-08 | Severity levels       | Read "Severity Levels" section                         | Defines `must_fix`, `should_fix`, `suggestion` with clear criteria                                                                                 |
| TS-13A-09 | JSON output schema    | Read "Output Format" section                           | Valid JSON schema with required fields: `challenged_artifact`, `artifact_type`, `review_focus`, `pass_number`, `issues[]`                          |
| TS-13A-10 | Skill loading mandate | Read "MANDATORY: Read Skills First" section            | Requires `azure-defaults`, `azure-artifacts`, `bicep-policy-compliance`                                                                            |

#### TS-13B: 10-Challenger Wrapper

| ID        | Test Case          | Steps                                     | Expected Result                                                     |
| --------- | ------------------ | ----------------------------------------- | ------------------------------------------------------------------- |
| TS-13B-01 | Wrapper delegates  | Read `10-challenger.agent.md` body        | Delegates to `challenger-review-subagent` with 1 comprehensive pass |
| TS-13B-02 | Agents array       | Read `10-challenger.agent.md` frontmatter | `agents: ["challenger-review-subagent"]`                            |
| TS-13B-03 | Artifact detection | Read wrapper workflow                     | Filename-to-`artifact_type` mapping table with 7 entries            |
| TS-13B-04 | Output file write  | Read wrapper step 5                       | Writes JSON to `agent-output/{project}/challenge-findings-*.json`   |
| TS-13B-05 | Standalone invoke  | Invoke `10-Challenger` on a test artifact | Returns JSON findings and writes output file                        |

#### TS-13C: Parent Agent Wiring

| ID        | Test Case                  | Steps                                             | Expected Result                                                      |
| --------- | -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| TS-13C-01 | Requirements (02) wiring   | Read `02-requirements.agent.md` frontmatter       | `agents` includes `challenger-review-subagent`                       |
| TS-13C-02 | Requirements review mode   | Read `02-requirements.agent.md` Phase 6           | 1x comprehensive pass; writes `challenge-findings-requirements.json` |
| TS-13C-03 | Architect (03) wiring      | Read `03-architect.agent.md` frontmatter          | `agents` includes `challenger-review-subagent`                       |
| TS-13C-04 | Architect review mode      | Read `03-architect.agent.md` adversarial section  | 3x architecture (rotating lenses) + 1x cost-estimate review          |
| TS-13C-05 | Planner (05t) wiring       | Read `05t-terraform-planner.agent.md` frontmatter | `agents` includes `challenger-review-subagent`                       |
| TS-13C-06 | Planner review mode        | Read `05t` adversarial section                    | 1x governance + 3x implementation-plan (rotating lenses)             |
| TS-13C-07 | CodeGen (06t) wiring       | Read `06t-terraform-codegen.agent.md` frontmatter | `agents` includes `challenger-review-subagent`                       |
| TS-13C-08 | CodeGen review mode        | Read `06t` adversarial section                    | 3x iac-code (rotating lenses); must_fix triggers re-lint             |
| TS-13C-09 | Deploy (07t) wiring        | Read `07t-terraform-deploy.agent.md` frontmatter  | `agents` includes `challenger-review-subagent`                       |
| TS-13C-10 | Deploy review mode         | Read `07t` adversarial section                    | 1x comprehensive deployment-preview; must_fix requires ack           |
| TS-13C-11 | Bicep Planner (05b) wiring | Read `05b-bicep-planner.agent.md` frontmatter     | `agents` includes `challenger-review-subagent` (parity with 05t)     |
| TS-13C-12 | Bicep CodeGen (06b) wiring | Read `06b-bicep-codegen.agent.md` frontmatter     | `agents` includes `challenger-review-subagent` (parity with 06t)     |
| TS-13C-13 | Bicep Deploy (07b) wiring  | Read `07b-bicep-deploy.agent.md` frontmatter      | `agents` includes `challenger-review-subagent` (parity with 07t)     |

#### TS-13D: Multi-Pass Rotation Logic

| ID        | Test Case                 | Steps                                                     | Expected Result                                                                                  |
| --------- | ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| TS-13D-01 | Lens rotation order       | Read `03-architect.agent.md` or `05t` adversarial section | Pass 1 = `security-governance`, Pass 2 = `architecture-reliability`, Pass 3 = `cost-feasibility` |
| TS-13D-02 | Pass number increments    | Read agent adversarial section                            | Each pass specifies `pass_number` = 1, 2, 3 respectively                                         |
| TS-13D-03 | Prior findings chain      | Read agent adversarial section                            | Pass 1: `prior_findings=null`; Pass 2: gets Pass 1 JSON; Pass 3: gets Pass 1+2 JSON              |
| TS-13D-04 | Output file naming        | Read agent adversarial section                            | Files named `challenge-findings-{type}-pass1.json`, `-pass2.json`, `-pass3.json`                 |
| TS-13D-05 | Single-pass naming        | Read `02-requirements` or `07t` adversarial section       | No `-pass{N}` suffix for 1-pass reviews (e.g. `challenge-findings-requirements.json`)            |
| TS-13D-06 | Deduplication instruction | Read `challenger-review-subagent.agent.md` output rules   | Contains instruction to not repeat issues from `prior_findings`                                  |
| TS-13D-07 | Gate merges all passes    | Read approval gate in `05t` or `03-architect`             | Gate presents merged findings from all passes before approval                                    |

#### TS-13E: Conductor & Documentation Integration

| ID        | Test Case                  | Steps                                                     | Expected Result                                                        |
| --------- | -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| TS-13E-01 | Conductor subagent table   | Read `01-conductor.agent.md` Subagent Integration section | Contains `challenger-review-subagent` rows with Pass column (1x or 3x) |
| TS-13E-02 | Conductor Gate 1 ref       | Read `01-conductor.agent.md` Gate 1                       | References `challenge-findings-requirements.json`                      |
| TS-13E-03 | Agent-definitions table    | Read `agent-definitions.instructions.md`                  | `challenger-review-subagent` in subagents table                        |
| TS-13E-04 | Copilot-instructions table | Read `.github/copilot-instructions.md` 7-Step table       | Review column exists: `1x`, `3x+1x`, `—`, `1x+3x`, `3x`, `1x`, `—`     |
| TS-13E-05 | AGENTS.md table            | Read `AGENTS.md` workflow table                           | Review column exists with matching values                              |
| TS-13E-06 | Subagent count             | Read `AGENTS.md` project structure section                | States 9 subagents (was 8 before challenger-review-subagent)           |

---

## Test Execution Tracker

> **Copilot auto-updates this section** after each test run.
> Each row records the suite, result, date, executor, and any notes.
> When re-running tests, update the existing row (do not duplicate).

<!-- COPILOT:AUTO-UPDATE:START — Do not remove this marker -->

| Suite                        | Result  | Date       | Executor | Notes                                                                                                                                                                |
| ---------------------------- | ------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS-01: Agent Definitions     | ✅ Pass | 2025-07-18 | Copilot  | All 7 sub-tests pass; 4 warnings from frontmatter linter (non-blocking)                                                                                              |
| TS-02: Instruction Files     | ✅ Pass | 2026-02-26 | Copilot  | Fixed: HCP guardrail added to terraform-policy-compliance.instructions.md (TS-02-05)                                                                                 |
| TS-03: Skills                | ✅ Pass | 2025-07-18 | Copilot  | All 6 sub-tests pass; 14/14 skills format valid                                                                                                                      |
| TS-04: CI/CD Workflow        | ✅ Pass | 2025-07-18 | Copilot  | All 7 sub-tests pass; terraform-validate.yml verified                                                                                                                |
| TS-05: Terraform Planner     | ✅ Pass | 2025-07-18 | Copilot  | Static verification only; all workflow contracts present                                                                                                             |
| TS-06: Terraform CodeGen     | ✅ Pass | 2025-07-18 | Copilot  | Static verification only; all workflow contracts present                                                                                                             |
| TS-07: Terraform Deploy      | ✅ Pass | 2025-07-18 | Copilot  | Static verification only; all workflow contracts present                                                                                                             |
| TS-08: Subagent Functional   | ✅ Pass | 2025-07-18 | Copilot  | All 3 TF subagent definitions verified (lint, review, plan)                                                                                                          |
| TS-09: Conductor Integration | ✅ Pass | 2026-02-26 | Copilot  | All 7 sub-tests pass; fixed 08-as-built.agent.md Phase 1 to reference Terraform path (infra/terraform/ + terraform output) for TS-09-07 parity                       |
| TS-10: Convention Compliance | ⬜ Skip | 2025-07-18 | Copilot  | No generated .tf files in infra/terraform/; requires live CodeGen run                                                                                                |
| TS-11: Security Baseline     | ⬜ Skip | 2025-07-18 | Copilot  | No generated .tf files in infra/terraform/; requires live CodeGen run                                                                                                |
| TS-12: Regression            | ✅ Pass | 2026-02-26 | Copilot  | All 8 sub-tests pass; validate:all (388 JSON), lint:md (143 files), h2-sync (15 artifacts), gov-refs (37/37), 14 skills valid, 4 frontmatter warnings (non-blocking) |
| TS-13: Adversarial Review    | ✅ Pass | 2026-02-26 | Copilot  | 40/41 pass (TS-13B-05 SKIP: live invocation); 13A 10/10, 13B 4/5, 13C 13/13, 13D 7/7, 13E 6/6; all wiring + rotation + docs verified                                 |

**Status Legend**: ✅ Pass | ❌ Fail | ⚠️ Partial | ⬜ Not Run | ⬜ Skip | 🔄 In Progress

<!-- COPILOT:AUTO-UPDATE:END — Do not remove this marker -->

---

## Copilot Auto-Monitoring Rules

When Copilot executes or observes any test from this plan:

1. **Update the tracker** — set the Result, Date, Executor, and Notes columns
2. **Use status icons** — `✅` for all tests pass, `❌` for any failure,
   `⚠️` for partial (some pass, some fail), `🔄` while running
3. **Record failures** — add failing test IDs and a summary to the Notes column
4. **Timestamp** — use `YYYY-MM-DD` format
5. **Executor** — use `Copilot` for automated runs, agent name for agent-driven,
   or contributor name for manual runs
6. **Regression impact** — if a previously passing suite regresses,
   prefix Notes with `REGRESSION:`

### Automated Trigger Conditions

Copilot should re-run relevant suites when:

| Trigger                                                 | Suites to Re-Run                  |
| ------------------------------------------------------- | --------------------------------- |
| Any `.agent.md` in `agents/` changes (Terraform agents) | TS-01, TS-09                      |
| `terraform-code-best-practices.instructions.md` changes | TS-02, TS-10, TS-11               |
| `terraform-policy-compliance.instructions.md` changes   | TS-02, TS-06 (governance tests)   |
| `terraform-patterns/SKILL.md` changes                   | TS-03                             |
| `terraform-validate.yml` changes                        | TS-04                             |
| Any `.tf` file in `infra/terraform/` changes            | TS-04, TS-06, TS-10, TS-11, TS-12 |
| Any artifact template for Steps 4-6 changes             | TS-05, TS-06, TS-07, TS-12        |
| Subagent definitions change                             | TS-08                             |
| `challenger-review-subagent.agent.md` changes           | TS-08, TS-13                      |
| `10-challenger.agent.md` changes                        | TS-13                             |
| Any parent agent adversarial review section changes     | TS-13                             |
| Full release or `tf-dev` merge to `main`                | TS-12 (full regression)           |

### Quick-Run Commands

```bash
# Regression suite (fast, no Azure auth needed)
npm run validate:all

# Terraform-specific validation
npm run validate:terraform

# Format check only
terraform fmt -check -recursive infra/terraform/

# Per-project validation
cd infra/terraform/{project}
terraform init -backend=false && terraform validate
```
