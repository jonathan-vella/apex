# Terraform Test Documentation

This folder contains test plans, test prompts, and tracking documents
for the Terraform capability in the Agentic InfraOps project.

## Contents

### Test Plan

| Document                                                 | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [terraform-e2e-test-plan.md](terraform-e2e-test-plan.md) | E2E test plan with 12 suites, 100+ test cases, and auto-updated tracker |

### Test Prompts

Each prompt targets a specific agent and test suite. Use `#file:` in
VS Code Chat to invoke them (see the
[How to Run](terraform-e2e-test-plan.md#how-to-run) section in the
test plan for details).

| Prompt                                                                     | Suites        | Agent                   |
| -------------------------------------------------------------------------- | ------------- | ----------------------- |
| [tf-test-all.prompt.md](tf-test-all.prompt.md)                             | TS-01 — TS-12 | `01-Conductor`          |
| [tf-test-static-validation.prompt.md](tf-test-static-validation.prompt.md) | TS-01 — TS-04 | `agent`                 |
| [tf-test-planner.prompt.md](tf-test-planner.prompt.md)                     | TS-05         | `05t-Terraform Planner` |
| [tf-test-codegen.prompt.md](tf-test-codegen.prompt.md)                     | TS-06         | `06t-Terraform CodeGen` |
| [tf-test-deploy.prompt.md](tf-test-deploy.prompt.md)                       | TS-07         | `07t-Terraform Deploy`  |
| [tf-test-subagents.prompt.md](tf-test-subagents.prompt.md)                 | TS-08         | `agent`                 |
| [tf-test-conductor.prompt.md](tf-test-conductor.prompt.md)                 | TS-09         | `01-Conductor`          |
| [tf-test-compliance.prompt.md](tf-test-compliance.prompt.md)               | TS-10, TS-11  | `agent`                 |
| [tf-test-regression.prompt.md](tf-test-regression.prompt.md)               | TS-12         | `agent`                 |

## Auto-Monitoring

The test plan includes a **Test Execution Tracker** section designed
for Copilot auto-monitoring. After each test run, Copilot updates the
tracker with pass/fail status, timestamps, and notes — ensuring the
plan stays current as the Terraform capability evolves.
