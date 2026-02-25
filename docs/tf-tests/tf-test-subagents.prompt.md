---
description: 'Test all Terraform subagents — lint, review, plan (TS-08)'
agent: 'agent'
tools:
  - agent
  - execute/runInTerminal
  - read/readFile
  - edit/createFile
  - edit/editFiles
  - search/listDirectory
  - search/textSearch
argument-hint: 'Provide the test project name with Terraform configs'
---

# Test: Terraform Subagents (TS-08)

Run test suite TS-08 from the Terraform E2E test plan to validate all
three Terraform subagents: `terraform-lint-subagent`,
`terraform-review-subagent`, and `terraform-plan-subagent`.

## Mission

Invoke each subagent directly and verify they produce correct structured
output, handle error conditions, and remain read-only.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-08 for test cases
- `infra/terraform/${input:projectName}/` MUST contain valid `.tf` files
- For plan subagent tests: Azure CLI must be authenticated

## Inputs

| Variable               | Description                                     | Default  |
| ---------------------- | ----------------------------------------------- | -------- |
| `${input:projectName}` | Project name with Terraform configs to validate | Required |

## Workflow

### Lint Subagent Tests (TS-08-01 — TS-08-04)

**TS-08-01: Format check on valid project**

Invoke `terraform-lint-subagent` on `infra/terraform/${input:projectName}/`.
Expect `Status: PASS`, 0 errors, 0 format issues.

**TS-08-02: Format failure**

Create a temporary mis-formatted `.tf` file, run lint subagent.
Expect `Status: FAIL` with format issues reported. Clean up temp file.

**TS-08-03: Validate error**

Create a temporary `.tf` file with a syntax error, run lint subagent.
Expect `Status: FAIL` with error details including file and line.
Clean up temp file.

**TS-08-04: tfsec skip**

Run lint subagent and check if tfsec is available.
If not installed, expect `TFSEC_SKIP` and overall status based on
fmt+validate only.

### Review Subagent Tests (TS-08-05 — TS-08-08)

**TS-08-05: APPROVED on compliant project**

Invoke `terraform-review-subagent` on a project that follows all
conventions. Expect `Status: APPROVED`.

**TS-08-06: NEEDS_REVISION on missing tags**

Invoke on a project missing required tags.
Expect `Status: NEEDS_REVISION` with tag findings.

**TS-08-07: FAILED on security issue**

Invoke on a project with a CRITICAL security issue (e.g., no TLS 1.2).
Expect `Status: FAILED` with critical findings.

**TS-08-08: Governance compliance**

Invoke with governance constraints available. Verify the subagent
checks `azurePropertyPath` translation and policy compliance.

### Plan Subagent Tests (TS-08-09 — TS-08-11)

**TS-08-09: Create-only plan**

Invoke `terraform-plan-subagent` on a new project (no existing state).
Expect `Status: PASS`, all changes are `+` create.

**TS-08-10: Destructive plan (if applicable)**

If a resource removal can be simulated, invoke plan subagent.
Expect `Status: WARNING` with destructive ops flagged.

**TS-08-11: Auth failure**

Invalidate Azure token (if safe), run plan subagent.
Expect `Status: FAIL` with auth error reported.

### Isolation Check (TS-08-12)

**After ALL subagent runs**, verify no `.tf` files were modified.
Run `git status infra/terraform/${input:projectName}/` —
only untracked temp files (already cleaned) should appear.

### Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-08 Result, Date, Executor, Notes

## Output Expectations

```text
TS-08: Subagent Functional — [PASS/FAIL] (X/12 tests passed)
Failing tests: [list any failures with IDs]
```
