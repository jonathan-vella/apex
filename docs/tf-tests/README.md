# Terraform Test Documentation

> [Current Version](../../VERSION.md) | Test plans, prompts, and tracking
> for the Terraform capability

This folder contains test plans, test prompts, and tracking documents
for the Terraform capability in the Agentic InfraOps project.

## Step-by-Step Testing Guide

Follow this guide from top to bottom. Each level builds on the
previous one, so start with Level 1 and work your way up.

### Prerequisites

Before running any tests, ensure your environment is ready:

```bash
npm install                  # Validation scripts
terraform --version          # Must be >= 1.9
```

For Levels 3-5 you also need:

```bash
az account get-access-token  # Azure auth (must succeed)
source .venv/bin/activate    # Python venv for diagrams
```

### How to Invoke a Prompt

Open VS Code Chat (`Ctrl+Shift+I`), type a `#file:` reference to the
prompt, then press Enter. Example:

```text
#file:docs/tf-tests/tf-test-regression.prompt.md
```

Copilot reads the prompt and runs the test suite autonomously.
See [How to Run](terraform-e2e-test-plan.md#how-to-run) for
alternative methods.

### Level 1 — Quick Regression (5 min, no Azure auth)

**When**: After any change to TF agents, instructions, skills, or code.
**What**: Runs 8 automated linters/validators.

```text
#file:docs/tf-tests/tf-test-regression.prompt.md
```

| Suites | Auth | What It Checks                                       |
| ------ | ---- | ---------------------------------------------------- |
| TS-12  | No   | validate:all, lint:md, h2-sync, governance-refs, etc |

If this fails, fix the issues before proceeding to any other level.

### Level 2 — Static Validation (15 min, no Azure auth)

**When**: After changing agent definitions, instruction files,
skills, or CI workflows.
**What**: Deep inspection of all Terraform agent/instruction/skill
files plus CI workflow structure.

```text
#file:docs/tf-tests/tf-test-static-validation.prompt.md
```

| Suites        | Auth | What It Checks                                               |
| ------------- | ---- | ------------------------------------------------------------ |
| TS-01 — TS-04 | No   | Agent frontmatter, tool declarations, handoff chains,        |
|               |      | instruction content, skill patterns, CI workflow correctness |

### Level 3 — Agent Workflow Tests (30-60 min each, Azure auth)

**When**: Testing the actual agent behavior end-to-end.
**What**: Each prompt exercises one agent through its full workflow.
Run them in order — each step depends on artifacts from its
predecessor.

**Step A — Planner** (run first):

```text
#file:docs/tf-tests/tf-test-planner.prompt.md
```

> Produces `04-implementation-plan.md`, governance constraints,
> and architecture diagrams in `agent-output/{project}/`.

**Step B — CodeGen** (requires Step A output):

```text
#file:docs/tf-tests/tf-test-codegen.prompt.md
```

> Produces `infra/terraform/{project}/` with all `.tf` files,
> bootstrap and deploy scripts.

**Step C — Deploy** (requires Step B output):

```text
#file:docs/tf-tests/tf-test-deploy.prompt.md
```

> Runs `terraform plan` and (with approval) `terraform apply`.
> Produces `06-deployment-summary.md`.

| Step | Suites | Agent            | Auth | Depends On       |
| ---- | ------ | ---------------- | ---- | ---------------- |
| A    | TS-05  | `05t-TF Planner` | Yes  | Step 2 artifacts |
| B    | TS-06  | `06t-TF CodeGen` | Yes  | Step A output    |
| C    | TS-07  | `07t-TF Deploy`  | Yes  | Step B output    |

### Level 4 — Cross-Cutting Tests (15 min, varies)

**When**: After a full CodeGen run has produced `.tf` files.
**What**: Validates conventions and security across generated code.

```text
#file:docs/tf-tests/tf-test-subagents.prompt.md
#file:docs/tf-tests/tf-test-compliance.prompt.md
#file:docs/tf-tests/tf-test-adversarial.prompt.md
```

| Suites       | Auth    | What It Checks                                      |
| ------------ | ------- | --------------------------------------------------- |
| TS-08        | Partial | Subagent structured output (lint, review, plan)     |
| TS-10, TS-11 | No      | CAF naming, tags, TLS 1.2, managed identity         |
| TS-13        | Partial | Challenger wiring, multi-pass rotation, JSON output |

> [!NOTE]
> TS-10 and TS-11 are skipped if no `.tf` files exist yet.

### Level 5 — Full Conductor E2E (2+ hours, Azure auth)

**When**: Before merging `tf-dev` to `main`, or for a full release.
**What**: The Conductor orchestrates the entire 7-step workflow
with Terraform as the IaC tool.

```text
#file:docs/tf-tests/tf-test-all.prompt.md
```

| Suites        | Auth | What It Checks         |
| ------------- | ---- | ---------------------- |
| TS-01 — TS-13 | Yes  | Everything, end-to-end |

### Quick Decision Tree

```text
Changed agents/instructions/skills?
  └─ Start at Level 1, then Level 2

Changed .tf code or templates?
  └─ Start at Level 1, then Level 4 (if .tf files exist)

Testing a new project E2E?
  └─ Level 1 → Level 3A → 3B → 3C → Level 4

Pre-merge to main?
  └─ Level 5 (full E2E)
```

---

## Contents

### Test Plan

| Document                                                 | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [terraform-e2e-test-plan.md](terraform-e2e-test-plan.md) | E2E test plan with 13 suites, 100+ test cases, and auto-updated tracker |

### Test Prompts

| Prompt                                                                     | Suites        | Agent                   | Auth    | Level |
| -------------------------------------------------------------------------- | ------------- | ----------------------- | ------- | ----- |
| [tf-test-regression.prompt.md](tf-test-regression.prompt.md)               | TS-12         | `agent`                 | No      | 1     |
| [tf-test-static-validation.prompt.md](tf-test-static-validation.prompt.md) | TS-01 — TS-04 | `agent`                 | No      | 2     |
| [tf-test-planner.prompt.md](tf-test-planner.prompt.md)                     | TS-05         | `05t-Terraform Planner` | Yes     | 3A    |
| [tf-test-codegen.prompt.md](tf-test-codegen.prompt.md)                     | TS-06         | `06t-Terraform CodeGen` | Yes     | 3B    |
| [tf-test-deploy.prompt.md](tf-test-deploy.prompt.md)                       | TS-07         | `07t-Terraform Deploy`  | Yes     | 3C    |
| [tf-test-subagents.prompt.md](tf-test-subagents.prompt.md)                 | TS-08         | `agent`                 | Partial | 4     |
| [tf-test-compliance.prompt.md](tf-test-compliance.prompt.md)               | TS-10, TS-11  | `agent`                 | No      | 4     |
| [tf-test-adversarial.prompt.md](tf-test-adversarial.prompt.md)             | TS-13         | `agent`                 | Partial | 4     |
| [tf-test-conductor.prompt.md](tf-test-conductor.prompt.md)                 | TS-09         | `01-Conductor`          | Yes     | 5     |
| [tf-test-all.prompt.md](tf-test-all.prompt.md)                             | TS-01 — TS-13 | `01-Conductor`          | Yes     | 5     |

## Auto-Monitoring

The test plan includes a **Test Execution Tracker** section that
Copilot auto-updates after each test run with pass/fail status,
timestamps, and notes — keeping the plan current as the Terraform
capability evolves.
