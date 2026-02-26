---
description: "Run ALL Terraform test suites end-to-end (TS-01 through TS-13)"
agent: "01-Conductor"
model: "Claude Opus 4.6"
tools:
  - agent
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - execute/runInTerminal
  - search/codebase
  - search/listDirectory
  - search/textSearch
  - vscode/askQuestions
  - terraform/search_modules
  - terraform/get_module_details
  - terraform/get_latest_module_version
  - terraform/search_providers
  - terraform/get_provider_details
  - terraform/get_latest_provider_version
argument-hint: "Describe a test Azure project for full Terraform E2E testing"
---

# Test: Full Terraform E2E (All Suites)

Run ALL test suites (TS-01 through TS-13) from the Terraform E2E test plan.
This is the comprehensive test that validates every aspect of the Terraform
capability.

## Mission

Execute the complete Terraform test plan end-to-end: static validation,
agent workflows, subagent functional tests, Conductor integration,
convention/security compliance, and regression checks.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` for the full test plan
- Azure CLI must be authenticated (`az account get-access-token` succeeds)
- `npm install` completed
- Terraform CLI >= 1.9 on `PATH`
- Python venv activated with dependencies installed
- This is a long-running test — budget adequate time

## Inputs

| Variable                      | Description                                 | Default       |
| ----------------------------- | ------------------------------------------- | ------------- |
| `${input:projectName}`        | Test project name (kebab-case)              | `tf-e2e-test` |
| `${input:projectDescription}` | Brief workload description for requirements | Required      |

## Workflow

Execute test suites in this order. Each suite maps to a dedicated prompt
that can also be run independently.

### Phase 1: Static Validation (no Azure auth needed)

Run the tests from `/tf-test-static-validation`:

1. **TS-01**: Agent Definition Validation
2. **TS-02**: Instruction File Validation
3. **TS-03**: Skill Validation
4. **TS-04**: CI/CD Workflow Validation

### Phase 2: Conductor-Driven Workflow

Run the Conductor through the full Terraform path (TS-09 covers this).
This implicitly exercises:

1. **TS-05**: Terraform Planner (via `/tf-test-planner`)
2. **TS-06**: Terraform CodeGen (via `/tf-test-codegen`)
3. **TS-07**: Terraform Deploy (via `/tf-test-deploy`)

### Phase 3: Subagent Functional Tests

1. **TS-08**: Subagent tests (via `/tf-test-subagents`)

### Phase 3.5: Adversarial Review Validation

1. **TS-13**: Adversarial review tests (via `/tf-test-adversarial`)

### Phase 4: Post-Generation Compliance

After code generation, run against the generated configs:

1. **TS-10**: Convention Compliance (via `/tf-test-compliance`)
2. **TS-11**: Security Baseline (via `/tf-test-compliance`)

### Phase 5: Regression

1. **TS-09**: Conductor Integration (verified in Phase 2)
2. **TS-12**: Regression Suite (via `/tf-test-regression`)

### Final: Update Test Tracker

Update ALL rows in the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md` with results.

## Output Expectations

Full summary table:

```text
TERRAFORM E2E TEST RESULTS
══════════════════════════
TS-01: Agent Definitions      — [PASS/FAIL]
TS-02: Instruction Files      — [PASS/FAIL]
TS-03: Skills                 — [PASS/FAIL]
TS-04: CI/CD Workflow         — [PASS/FAIL]
TS-05: Terraform Planner      — [PASS/FAIL]
TS-06: Terraform CodeGen      — [PASS/FAIL]
TS-07: Terraform Deploy       — [PASS/FAIL]
TS-08: Subagent Functional    — [PASS/FAIL]
TS-09: Conductor Integration  — [PASS/FAIL]
TS-10: Convention Compliance  — [PASS/FAIL]
TS-11: Security Baseline      — [PASS/FAIL]
TS-12: Regression             — [PASS/FAIL]
TS-13: Adversarial Review      — [PASS/FAIL]

Overall: [X/13 suites passed]
```

## Related Prompts

| Prompt                       | Suites        |
| ---------------------------- | ------------- |
| `/tf-test-static-validation` | TS-01 — TS-04 |
| `/tf-test-planner`           | TS-05         |
| `/tf-test-codegen`           | TS-06         |
| `/tf-test-deploy`            | TS-07         |
| `/tf-test-subagents`         | TS-08         |
| `/tf-test-conductor`         | TS-09         |
| `/tf-test-compliance`        | TS-10, TS-11  |
| `/tf-test-regression`        | TS-12         |
| `/tf-test-adversarial`       | TS-13         |
