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
| `InvalidView`                               | `Microsoft.CostManagement/scheduledActions` (`kind: InsightAlert`)                | `viewId` is not scope-matched to the action. A bare `/providers/Microsoft.CostManagement/views/...` path (no subscription prefix) is rejected even though it is structurally valid — the provider wants "a view ID with the same scope ... as the scheduled action". | Scope-match the `viewId`: prefix the built-in view with the subscription resource ID, e.g. `${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup` (deployed + verified). See [`cost-alerts-bicep.md` §6 — Canonical snippet](../../azure-defaults/references/cost-alerts-bicep.md#canonical-snippet). |
| `InvalidScheduledAction`                    | `Microsoft.CostManagement/scheduledActions` (`kind: InsightAlert`)                | Required `notification` object missing or incomplete. The provider rejects scheduled actions without `notification.to[]` + `notification.subject`. | Author the full `notification` payload exactly as documented in [`cost-alerts-bicep.md` §6 — Canonical snippet](../../azure-defaults/references/cost-alerts-bicep.md#canonical-snippet). Never drop the `notification` block to "tidy" the resource. |
| `InvalidExternalAdministratorSid`           | `Microsoft.Sql/servers` `administrators.sid` (Entra admin)                        | The Entra principal object ID supplied in `sqlEntraAdminObjectId` is not a real Entra ID (placeholder string, stale GUID, or wrong tenant).      | Resolve a live object ID before deploy: `az ad signed-in-user show --query id -o tsv` (for the deployer) or `az ad group show --group <name> --query id -o tsv` (for a security group). Write back via `azd env set SQL_ADMIN_OBJECT_ID <id>`. See [`avm-pitfalls.md` § SQL Entra admin object ID resolution](../../azure-bicep-patterns/references/avm-pitfalls.md#sql-entra-admin-object-id-resolution). |
| Budget / Action Group silently absent       | `Microsoft.Consumption/budgets`, `Microsoft.Insights/actionGroups`                | `COST_ALERT_EMAILS` (or `costAlertEmails[]` param) resolved to `[]`; module / resource is conditionally skipped, deploy reports `Succeeded`, but cost-monitoring contract is not satisfied. | Treat empty `costAlertEmails` as a preflight blocker unless `cost_monitoring_mode ∈ {minimal, deferred}` is set in `04-governance-constraints.json`. See [`deploy-validation-checklist.md` § Cost monitoring inputs](deploy-validation-checklist.md#cost-monitoring-inputs-non-empty-when-enforced). |
| `UserDefinedRouting is not supported when Cluster has public network access set to Disabled` | `Microsoft.ContainerService/managedClusters` `outboundType` | UDR egress requires a `0.0.0.0/0` route table to a firewall/NVA; rejected when public network access is restricted (e.g. API Server VNet Integration). A NAT Gateway on the node subnet is a different topology. | Set `outboundType: 'userAssignedNATGateway'` when a NAT GW is attached to the AKS subnet (not `userDefinedRouting`). See [`avm-pitfalls.md` § AKS](../../azure-bicep-patterns/references/avm-pitfalls.md#aks-managed-cluster-apply-time-gotchas). |
| `InvalidParameter: AgentPool '...' has 'minCount' set which requires enableAutoscaling true` | `Microsoft.ContainerService/managedClusters/agentPools` | `minCount`/`maxCount` supplied for a fixed-size pool (`enableAutoScaling: false`). | Set both to `null` unless autoscaling is enabled. See [`avm-pitfalls.md` § AKS](../../azure-bicep-patterns/references/avm-pitfalls.md#aks-managed-cluster-apply-time-gotchas). |
| `VnetSubnetMissingDelegation` | `Microsoft.DBforMySQL/flexibleServers` | The server points at `delegatedSubnetResourceId` for a subnet that is not delegated (e.g. a shared private-endpoint subnet). PE and delegated-subnet are mutually exclusive. | On a shared PE subnet use a **private endpoint** (`privateEndpoints[]`, `service: 'mysqlServer'`), not VNet injection. See [`avm-pitfalls.md` § MySQL](../../azure-bicep-patterns/references/avm-pitfalls.md#mysql-flexible-server-apply-time-gotchas). |
| `ConfigurationReadOnly` (`aad_auth_only`) | `Microsoft.DBforMySQL/flexibleServers/configurations` | `aad_auth_only` is a read-only server parameter; it cannot be set via the `configurations[]` API. | Set only writable params (e.g. `require_secure_transport`); enforce Entra admin + AAD-only **post-deploy** (`az mysql flexible-server ad-admin create`). See [`avm-pitfalls.md` § MySQL](../../azure-bicep-patterns/references/avm-pitfalls.md#mysql-flexible-server-apply-time-gotchas). |
| `UpdateServerVersionTogetherWithOtherPropertiesNotAllowed` | `Microsoft.DBforMySQL/flexibleServers` | A major-version change was sent alongside other property changes (AVM re-sends the full property bag every deploy). | Version must be the ONLY changed property. Non-prod: delete + recreate. Prod: in-place Major Version Upgrade (MVU) as a separate op. See [`avm-pitfalls.md` § MySQL](../../azure-bicep-patterns/references/avm-pitfalls.md#mysql-flexible-server-apply-time-gotchas). |
| `ApplicationGatewayBackendAddressLoopbackAddressIsInvalid` | `Microsoft.Network/applicationGateways` | A backend pool was seeded with a loopback placeholder (`127.0.0.1`) because the real backend (e.g. AKS internal LB) does not exist yet. | Author an **empty** backend pool; AGIC or a post-deploy update populates it. See [`avm-pitfalls.md` § App Gateway](../../azure-bicep-patterns/references/avm-pitfalls.md#application-gateway-backend-pool-no-loopback). |
| `The runbook does not have a published version` | `Microsoft.Automation/automationAccounts/jobSchedules` | A `jobSchedules` entry links a schedule to a runbook that is an empty draft (AVM has no inline content). | Omit `jobSchedules` from IaC; publish the runbook content and create the schedule link **post-deploy**. See [`avm-pitfalls.md` § Automation](../../azure-bicep-patterns/references/avm-pitfalls.md#automation-account-runbook-and-jobschedule). |
| `PrivateEndpointCannotBeUpdatedInDisconnectedState` | `Microsoft.Network/privateEndpoints` | Re-deploying after the PaaS resource behind a PE was deleted; the orphaned PE is `Disconnected` and cannot be updated. | Delete the orphaned PE so the redeploy recreates it `Approved`: `az network private-endpoint delete -g <rg> -n <pe>`. See [`deploy-validation-checklist.md` § Redeploy / idempotency preflight](deploy-validation-checklist.md#redeploy--idempotency-preflight). |

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
