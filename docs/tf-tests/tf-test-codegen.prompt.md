---
description: 'Test the Terraform CodeGen agent (06t) end-to-end — TS-06'
agent: '06t-Terraform CodeGen'
model: 'Claude Opus 4.6'
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - search/textSearch
  - search/listDirectory
  - agent
  - terraform/search_modules
  - terraform/get_module_details
  - terraform/get_latest_module_version
  - terraform/search_providers
  - terraform/get_provider_details
  - terraform/get_latest_provider_version
argument-hint: 'Provide the test project name (e.g., tf-test-codegen)'
---

# Test: Terraform CodeGen Agent (TS-06)

Run test suite TS-06 from the Terraform E2E test plan to validate the
`06t-Terraform CodeGen` agent's full workflow.

## Mission

Execute the Terraform CodeGen agent against a test project and verify
all 20 checkpoints defined in TS-06 of the test plan.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-06 for test cases
- `agent-output/${input:projectName}/04-implementation-plan.md` MUST exist
- `agent-output/${input:projectName}/04-governance-constraints.json` MUST exist
- `agent-output/${input:projectName}/04-governance-constraints.md` MUST exist
- Azure CLI should be authenticated for Terraform Registry queries

## Inputs

| Variable               | Description                                      | Default  |
| ---------------------- | ------------------------------------------------ | -------- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Prerequisites Gate (TS-06-01)

Verify `04-implementation-plan.md` exists. If missing, confirm agent
stops correctly.

### Step 2: Run the CodeGen Agent

Invoke the full `06t-Terraform CodeGen` workflow. Observe and verify:

- **TS-06-02**: Preflight check runs, saves `04-preflight-check.md`
- **TS-06-03**: Governance compliance mapping reads
  `04-governance-constraints.json` and translates `azurePropertyPath`
- **TS-06-14**: Delegates to `terraform-lint-subagent`
- **TS-06-15**: Delegates to `terraform-review-subagent`

### Step 3: Verify File Structure (TS-06-04 — TS-06-06)

List `infra/terraform/${input:projectName}/` and confirm:

- `main.tf`, `variables.tf`, `outputs.tf`, `providers.tf`,
  `versions.tf`, `locals.tf`, `backend.tf`
- `bootstrap-backend.sh` AND `bootstrap-backend.ps1`
- `deploy.sh` AND `deploy.ps1`

### Step 4: Code Quality Checks (TS-06-07 — TS-06-13)

Read generated `.tf` files and verify:

- **TS-06-07**: AVM-TF modules used (`Azure/avm-res-*/azurerm`)
- **TS-06-08**: Provider pinned to `~> 4.0` in `versions.tf`
- **TS-06-09**: `backend "azurerm"` in `backend.tf` (no HCP)
- **TS-06-10**: Unique suffix generated once in `locals.tf`
- **TS-06-11**: Tags include 4 required tags at minimum
- **TS-06-12**: Security baseline (TLS 1.2, HTTPS, managed identity)
- **TS-06-13**: `var.deployment_phase` if plan is phased

### Step 5: Terraform Validation (TS-06-16 — TS-06-17)

```bash
cd infra/terraform/${input:projectName}
terraform init -backend=false
terraform validate
terraform fmt -check -recursive .
```

### Step 6: Verify Artifacts (TS-06-18 — TS-06-20)

- **TS-06-18**: `05-implementation-reference.md` exists
- **TS-06-19**: `npm run lint:artifact-templates` passes
- **TS-06-20**: No hardcoded secrets in `.tf` files

### Step 7: Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-06 Result, Date, Executor, Notes

## Output Expectations

```text
TS-06: Terraform CodeGen — [PASS/FAIL] (X/20 tests passed)
Failing tests: [list any failures with IDs]
```
