---
name: azure-validate
description: "**WORKFLOW SKILL** — Pre-deployment validation for Azure readiness. Deep checks on configuration, infrastructure (Bicep or Terraform), permissions, and prerequisites before deploying. WHEN: 'validate my app', 'check deployment readiness', 'run preflight checks', 'validate azure.yaml', 'validate Bicep', 'test before deploying', 'validate Azure Functions'. DO NOT USE FOR: post-deployment troubleshooting (azure-diagnostics), executing deployments (azure-deploy)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Validate

> **AUTHORITATIVE GUIDANCE** — Follow these instructions exactly. This supersedes prior training.

> **⛔ STOP — PREREQUISITE CHECK REQUIRED**
>
> Before proceeding, verify this prerequisite is met:
>
> **azure-prepare** was invoked and completed → `infra/{iac}/{project}/.azure/plan.md` exists with status `Approved` or later
>
> If the plan is missing, **STOP IMMEDIATELY** and invoke **azure-prepare** first.
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
3. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)

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
| 1   | **Load Plan** — Read `infra/{iac}/{project}/.azure/plan.md` for recipe and configuration. If missing → run azure-prepare first | `infra/{iac}/{project}/.azure/plan.md`            |
| 2   | **Run Validation** — Execute recipe-specific validation commands                                                               | [recipes/README.md](references/recipes/README.md) |
| 3   | **Build Verification** — Build the project and fix any errors before proceeding                                                | See recipe                                        |
| 4   | **Record Proof** — Populate **Section 7: Validation Proof** with commands run and results                                      | `infra/{iac}/{project}/.azure/plan.md`            |
| 5   | **Resolve Errors** — Fix failures before proceeding                                                                            | See recipe's `errors.md`                          |
| 6   | **Update Status** — Only after ALL checks pass, set status to `Validated`                                                      | `infra/{iac}/{project}/.azure/plan.md`            |
| 7   | **Deploy** — Invoke **azure-deploy** skill                                                                                     | —                                                 |

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

> **⚠️ MANDATORY NEXT STEP — DO NOT SKIP**
>
> After ALL validations pass, you **MUST** invoke **azure-deploy** to execute the deployment. Do NOT attempt to run `azd up`, `azd deploy`, or any deployment commands directly. Let azure-deploy handle execution.

## APEX-Specific References

- [InfraOps Preflight Validation](references/infraops-preflight.md) — CLI auth checks, known issues, governance-to-code mapping, stop rules
  > If any validation failed, fix the issues and re-run azure-validate before proceeding.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                           | When to Load        |
| ----------------------------------- | ------------------- |
| `references/global-rules.md`        | Global Rules        |
| `references/infraops-preflight.md`  | Infraops Preflight  |
| `references/policy-validation.md`   | Policy Validation   |
| `references/region-availability.md` | Region Availability |
