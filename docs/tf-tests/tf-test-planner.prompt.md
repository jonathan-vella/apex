---
description: 'Test the Terraform Planner agent (05t) end-to-end — TS-05'
agent: '05t-Terraform Planner'
model: 'Claude Opus 4.6'
tools:
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - search/listDirectory
  - agent
  - vscode/askQuestions
  - terraform/search_modules
  - terraform/get_module_details
  - terraform/get_latest_module_version
  - terraform/search_providers
  - terraform/get_provider_details
  - terraform/get_latest_provider_version
argument-hint: 'Provide the test project name (e.g., tf-test-plan)'
---

# Test: Terraform Planner Agent (TS-05)

Run test suite TS-05 from the Terraform E2E test plan to validate the
`05t-Terraform Planner` agent's full workflow.

## Mission

Execute the Terraform Planner agent against a test project and verify
every checkpoint defined in TS-05 of the test plan.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-05 for test cases
- `agent-output/${input:projectName}/02-architecture-assessment.md` MUST exist
- `agent-output/${input:projectName}/01-requirements.md` MUST exist
  with `iac_tool: terraform`
- Azure CLI must be authenticated (`az account get-access-token` succeeds)

## Inputs

| Variable               | Description                                      | Default  |
| ---------------------- | ------------------------------------------------ | -------- |
| `${input:projectName}` | Project name matching the `agent-output/` folder | Required |

## Workflow

### Step 1: Verify Prerequisites (TS-05-02)

Check that `02-architecture-assessment.md` exists. If missing, report
TS-05-02 as PASS (agent correctly stops) or FAIL (agent proceeds).

### Step 2: Run the Planner

Invoke the full `05t-Terraform Planner` workflow for the project.
Observe and verify each checkpoint:

- **TS-05-01**: Agent reads `azure-defaults`, `azure-artifacts`,
  `terraform-patterns` skills before planning
- **TS-05-03**: Agent delegates to `governance-discovery-subagent`
- **TS-05-04**: Agent queries `terraform/search_modules` and
  `terraform/get_module_details` for each resource
- **TS-05-05**: Agent asks user for phased vs single deployment
- **TS-05-06**: Agent invokes `10-Challenger` after plan generation
- **TS-05-07**: Agent presents approval gate with plan summary

### Step 3: Verify Output Artifacts (TS-05-08)

Check `agent-output/${input:projectName}/` for:

- `04-implementation-plan.md`
- `04-governance-constraints.md`
- `04-governance-constraints.json`
- `04-dependency-diagram.py`
- `04-runtime-diagram.py`

### Step 4: Verify HCP Guardrail (TS-05-09)

Search generated `04-implementation-plan.md` for:

- No `terraform { cloud {} }` patterns
- Backend is Azure Storage Account

### Step 5: Validate Templates (TS-05-10)

```bash
npm run lint:artifact-templates
```

### Step 6: Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-05 Result, Date, Executor, Notes

## Output Expectations

```text
TS-05: Terraform Planner — [PASS/FAIL] (X/10 tests passed)
Failing tests: [list any failures with IDs]
```
