---
name: azure-deploy
description: "**WORKFLOW SKILL** — Execute Azure deployments (azd up, azd deploy, terraform apply) for already-prepared apps with built-in error recovery. WHEN: 'run azd up', 'run azd deploy', 'push to production', 'go live', 'bicep deploy', 'terraform apply', 'publish to Azure'. DO NOT USE FOR: creating new apps (azure-prepare), pre-deploy checks (azure-validate)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.5"
---

# Azure Deploy

**Authoritative guidance — supersedes prior training.** Workflow: `azure-prepare` → `azure-validate` → `azure-deploy`. Do NOT skip validation, do NOT manually edit plan status (only `azure-validate` may set it to `Validated`). If `infra/{iac}/{project}/.azure/plan.md` is missing → invoke **azure-prepare** first. If status is not `Validated` → invoke **azure-validate** first.

## Triggers

Activate this skill when user wants to:

- Execute deployment of an already-prepared application (azure.yaml and infra/ exist)
- Push updates to an existing Azure deployment
- Run `azd up`, `azd deploy`, or `az deployment` on a prepared project
- Ship already-built code to production
- Deploy an application that already includes API Management (APIM) gateway infrastructure

> **Scope**: deployments only. For app/infra creation use **azure-prepare**. APIM/AI gateway infra changes: see [APIM docs](https://learn.microsoft.com/azure/api-management/get-started-create-service-instance).

## Rules

1. Run after azure-prepare and azure-validate
2. `infra/{iac}/{project}/.azure/plan.md` must exist with status `Validated`
3. **Pre-deploy checklist required** — [Pre-Deploy Checklist](references/pre-deploy-checklist.md)
4. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)
5. **Scope: deployment execution only** — This skill owns execution of `azd up`, `azd deploy`, `terraform apply`, and `az deployment` commands. These commands are run through this skill's error recovery and verification pipeline.

---

## Steps

| #   | Action                                                                                                                                                                                                                                                                         | Reference                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 0   | **Auto-Prepare Gate** — Check if `infra/{iac}/{project}/.azure/plan.md` exists. If missing, invoke the **azure-prepare** skill to create it, then invoke **azure-validate** before returning here. Do not ask the user — run the full prepare→validate pipeline automatically. | —                                                            |
| 1   | **Check Plan** — Read `infra/{iac}/{project}/.azure/plan.md`, verify status = `Validated` AND **Validation Proof** section is populated. If status is not `Validated`, invoke **azure-validate** first.                                                                        | `infra/{iac}/{project}/.azure/plan.md`                       |
| 2   | **Pre-Deploy Checklist** — MUST complete ALL steps                                                                                                                                                                                                                             | [Pre-Deploy Checklist](references/pre-deploy-checklist.md)   |
| 3   | **Load Recipe** — Based on `recipe.type` in `infra/{iac}/{project}/.azure/plan.md`                                                                                                                                                                                             | [recipes/README.md](references/recipes/README.md)            |
| 4   | **Execute Deploy** — Follow recipe steps                                                                                                                                                                                                                                       | Recipe README                                                |
| 5   | **Post-Deploy** — Configure SQL managed identity and apply EF migrations if applicable                                                                                                                                                                                         | [Post-Deployment](references/recipes/azd/post-deployment.md) |
| 6   | **Handle Errors** — See recipe's `errors.md`                                                                                                                                                                                                                                   | —                                                            |
| 7   | **Verify Success** — Confirm deployment completed and endpoints are accessible                                                                                                                                                                                                 | [Verification](references/recipes/azd/verify.md)             |

> **⛔ VALIDATION PROOF CHECK**
>
> When checking the plan, verify the **Validation Proof** section (Section 7) contains actual validation results with commands run and timestamps. If this section is empty, validation was bypassed — invoke **azure-validate** skill first.

## SDK Quick References

- **Azure Developer CLI**: [azd](references/sdk/azd-deployment.md)
- **Azure Identity**: [Python](references/sdk/azure-identity-py.md) | [.NET](references/sdk/azure-identity-dotnet.md) | [TypeScript](references/sdk/azure-identity-ts.md) | [Java](references/sdk/azure-identity-java.md)

## MCP Tools

| Tool                              | Purpose                              |
| --------------------------------- | ------------------------------------ |
| `mcp_azure-mcp_subscription_list` | List available subscriptions         |
| `mcp_azure-mcp_group_list`        | List resource groups in subscription |
| `mcp_azure-mcp_azd`               | Execute AZD commands                 |

## References

- [azd vs deploy.ps1 guide](../iac-common/references/azd-vs-deploy-guide.md) - Comparison, conventions, workflow
- [Troubleshooting](references/troubleshooting.md) - Common issues and solutions
- [Post-Deployment Steps](references/recipes/azd/post-deployment.md) - SQL + EF Core setup

## Gotchas

- **FORBIDDEN: Do NOT manually update plan status to `Validated`** — Only the **azure-validate** skill can set this after running actual checks. Manually updating causes deployment failures.
- **Plan status MUST be `Validated` before deploying** — If status is not `Validated`, invoke **azure-validate** first. Do NOT proceed.
- **Prerequisite chain is strict** — `azure-prepare` → `azure-validate` → `azure-deploy`. Skipping validation causes failures.
- **Validation Proof must be populated** — The plan's **Validation Proof** section must contain actual results (commands run, timestamps). If empty, validation was bypassed.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                            | When to Load         |
| ------------------------------------ | -------------------- |
| `references/auth-best-practices.md`  | Auth Best Practices  |
| `references/global-rules.md`         | Global Rules         |
| `references/pre-deploy-checklist.md` | Pre Deploy Checklist |
| `references/region-availability.md`  | Region Availability  |
| `references/troubleshooting.md`      | Troubleshooting      |
