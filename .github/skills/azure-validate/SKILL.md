---
name: azure-validate
description: "**WORKFLOW SKILL** — Pre-deployment validation for Azure: config, infrastructure (Bicep/Terraform), permissions, prerequisites. WHEN: 'validate my app', 'check deployment readiness', 'run preflight checks', 'validate azure.yaml', 'validate Bicep', 'test before deploying', 'validate Azure Functions'. DO NOT USE FOR: post-deploy troubleshooting (azure-diagnostics), executing deploys (azure-deploy)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Validate

## Workflow And Requested Action

Resolve workflow identity before prerequisite checks. An explicit APEX request or handoff from
an APEX step agent uses the APEX branch below. A generic application request uses the generic branch.
If ambiguous (including both kinds of state present), ask which workflow to use; directory location
or a lone manifest is not proof. Never synthesize approval state to select a branch.

- **APEX**: use [InfraOps Preflight](references/infraops-preflight.md) and the shared deploy readiness
  contract. Return findings to the current owner (`06b-Bicep CodeGen` / `06t-Terraform CodeGen` for
  code validation, `07b-Bicep Deploy` / `07t-Terraform Deploy` for deployment preflight).
  No generic `.azure/plan.md` is required. Do not invoke generic preparation, recipes, or deployment.
- **Generic application**: the following plan/proof/recipe workflow applies. An approved preparation
  plan is required; missing prerequisites block validation. Ask before starting preparation when the
  request was validation-only. Only this workflow updates generic plan status to `Validated`.
- **Requested action**: validation-only returns passed, failed, and unperformed checks and stops.
  Preview-only returns the preview as not applied and stops. Successful checks are not permission to deploy.
  Continue to execution only within an explicit deployment request and its separate preview/apply approvals.

## Generic Application Validation

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly. This supersedes prior training.

> **⛔ STOP — PREREQUISITE CHECK REQUIRED**
>
> Before proceeding, verify this prerequisite is met:
>
> **azure-prepare** was invoked and completed → `infra/{iac}/{project}/.azure/plan.md` exists with status `Approved` or later
>
> If the plan is missing, stop and report the prerequisite. Invoke **azure-prepare** only when preparation
> is within the authorized request; validation-only does not authorize it.
>
> The complete workflow ensures success:
>
> `azure-prepare` → `azure-validate` → `azure-deploy`

## Triggers

- Check if app is ready to deploy
- Validate azure.yaml or Bicep
- Run preflight checks
- Troubleshoot deployment errors

## Rules

1. Run after azure-prepare, before azure-deploy
2. All checks must pass—do not deploy with failures
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](../azure-prepare/references/global-rules.md)

## Validation Commands (per recipe)

The per-recipe validation commands are bundled in
[`references/recipes/`](references/recipes/README.md). Common ones:

```bash
azd provision --preview                 # AZD recipes
bicep build infra/bicep/{project}/main.bicep && bicep lint infra/bicep/{project}/main.bicep
terraform fmt -check && terraform validate && npm run validate:terraform
npm run validate:iac-security-baseline  # cross-cutting baseline
npm run validate:all                    # full repo validator suite
```

Load the recipe-specific README to confirm the exact command set for the
project's IaC tool.

## Steps

| #   | Action                                                                                                                         | Reference                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1   | **Load Plan** — Read the generic plan for recipe/configuration; if missing, follow the request-scoped prerequisite rule above | `infra/{iac}/{project}/.azure/plan.md` |
| 2   | **Run Validation** — Execute recipe-specific validation commands                                                               | [recipes/README.md](references/recipes/README.md) |
| 3   | **Build Verification** — Build the project and fix any errors before proceeding                                                | See recipe                                        |
| 4   | **Record Proof** — Populate **Section 7: Validation Proof** with commands run and results                                      | `infra/{iac}/{project}/.azure/plan.md`            |
| 5   | **Resolve Errors** — Fix failures before proceeding                                                                            | See recipe's `errors.md`                          |
| 6   | **Update Status** — Only after ALL checks pass, set status to `Validated`                                                      | `infra/{iac}/{project}/.azure/plan.md`            |
| 7   | **Return results** — Stop for validation-only; authorized deployment requests may continue through azure-deploy approvals | Workflow And Requested Action |

> **⛔ VALIDATION AUTHORITY**
>
> This skill is the **ONLY** authorized way to set plan status to `Validated`. You MUST:
>
> 1. Run actual validation commands (azd provision --preview, bicep build, terraform validate, etc.)
> 2. Populate **Section 7: Validation Proof** with the commands you ran and their results
> 3. Only then set status to `Validated`
>
> Do NOT set status to `Validated` without running checks and recording proof.

---

> **Next action is request-scoped**
>
> Return results for validation-only. For an authorized generic deployment, invoke **azure-deploy**;
> do not execute deployment commands directly. APEX callers return to their owning step agent.

## APEX-Specific References

- [InfraOps Preflight Validation](references/infraops-preflight.md) — CLI auth checks, known issues, governance-to-code mapping, stop rules
  > If any validation failed, fix the issues and re-run azure-validate before proceeding.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                           | When to Load        |
| ----------------------------------- | ------------------- |
| `../azure-prepare/references/global-rules.md` | Global Rules        |
| `references/infraops-preflight.md`  | Infraops Preflight  |
| `references/policy-validation.md`   | Policy Validation   |
| `references/region-availability.md` | Region Availability |
