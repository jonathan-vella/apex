---
description: 'Test the Terraform Deploy agent (07t) end-to-end — TS-07'
agent: '07t-Terraform Deploy'
model: 'Claude Sonnet 4.6'
tools:
  - execute/runInTerminal
  - execute/getTerminalOutput
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - search/listDirectory
  - search/textSearch
  - vscode/askQuestions
  - terraform/search_providers
  - terraform/get_provider_details
argument-hint: 'Provide the test project name (e.g., tf-test-deploy)'
---

# Test: Terraform Deploy Agent (TS-07)

Run test suite TS-07 from the Terraform E2E test plan to validate the
`07t-Terraform Deploy` agent's full workflow.

## Mission

Execute the Terraform Deploy agent against a test project and verify
all 11 checkpoints defined in TS-07 of the test plan.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-07 for test cases
- `infra/terraform/${input:projectName}/main.tf` MUST exist
- `agent-output/${input:projectName}/05-implementation-reference.md` MUST exist
- Azure CLI MUST be authenticated (`az account get-access-token` succeeds)

## Inputs

| Variable               | Description                                      | Default  |
| ---------------------- | ------------------------------------------------ | -------- |
| `${input:projectName}` | Project name matching `infra/terraform/` folder  | Required |
| `${input:environment}`  | Target environment                               | dev      |

## Workflow

### Step 1: Auth Validation (TS-07-01)

Verify agent runs `az account get-access-token` — not just
`az account show`.

### Step 2: Backend Verification (TS-07-02)

Verify agent checks storage account existence and offers bootstrap
if missing.

### Step 3: Pre-Deploy Validation (TS-07-03)

Verify agent runs:

```bash
terraform init
terraform validate
terraform fmt -check
```

### Step 4: Plan Preview (TS-07-04)

Verify agent runs `terraform plan -out=tfplan` and classifies changes
into create/update/destroy/replace.

### Step 5: Destructive Ops Gate (TS-07-05)

If plan shows destroy or replace operations, verify agent STOPS and
requires explicit approval.

### Step 6: Phased Deployment (TS-07-06)

If implementation plan specifies phased deployment, verify agent deploys
one phase at a time with `var.deployment_phase`.

### Step 7: Approval Gate (TS-07-07)

Verify agent waits for explicit user approval before `terraform apply`.

### Step 8: Post-Deploy Verification (TS-07-08)

After apply, verify agent runs `terraform output` and Azure Resource
Graph queries.

### Step 9: Deployment Summary (TS-07-09)

Verify `agent-output/${input:projectName}/06-deployment-summary.md`
is generated.

### Step 10: Plan-Only Mode (TS-07-10)

Test the "Run Plan Only" path — verify `terraform apply` is NOT executed.

### Step 11: Template Compliance (TS-07-11)

```bash
npm run lint:artifact-templates
```

### Step 12: Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-07 Result, Date, Executor, Notes

## Output Expectations

```text
TS-07: Terraform Deploy — [PASS/FAIL] (X/11 tests passed)
Failing tests: [list any failures with IDs]
```
