<!-- ref:phases-v1 -->

# Phase 1 & Phase 2 Detail (azure-prepare)

> Detailed step tables for the two-phase azure-prepare workflow. Loaded by
> `azure-prepare` SKILL.md when the agent needs the per-step references
> behind the high-level Steps summary.

## Phase 1: Planning (BLOCKING — Complete Before Any Execution)

Create `infra/{iac}/{project}/.azure/plan.md` by completing these steps. Do NOT generate
any artifacts until the plan is approved.

| #   | Action                                                           | Reference                                          |
| --- | ---------------------------------------------------------------- | -------------------------------------------------- |
| 0   | **Specialized Tech Check** — see SKILL.md Step 0                 | [specialized-routing.md](./specialized-routing.md) |
| 1   | **Analyze Workspace** — NEW, MODIFY, or MODERNIZE                | [analyze.md](./analyze.md)                         |
| 2   | **Gather Requirements** — classification, scale, budget          | [requirements.md](./requirements.md)               |
| 3   | **Scan Codebase** — components, technologies, dependencies       | [scan.md](./scan.md)                               |
| 4   | **Select Recipe** — AZD (default), AZCLI, Bicep, or Terraform    | [recipe-selection.md](./recipe-selection.md)       |
| 5   | **Plan Architecture** — stack + Azure service mapping            | [architecture.md](./architecture.md)               |
| 6   | **Write Plan** — populate `infra/{iac}/{project}/.azure/plan.md` | [plan-template.md](./plan-template.md)             |
| 7   | **Present Plan** — show plan + ask for approval                  | `infra/{iac}/{project}/.azure/plan.md`             |
| 8   | **Destructive actions require `ask_user`**                       | [Global Rules](./global-rules.md)                  |

> **❌ STOP** — do NOT proceed to Phase 2 until the user approves the plan.

## Phase 2: Execution (Only After Plan Approval)

Update `infra/{iac}/{project}/.azure/plan.md` status after each step.

| #   | Action                                                                                                                 | Reference                              |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **Research Components** — load service references + invoke related skills                                              | [research.md](./research.md)           |
| 2   | **Confirm Azure Context** — subscription + location + provisioning limits                                              | [azure-context.md](./azure-context.md) |
| 3   | **Generate Artifacts** — infrastructure + config files                                                                 | [generate.md](./generate.md)           |
| 4   | **Harden Security** — apply security best practices                                                                    | [security.md](./security.md)           |
| 5   | **⛔ Update plan status to `Ready for Validation`** (mandatory before hand-off; use the `edit` tool)                   | `infra/{iac}/{project}/.azure/plan.md` |
| 6   | **⚠️ Hand off** — invoke **azure-validate**. Prerequisite: Step 5 complete. Deployment is handled by **azure-deploy**. | —                                      |
