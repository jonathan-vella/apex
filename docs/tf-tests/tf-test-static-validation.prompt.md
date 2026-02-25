---
description: 'Run static validation tests for Terraform agent definitions, instructions, and skills (TS-01 through TS-04)'
agent: 'agent'
tools:
  - execute/runInTerminal
  - read/readFile
  - search/textSearch
  - search/fileSearch
  - search/listDirectory
  - edit/editFiles
---

# Test: Terraform Static Validation (TS-01 — TS-04)

Run test suites TS-01 (Agent Definitions), TS-02 (Instruction Files),
TS-03 (Skills), and TS-04 (CI/CD Workflow) from the Terraform E2E test plan.

## Mission

Execute all static validation tests that require NO Azure authentication
or live infrastructure. Validate structural correctness of agent definitions,
instruction files, skills, and CI/CD workflows for the Terraform capability.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` for the full test definitions
- `npm install` must be completed
- Terraform CLI must be on `PATH`
- No Azure authentication required for these suites

## Workflow

### Step 1: Run Automated Linters

Execute these npm scripts and capture results:

```bash
npm run lint:agent-frontmatter
npm run lint:instruction-frontmatter
npm run lint:skills-format
npm run validate:instruction-refs
```

### Step 2: TS-01 — Agent Definition Validation

For each test case in TS-01:

1. **TS-01-01**: Confirm lint:agent-frontmatter passes for `05t`, `06t`, `07t`,
   and all 3 Terraform subagents
2. **TS-01-02**: Read `05t`, `06t`, `07t` agent files — verify they declare
   all `terraform/*` tools (`search_modules`, `get_module_details`,
   `get_latest_module_version`, `search_providers`, `get_provider_details`,
   `get_latest_provider_version`)
3. **TS-01-03**: Verify handoff chains `05t` → `06t` → `07t` → `08`
4. **TS-01-04**: Read `01-conductor.agent.md` — confirm agents list contains
   `05t-Terraform Planner`, `06t-Terraform CodeGen`, `07t-Terraform Deploy`
5. **TS-01-05**: Verify `06t` references `terraform-lint-subagent` and
   `terraform-review-subagent` in its `agents:` frontmatter
6. **TS-01-06**: Check model declarations (05t: Opus, 06t: Opus/Sonnet,
   07t: Sonnet, subagents: Sonnet)
7. **TS-01-07**: Verify all 3 subagents have `user-invokable: false`

### Step 3: TS-02 — Instruction File Validation

1. **TS-02-01**: Confirm lint:instruction-frontmatter passes for both
   Terraform instruction files
2. **TS-02-02**: Read frontmatter — verify `applyTo` globs are correct
3. **TS-02-03**: Confirm validate:instruction-refs finds no broken references
4. **TS-02-04**: Read `terraform-code-best-practices.instructions.md` —
   confirm AVM-first is marked `MANDATORY`
5. **TS-02-05**: Search both instructions for HCP/cloud guardrails
6. **TS-02-06**: Confirm provider pin is `~> 4.0`
7. **TS-02-07**: Read `terraform-policy-compliance.instructions.md` —
   confirm `azurePropertyPath` translation table exists with 9+ entries

### Step 4: TS-03 — Skill Validation

1. **TS-03-01**: Confirm lint:skills-format passes for `terraform-patterns`
2. **TS-03-02**: Read `terraform-patterns/SKILL.md` — verify all 7 patterns
3. **TS-03-03**: Confirm "AVM Known Pitfalls" section exists
4. **TS-03-04**: Read `azure-defaults/SKILL.md` — find "Terraform Conventions"
5. **TS-03-05**: Extract HCL blocks from skill and spot-check syntax
6. **TS-03-06**: Verify frontmatter compatibility metadata

### Step 5: TS-04 — CI/CD Workflow Validation

1. **TS-04-01**: Read `.github/workflows/terraform-validate.yml` — valid YAML
2. **TS-04-02**: Verify trigger paths for PR and push
3. **TS-04-03**: Confirm Terraform version `~1.9`
4. **TS-04-04**: Confirm `terraform fmt -check` step exists
5. **TS-04-05**: Confirm validate step loops `infra/terraform/*/`
6. **TS-04-06**: Confirm tfsec has `continue-on-error: true`
7. **TS-04-07**: Run `npm run validate:terraform` and verify it exists

### Step 6: Update Test Tracker

After completing all tests, update the
**Test Execution Tracker** in `docs/tf-tests/terraform-e2e-test-plan.md`:

- Set Result for TS-01 through TS-04
- Set Date to today
- Set Executor to `Copilot`
- Add failing test IDs to Notes (if any)

## Output Expectations

Report a summary table:

```text
TS-01: Agent Definitions    — [PASS/FAIL] (X/7 tests passed)
TS-02: Instruction Files    — [PASS/FAIL] (X/7 tests passed)
TS-03: Skills               — [PASS/FAIL] (X/6 tests passed)
TS-04: CI/CD Workflow       — [PASS/FAIL] (X/7 tests passed)
```
