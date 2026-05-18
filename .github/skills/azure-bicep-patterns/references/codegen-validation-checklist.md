<!-- ref:codegen-validation-checklist-bicep-v1 -->

# Bicep CodeGen Validation Checklist

Verify ALL items before marking Step 5 complete.

## Preflight & Governance

- [ ] Preflight check saved to `04-preflight-check.md`
- [ ] Governance compliance map complete — all Deny policies satisfied
- [ ] **AVM param-shape summary** captured in the preflight: for every AVM module pinned in
      `04-iac-contract.json`, the compiled `main.json` in `~/.bicep/br/mcr.microsoft.com/...`
      was inspected and the actual param names + nested-type field names recorded.
      Do **not** copy param names from docs, prior projects, or training data — see
      [`avm-pitfalls.md` § Schema Drift in Pinned AVM Versions](avm-pitfalls.md#schema-drift-in-pinned-avm-versions-mandatory-pre-author-check).

## AVM & Code Structure

- [ ] AVM modules used for all available resources
- [ ] `uniqueSuffix` generated once, passed to all modules
- [ ] Length constraints respected (KV≤24, Storage≤24)
- [ ] `projectName` is a required parameter with no default value
- [ ] Zero hardcoded project-specific values (see `iac-bicep-best-practices.instructions.md`)

## Security Baseline

- [ ] Security baseline applied (TLS 1.2, HTTPS, managed identity)
- [ ] PostgreSQL uses AAD-only auth (`activeDirectoryAuth: Enabled`, `passwordAuth: Disabled`)
- [ ] Key Vault `networkAcls.bypass` includes `'AzureServices'` when any enabledFor\* flag is true

## Networking & Platform

- [ ] APIM VNet model matches SKU tier (Standard v2 = virtualNetworkIntegration, not virtualNetworkType)
- [ ] Front Door uses separate location params (profile=global, privateLinkLocation=resource region)
- [ ] All `existing` resource references have explicit `dependsOn` to the creating module
- [ ] AKS service CIDR does not overlap VNet/subnet CIDRs; node RG name ≤80 chars
- [ ] PE modules create their own private DNS zones (not bare `resourceId()` to non-existent zones)
- [ ] Subscription-scope entrypoints use `resourceId(subscription().subscriptionId, resourceGroupName, 'Microsoft.Foo/bars', name)` for cross-RG references

## Runtime Validation (Pre-Challenger)

- [ ] Front Door child resources (endpoints, routes, origins) tested with `az deployment sub what-if`
- [ ] Phased module conditions verified — each phase deploys independently without missing dependencies
- [ ] Private connectivity prerequisites (PE, DNS zones) validated before dependent resources
- [ ] Extension-resource diagnostics isolated in scope-aware helper modules (not inline at subscription scope)
- [ ] **Provider-runtime traps absent** — for each rendered ARM:
  - `Microsoft.Insights/scheduledQueryRules` KQL targeting `_LogOperation` does NOT reference `OperationName` / `Message` (see [`avm-pitfalls.md` § Log Analytics ingestion-cap alerts](avm-pitfalls.md#log-analytics-ingestion-cap-alerts-kql-column-safety)).
  - `Microsoft.CostManagement/scheduledActions` (`InsightAlert`) has `notification.to[]` + `notification.subject`, sub-scope `viewId`, `displayName` ≤ 25 chars, and lives in a `targetScope = 'subscription'` module ([`cost-alerts-bicep.md` §6](../../azure-defaults/references/cost-alerts-bicep.md#6-cost-anomaly-alert-subscription-scoped)).
  - Every `entra-object-id` shaped param in `04-environment-manifest.json` is declared as **required, deploy-time-resolved** (not baked into the bicepparam) ([`avm-pitfalls.md` § SQL Entra admin object ID resolution](avm-pitfalls.md#sql-entra-admin-object-id-resolution)).
  - Budget / Action Group emit conditions do not silently no-op when `costAlertEmails == []` unless `cost_monitoring_mode ∈ {minimal, deferred}` is recorded in governance ([`cost-alerts-baseline.md` § Empty-array silent-skip](../../azure-defaults/references/cost-alerts-baseline.md#empty-array-silent-skip-deploy-time-hazard)).

## Deployment Artifacts

- [ ] `azure.yaml` generated (primary); `deploy.ps1` generated (deprecated fallback); `05-implementation-reference.md` saved
- [ ] Budget module with forecast alerts (80/100/120%) and anomaly detection
- [ ] Tree formatted once via `npm run format:bicep -- infra/bicep/{project}` (single call — do NOT run `mcp_bicep_format_bicep_file` per file)

## Review Gates

- [ ] `bicep-validate-subagent` PASS + APPROVED
- [ ] Adversarial review completed (pass 2 conditional on pass 1 severity; pass 3 conditional on pass 2 must_fix)
