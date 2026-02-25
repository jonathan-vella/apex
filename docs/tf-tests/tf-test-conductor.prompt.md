---
description: 'Test Conductor routing through the full Terraform workflow (TS-09)'
agent: '01-Conductor'
model: 'Claude Opus 4.6'
tools:
  - agent
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - search/listDirectory
  - vscode/askQuestions
argument-hint: 'Describe a test Azure project to run through the Terraform workflow'
---

# Test: Conductor Integration — Terraform Path (TS-09)

Run test suite TS-09 from the Terraform E2E test plan to validate the
Conductor agent correctly routes through the Terraform workflow.

## Mission

Start the Conductor with a project that specifies `iac_tool: terraform`
and verify the complete end-to-end workflow routes through Terraform
agents (`05t` → `06t` → `07t`) instead of Bicep agents.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-09 for test cases
- Azure CLI must be authenticated
- This test runs the FULL 7-step workflow — budget adequate time

## Inputs

| Variable                      | Description                                       | Default             |
| ----------------------------- | ------------------------------------------------- | ------------------- |
| `${input:projectName}`        | Test project name (kebab-case)                    | `tf-e2e-test`       |
| `${input:projectDescription}` | Brief workload description for requirements       | Required            |

## Workflow

### Step 1: Start Conductor

Begin the 7-step workflow with the Conductor. When the Requirements
agent generates `01-requirements.md`, ensure `iac_tool: terraform`
is set.

### Step 2: Verify IaC Routing (TS-09-01)

After architecture assessment, verify the Conductor routes to
`05t-Terraform Planner` (NOT `05b-Bicep Planner`) for Step 4.

### Step 3: Full Workflow Execution (TS-09-02)

Walk through the complete flow:

1. `02-Requirements` → `01-requirements.md`
2. `03-Architect` → `02-architecture-assessment.md`
3. (Skip Design if offered — TS-09-06)
4. `05t-Terraform Planner` → `04-implementation-plan.md`
5. `06t-Terraform CodeGen` → `infra/terraform/${input:projectName}/`
6. `07t-Terraform Deploy` → `06-deployment-summary.md`
7. `08-As-Built` → `07-*.md` documentation

### Step 4: Verify Context Flow (TS-09-03)

At each handoff, confirm the receiving agent reads prior artifacts
from `agent-output/${input:projectName}/`.

### Step 5: Verify Approval Gates (TS-09-04)

Confirm the Conductor pauses for human approval at:

- Step 4 (Plan approval)
- Step 5 (Code approval)
- Step 6 (Deploy approval)

### Step 6: Test Backward Handoff (TS-09-05)

At Step 5, request a revision. Verify the Conductor correctly hands
back to `05t-Terraform Planner`.

### Step 7: As-Built Reads TF State (TS-09-07)

After deployment, verify `08-As-Built` reads `terraform output` and
prior artifacts to generate the documentation suite.

### Step 8: Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-09 Result, Date, Executor, Notes

## Output Expectations

```text
TS-09: Conductor Integration — [PASS/FAIL] (X/7 tests passed)
Failing tests: [list any failures with IDs]
```
