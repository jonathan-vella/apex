---
name: apex-azure-prepare
description: '**WORKFLOW SKILL** — Prepare Azure apps for deployment (Bicep/Terraform, azure.yaml, Dockerfiles). WHEN: "create app", "build web app", "create API", "deploy to Azure", "generate Bicep", "generate Terraform", "function app", "add authentication", "managed identity". DO NOT USE FOR: cross-cloud migration (apex-azure-cloud-migrate), executing deploys (apex-azure-deploy), preflight (apex-azure-validate).'
license: MIT
metadata:
  author: Microsoft
  version: "1.0.6"
---

# Azure Prepare

## Workflow Routing

Before the plan-first workflow or technology routing, resolve workflow identity and requested action per
[`apex-azure-validate`](../apex-azure-validate/SKILL.md#workflow-and-requested-action).
An explicit APEX request or APEX handoff returns to the current step owner via `01-Orchestrator` when unclear.
Do not restart generic planning, create `.azure/plan.md`, or regenerate APEX artifacts through this skill.
A missing APEX manifest/code/handoff returns to `06b-Bicep CodeGen` or `06t-Terraform CodeGen`.
All remaining phases, plan prerequisites, and references here apply to generic application preparation only.
Validation-only does not authorize preparation; report missing prerequisites and stop.

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
5. **Validate before deploy** — Invoke apex-azure-validate before apex-azure-deploy
6. **Confirm Azure context** — Reuse unchanged confirmed values; ask only for missing or invalidated evidence per [Azure Context](references/azure-context.md#confirmation-reuse)
7. ❌ **Destructive actions require `ask_user`** — [Global Rules](references/global-rules.md)
8. **Scope: preparation only** — This skill generates infrastructure code and configuration files. Deployment execution (`azd up`, `azd deploy`, `terraform apply`) is handled by the **apex-azure-deploy** skill, which provides built-in error recovery and deployment verification.

---

## ❌ PLAN-FIRST WORKFLOW — MANDATORY

> 1. **STOP** — no code/infra/config until the plan exists
> 2. **PLAN** — generate `infra/{iac}/{project}/.azure/plan.md` (Phase 1)
> 3. **CONFIRM** — get user approval on the plan
> 4. **EXECUTE** — only after approval (Phase 2)
>
> The plan file is the source of truth for `apex-azure-validate` and `apex-azure-deploy`. Without it, those skills fail.

---

## ❌ STEP 0: Specialized Technology Check — MANDATORY FIRST ACTION

Before Phase 1, scan the user's prompt for specialized technologies. If matched, invoke that skill **first**, then resume apex-azure-prepare.

| Prompt keywords                                   | Invoke FIRST                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lambda, AWS, GCP, migrate AWS/GCP                 | **apex-azure-cloud-migrate**                                                                                                                                           |
| Azure Functions, function app, timer/HTTP trigger | Stay in **apex-azure-prepare** (use Functions templates in Phase 1 Step 4)                                                                                             |
| APIM, API gateway                                 | Stay in **apex-azure-prepare** — see [APIM guide](references/apim.md)                                                                                                  |
| workflow, orchestration, durable, saga            | Stay in **apex-azure-prepare** + load [durable.md](references/services/functions/durable.md) and [DTS reference](references/services/durable-task-scheduler/README.md) |

> ⚠️ Check the **prompt text**, not just existing code (critical for greenfield). See [full routing table](references/specialized-routing.md).

After the specialized skill completes, resume at Phase 1 Step 4 (Select Recipe).

---

## Steps

Two-phase workflow (full step tables in [`references/phases.md`](references/phases.md)):

1. **Step 0** — Specialized Technology Check (route to `apex-azure-cloud-migrate` when the prompt matches; otherwise continue)
2. **Phase 1 (Planning, BLOCKING)** — Analyze workspace → gather requirements → scan codebase → select recipe (AZD/AZCLI/Bicep/Terraform) → plan architecture → write `infra/{iac}/{project}/.azure/plan.md` → present plan + ask for approval
3. **⛔ Approval gate** — do NOT proceed until the user approves the plan
4. **Phase 2 (Execution, post-approval)** — Research components → confirm Azure context → generate artifacts → harden security → mark plan `Ready for Validation`
5. **Hand off to `apex-azure-validate`** — prerequisite: plan status is `Ready for Validation`. Deployment of the validated artifacts is `apex-azure-deploy`'s job.

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

For generic preparation, update plan status to `Ready for Validation`, then invoke `apex-azure-validate`.
Deployment continuation requires an explicit deployment request and approval; preparation alone does not authorize apply.

---

## Reference Index

Load on demand. All references live under [`references/`](references/).

| Phase / topic              | Reference                                                                       |
| -------------------------- | ------------------------------------------------------------------------------- |
| Phase 1 — Analyze codebase | [`references/analyze.md`](references/analyze.md)                                |
| Phase 1 — Requirements     | [`references/requirements.md`](references/requirements.md)                      |
| Phase 1 — Scan repo state  | [`references/scan.md`](references/scan.md)                                      |
| Phase 1 — Research         | [`references/research.md`](references/research.md)                              |
| Phase 1 — Recipe selection | [`references/recipe-selection.md`](references/recipe-selection.md)              |
| Phase 1 — Architecture     | [`references/architecture.md`](references/architecture.md)                      |
| Phase 1 — Plan template    | [`references/plan-template.md`](references/plan-template.md)                    |
| Phase 2 — Generate code    | [`references/generate.md`](references/generate.md)                              |
| Phase 2 — Harden security  | [`references/security.md`](references/security.md)                              |
| .NET Aspire integration    | [`references/aspire.md`](references/aspire.md)                                  |
| Service limits + quotas    | [`references/resources-limits-quotas.md`](references/resources-limits-quotas.md) |
