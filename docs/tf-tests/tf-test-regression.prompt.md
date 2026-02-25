---
description: 'Run the full Terraform regression suite after any TF-related change (TS-12)'
agent: 'agent'
tools:
  - execute/runInTerminal
  - read/readFile
  - search/textSearch
  - search/listDirectory
  - edit/editFiles
---

# Test: Terraform Regression Suite (TS-12)

Run test suite TS-12 from the Terraform E2E test plan — the full
regression suite that should be executed after any change to Terraform
agents, instructions, skills, or infrastructure code.

## Mission

Execute all automated validation scripts and verify the Terraform
capability has no regressions. This is the fast-feedback suite that
requires no Azure authentication.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-12 for test cases
- `npm install` must be completed
- Terraform CLI must be on `PATH`

## Workflow

### TS-12-01: Full Validation Suite

```bash
npm run validate:all
```

All checks must pass.

### TS-12-02: Terraform-Specific Validation

```bash
npm run validate:terraform
```

All Terraform projects under `infra/terraform/` must pass.

### TS-12-03: Markdown Linting

```bash
npm run lint:md
```

No errors in Terraform-related documentation (agents, instructions,
skills, docs/tf-tests).

### TS-12-04: Artifact Template Sync

```bash
npm run lint:h2-sync
```

H2 headings in sync for all Terraform-related artifacts.

### TS-12-05: Governance Reference Check

```bash
npm run lint:governance-refs
```

No broken governance references.

### TS-12-06: Agent Frontmatter

```bash
npm run lint:agent-frontmatter
```

All Terraform agents pass.

### TS-12-07: Skill Format

```bash
npm run lint:skills-format
```

`terraform-patterns` skill passes.

### TS-12-08: Instruction References

```bash
npm run validate:instruction-refs
```

All Terraform instruction references valid.

### Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-12 Result, Date, Executor, Notes
- If a previously passing suite regresses, prefix Notes with `REGRESSION:`

## Output Expectations

```text
TS-12: Regression Suite — [PASS/FAIL] (X/8 tests passed)

Individual results:
  TS-12-01 validate:all            — [PASS/FAIL]
  TS-12-02 validate:terraform      — [PASS/FAIL]
  TS-12-03 lint:md                 — [PASS/FAIL]
  TS-12-04 lint:h2-sync            — [PASS/FAIL]
  TS-12-05 lint:governance-refs    — [PASS/FAIL]
  TS-12-06 lint:agent-frontmatter  — [PASS/FAIL]
  TS-12-07 lint:skills-format      — [PASS/FAIL]
  TS-12-08 validate:instruction-refs — [PASS/FAIL]
```
