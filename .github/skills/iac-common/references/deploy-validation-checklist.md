<!-- ref:deploy-validation-checklist-v1 -->

# Deploy Validation Checklist

Pre- and post-deployment checks shared across Bicep and Terraform deploy agents.

## Pre-Deployment

- [ ] Azure CLI authenticated (`az account get-access-token` succeeds)
- [ ] No unresolved `<replace-with-*>` placeholders in param files (collected via `askQuestions`)
- [ ] IaC validation passes (bicep build / terraform validate)
- [ ] Preview completed and reviewed (what-if / plan)
- [ ] No unapproved destructive operations (Delete / Destroy / Replace)
- [ ] No deprecation signals in preview output
- [ ] User approval obtained before deployment

## Provider-Runtime Preflight Inputs (mandatory)

Provider runtime failures pass `bicep build` + `bicep lint` + what-if
and only surface during apply (see
[`known-deploy-issues.md` § Provider Runtime Failures](known-deploy-issues.md#provider-runtime-failures-pass-build--what-if-fail-at-apply)).
The deploy agent MUST validate these inputs before invoking
`azd provision` / `az deployment ... create`. Any failure here routes
to `↩ Fix Deployment Issues` (06b-Bicep CodeGen) or back to the user
for env-value correction — never silently substitute.

### Entra principal object IDs are real

For every param resolved from `04-environment-manifest.json` whose
`shape` is `entra-object-id` (e.g. `sqlEntraAdminObjectId`,
`keyVaultAccessGroupId`, RBAC `principalId` overrides):

```bash
# For the signed-in deployer
az ad signed-in-user show --query id -o tsv

# For a named user
az ad user show --id <upn-or-objectid> --query id -o tsv

# For a security group
az ad group show --group <displayName-or-objectid> --query id -o tsv
```

Fail-closed: if any of the above returns no value or a non-GUID, STOP
and route. Empty / placeholder IDs cause provider errors like
`InvalidExternalAdministratorSid` (Azure SQL) that abort the whole
deployment after partial resources are created.

### Cost monitoring inputs (non-empty when enforced)

When `cost_monitoring_mode == enforced` (default for prod), verify
**before** apply:

- `costAlertEmails` (or env var `COST_ALERT_EMAILS`) is a JSON array
  of length ≥ 1.
- The Action Group module / `existing` lookup will produce a real ID
  (preflight `az monitor action-group show ...`).

If `COST_ALERT_EMAILS` resolves to `"[]"`, the budget and Action Group
modules are typically gated by `length(...) > 0` and produce a
silently-skipped deploy: ARM returns `Succeeded` but the cost-monitoring
contract is unmet. Treat the empty-array case as either:

1. A preflight blocker (route to user for emails), OR
2. An explicit opt-out via `cost_monitoring_mode ∈ {minimal,deferred}`
   captured in `04-governance-constraints.json`.

Never accept `[]` as a default during deploy.

### KQL alert queries reference valid columns

For any `Microsoft.Insights/scheduledQueryRules` resource in the
rendered ARM, the deploy agent should confirm the KQL body uses the
right Log Analytics meta-table for the alert's purpose:

- **Ingestion-cap alerts** → `_LogOperation | where Category == "Ingestion" | where _ResourceId =~ "<workspaceResourceId>"`
- **Activity log alerts** → `AzureActivity` (has `OperationName`)
- **App Insights alerts** → `requests`, `traces`, `exceptions` (have `Message`)

Render the alert resource(s) once and grep the KQL body for the
strings `OperationName` and `Message`. If the targeted table doesn't
expose them, route to 06b. See
[`avm-pitfalls.md` § Log Analytics ingestion-cap alerts](../../azure-bicep-patterns/references/avm-pitfalls.md#log-analytics-ingestion-cap-alerts-kql-column-safety).

### Cost anomaly scheduled action prerequisites

For any `Microsoft.CostManagement/scheduledActions` resource with
`kind: InsightAlert` in the rendered ARM:

- `properties.viewId` matches a known subscription-scope built-in
  view (`ms:DailyAnomalyByResource`, `ms:DailyAnomalyBySubscription`,
  or `MS-DailyCosts`). Reject RG-scope view names (e.g.
  `ms:DailyAnomalyByResourceGroup`).
- `properties.notification.to[]` is non-empty.
- `properties.notification.subject` is set.
- `properties.displayName` ≤ 25 chars.
- Resource is in a module with `targetScope = 'subscription'`.

The full contract lives in
[`cost-alerts-bicep.md` §6](../../azure-defaults/references/cost-alerts-bicep.md#6-cost-anomaly-alert-subscription-scoped).

## Bicep-Specific Pre-Deployment

- [ ] `bicep build` passes with no errors
- [ ] What-if analysis completed with default output (no `--output` flag)

## Terraform-Specific Pre-Deployment

- [ ] State backend storage account verified (or bootstrapped)
- [ ] `terraform init` completed successfully
- [ ] `terraform validate` passes with no errors

## Post-Deployment

- [ ] Resources verified via Azure Resource Graph (all in `Succeeded` state)
- [ ] Key outputs captured (endpoints, IDs — secrets redacted)
- [ ] `06-deployment-summary.md` saved with correct H2 headings
- [ ] Session state updated: `steps.6.status = "complete"`
