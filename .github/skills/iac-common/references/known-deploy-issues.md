<!-- ref:known-deploy-issues-v1 -->

# Known Deploy Issues

Common deployment issues shared across Bicep and Terraform deploy agents.

| Issue                                         | Workaround                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| MSAL token stale (devcontainer/Codespaces)    | `az login --use-device-code` in the same terminal                                          |
| Azure extension auth ≠ CLI auth               | VS Code extension and `az` CLI use separate token stores — validate CLI auth independently |
| `az account show` succeeds but ARM calls fail | Always validate with `az account get-access-token`                                         |

## Bicep-Specific

| Issue                                 | Workaround                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| What-if fails (RG doesn't exist)      | Create RG first: `az group create ...`                                                         |
| deploy.ps1 JSON parsing errors        | Use direct `az deployment group create`                                                        |
| RBAC permission errors in what-if     | Use `--validation-level ProviderNoRbac`                                                        |
| What-if: unsupported AVM-managed RBAC | AVM manages role-assignment resource IDs at deploy time; surface in `06-deployment-summary.md` |

## Provider Runtime Failures (pass build + what-if, fail at apply)

These failures are emitted by the resource provider during `az
deployment ... create` / `azd provision`. `bicep build`, `bicep lint`,
`validate:iac-security-baseline`, and `what-if` all pass cleanly
because the violation is data-plane / schema-content, not template
shape. When the deploy agent hits one of these, route to
`↩ Fix Deployment Issues` (06b-Bicep CodeGen) with the verbatim error
excerpt.

| Provider error                              | Resource / context                                                                | Root cause                                                                                                                                       | Remediation                                                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BadRequest: 'where' operator: Failed to resolve column or scalar expression named 'OperationName'` (or `'Message'`) | `Microsoft.Insights/scheduledQueryRules` ingestion-cap alerts on Log Analytics    | KQL references columns that do not exist on the `_LogOperation` table (or the actual table targeted by the query). `Message`/`OperationName` exist on activity / app-traces tables, not LA metadata. | Use Log Analytics meta-tables for ingestion-cap alerts: `_LogOperation \| where Category == "Ingestion" \| where _ResourceId =~ "<workspace-resource-id>"`. See [`avm-pitfalls.md` § Log Analytics ingestion-cap alerts](../../azure-bicep-patterns/references/avm-pitfalls.md#log-analytics-ingestion-cap-alerts-kql-column-safety). |
| `InvalidView`                               | `Microsoft.CostManagement/scheduledActions` (`kind: InsightAlert`)                | `viewId` references an RG-scope or unscoped view name. The provider only accepts subscription-scope built-in views.                              | Use one of `ms:DailyAnomalyByResource`, `ms:DailyAnomalyBySubscription`, `MS-DailyCosts`. Prefix the path with `${subscription().id}` only when calling cross-subscription; standard sub-scope reference is the bare `/providers/Microsoft.CostManagement/views/...` shape from `cost-alerts-bicep.md` §6. |
| `InvalidScheduledAction`                    | `Microsoft.CostManagement/scheduledActions` (`kind: InsightAlert`)                | Required `notification` object missing or incomplete. The provider rejects scheduled actions without `notification.to[]` + `notification.subject`. | Author the full `notification` payload exactly as documented in [`cost-alerts-bicep.md` §6 — Canonical snippet](../../azure-defaults/references/cost-alerts-bicep.md#canonical-snippet). Never drop the `notification` block to "tidy" the resource. |
| `InvalidExternalAdministratorSid`           | `Microsoft.Sql/servers` `administrators.sid` (Entra admin)                        | The Entra principal object ID supplied in `sqlEntraAdminObjectId` is not a real Entra ID (placeholder string, stale GUID, or wrong tenant).      | Resolve a live object ID before deploy: `az ad signed-in-user show --query id -o tsv` (for the deployer) or `az ad group show --group <name> --query id -o tsv` (for a security group). Write back via `azd env set SQL_ADMIN_OBJECT_ID <id>`. See [`avm-pitfalls.md` § SQL Entra admin object ID resolution](../../azure-bicep-patterns/references/avm-pitfalls.md#sql-entra-admin-object-id-resolution). |
| Budget / Action Group silently absent       | `Microsoft.Consumption/budgets`, `Microsoft.Insights/actionGroups`                | `COST_ALERT_EMAILS` (or `costAlertEmails[]` param) resolved to `[]`; module / resource is conditionally skipped, deploy reports `Succeeded`, but cost-monitoring contract is not satisfied. | Treat empty `costAlertEmails` as a preflight blocker unless `cost_monitoring_mode ∈ {minimal, deferred}` is set in `04-governance-constraints.json`. See [`deploy-validation-checklist.md` § Cost monitoring inputs](deploy-validation-checklist.md#cost-monitoring-inputs-non-empty-when-enforced). |

### Why `what-if` doesn't catch these

`az deployment ... what-if` calls the ARM control plane with the
rendered template and simulates idempotent operations. The
`Microsoft.Insights/scheduledQueryRules`, `Microsoft.CostManagement`,
and `Microsoft.Sql` resource providers run their content / data-plane
validation **at create time only** — what-if accepts the resource
shape because the template is structurally valid. The deterministic
guards are:

1. Render-level inspection (`bicep build --stdout` + grep) for the
   known dangerous tokens (`OperationName`, `Message`,
   `DailyAnomalyByResourceGroup`, placeholder GUIDs).
2. Preflight CLI lookups (object IDs, RBAC scope, email-array length).
3. Manual re-render of any KQL/view path that was touched since the
   last successful deploy.

Step-5 CodeGen and the 10-Challenger pass both own #1 — Deploy agents
own #2 and #3 as part of preflight, captured in
[`deploy-validation-checklist.md`](deploy-validation-checklist.md).

## Terraform-Specific

| Issue                                    | Workaround                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `terraform init` fails — backend missing | Run `bootstrap-backend.sh` first                                             |
| Backend state lock held                  | `terraform force-unlock {lease-id}` (requires explicit approval)             |
| `azurerm` provider init slow             | Provider cache: `TF_PLUGIN_CACHE_DIR=/home/vscode/.terraform.d/plugin-cache` |
| `terraform fmt -check` fails             | Run `terraform fmt -recursive` to auto-fix                                   |
