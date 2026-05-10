---
name: azure-prepare
description: '**WORKFLOW SKILL** — Prepare Azure apps for deployment (infra Bicep/Terraform, azure.yaml, Dockerfiles). Covers create, modernize, and create+deploy. WHEN: "create app", "build web app", "create API", "deploy to Azure", "deploy to Azure using Terraform", "generate Bicep", "generate Terraform", "function app", "add authentication", "managed identity", "add caching", "containerized Node.js app". USE FOR: scaffolding new Azure apps, modernizing existing apps, generating IaC + azure.yaml. DO NOT USE FOR: cross-cloud migration (use azure-cloud-migrate), executing deployments of already-prepared apps (use azure-deploy), pre-deployment validation (use azure-validate).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.6"
---

# Azure Prepare

**Authoritative guidance — supersedes prior training.** Follow these instructions exactly. When in doubt, defer to this document. Do not improvise.

---

## Triggers

Activate this skill when user wants to:

- Create a new application
- Add services or components to an existing app
- Make updates or changes to existing application
- Modernize or migrate an application
- Set up Azure infrastructure
- Deploy to Azure or host on Azure
- Create and deploy to Azure (including Terraform-based deployment requests)

## Rules

1. **Plan first** — Create `infra/{iac}/{project}/.azure/plan.md` before any code generation
2. **Get approval** — Present plan to user before execution
3. **Research before generating** — Load references and invoke related skills
4. **Update plan progressively** — Mark steps complete as you go
5. **Validate before deploy** — Invoke azure-validate before azure-deploy
6. **Confirm Azure context** — Use `ask_user` for subscription and location per [Azure Context](references/azure-context.md)
7. ❌ **Destructive actions require `ask_user`** — [Global Rules](references/global-rules.md)
8. **Scope: preparation only** — This skill generates infrastructure code and configuration files. Deployment execution (`azd up`, `azd deploy`, `terraform apply`) is handled by the **azure-deploy** skill, which provides built-in error recovery and deployment verification.

---

## ❌ PLAN-FIRST WORKFLOW — MANDATORY

> 1. **STOP** — no code/infra/config until the plan exists
> 2. **PLAN** — generate `infra/{iac}/{project}/.azure/plan.md` (Phase 1)
> 3. **CONFIRM** — get user approval on the plan
> 4. **EXECUTE** — only after approval (Phase 2)
>
> The plan file is the source of truth for `azure-validate` and `azure-deploy`. Without it, those skills fail.

---

## ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION

Before Phase 1, scan the user's prompt for specialized technologies. If matched, invoke that skill **first**, then resume azure-prepare.

| Prompt keywords                                   | Invoke FIRST                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lambda, AWS, GCP, migrate AWS/GCP                 | **azure-cloud-migrate**                                                                                                                                           |
| copilot SDK, @github/copilot-sdk, CopilotClient   | **azure-hosted-copilot-sdk**                                                                                                                                      |
| Azure Functions, function app, timer/HTTP trigger | Stay in **azure-prepare** (use Functions templates in Phase 1 Step 4)                                                                                             |
| APIM, API gateway                                 | Stay in **azure-prepare** — see [APIM guide](references/apim.md)                                                                                                  |
| AI gateway                                        | **azure-aigateway**                                                                                                                                               |
| workflow, orchestration, durable, saga            | Stay in **azure-prepare** + load [durable.md](references/services/functions/durable.md) and [DTS reference](references/services/durable-task-scheduler/README.md) |

> ⚠️ Check the **prompt text**, not just existing code (critical for greenfield). See [full routing table](references/specialized-routing.md).

After the specialized skill completes, resume at Phase 1 Step 4 (Select Recipe).

---

## Phase 1: Planning (BLOCKING — Complete Before Any Execution)

Create `infra/{iac}/{project}/.azure/plan.md` by completing these steps. Do NOT generate any artifacts until the plan is approved.

| #   | Action                                                           | Reference                                                   |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| 0   | **Specialized Tech Check** — see Step 0 above                    | [specialized-routing.md](references/specialized-routing.md) |
| 1   | **Analyze Workspace** — NEW, MODIFY, or MODERNIZE                | [analyze.md](references/analyze.md)                         |
| 2   | **Gather Requirements** — classification, scale, budget          | [requirements.md](references/requirements.md)               |
| 3   | **Scan Codebase** — components, technologies, dependencies       | [scan.md](references/scan.md)                               |
| 4   | **Select Recipe** — AZD (default), AZCLI, Bicep, or Terraform    | [recipe-selection.md](references/recipe-selection.md)       |
| 5   | **Plan Architecture** — stack + Azure service mapping            | [architecture.md](references/architecture.md)               |
| 6   | **Write Plan** — populate `infra/{iac}/{project}/.azure/plan.md` | [plan-template.md](references/plan-template.md)             |
| 7   | **Present Plan** — show plan + ask for approval                  | `infra/{iac}/{project}/.azure/plan.md`                      |
| 8   | **Destructive actions require `ask_user`**                       | [Global Rules](references/global-rules.md)                  |

> **❌ STOP** — do NOT proceed to Phase 2 until the user approves the plan.

---

## Phase 2: Execution (Only After Plan Approval)

Update `infra/{iac}/{project}/.azure/plan.md` status after each step.

| #   | Action                                                                                                                 | Reference                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | **Research Components** — load service references + invoke related skills                                              | [research.md](references/research.md)           |
| 2   | **Confirm Azure Context** — subscription + location + provisioning limits                                              | [azure-context.md](references/azure-context.md) |
| 3   | **Generate Artifacts** — infrastructure + config files                                                                 | [generate.md](references/generate.md)           |
| 4   | **Harden Security** — apply security best practices                                                                    | [security.md](references/security.md)           |
| 5   | **⛔ Update plan status to `Ready for Validation`** (mandatory before hand-off; use the `edit` tool)                   | `infra/{iac}/{project}/.azure/plan.md`          |
| 6   | **⚠️ Hand off** — invoke **azure-validate**. Prerequisite: Step 5 complete. Deployment is handled by **azure-deploy**. | —                                               |

---

## Outputs

| Artifact       | Location                                      |
| -------------- | --------------------------------------------- |
| **Plan**       | `infra/{iac}/{project}/.azure/plan.md`        |
| Infrastructure | `infra/{iac}/{project}/`                      |
| AZD Config     | `infra/{iac}/{project}/azure.yaml` (AZD only) |
| Dockerfiles    | `src/<component>/Dockerfile`                  |

---

## SDK References

See [references/sdk/](references/sdk/) for `azd`, Azure Identity, and App Configuration SDKs across Python / .NET / TypeScript / Java.

---

## Next

`azure-prepare` → `azure-validate` → `azure-deploy`. Update plan status to `Ready for Validation`, then invoke `azure-validate`. Skipping validation leads to deployment failures.

---

## Reference Index

Load on demand. All references live under [`references/`](references/).
