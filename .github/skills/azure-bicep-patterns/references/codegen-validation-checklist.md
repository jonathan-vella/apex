<!-- ref:codegen-validation-checklist-bicep-v1 -->

# Bicep CodeGen Validation Checklist

Verify ALL items before marking Step 5 complete.

## Preflight & Governance

- [ ] Preflight check saved to `04-preflight-check.md`
- [ ] Governance compliance map complete — all Deny policies satisfied

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

## Deployment Artifacts

- [ ] `azure.yaml` generated; `deploy.ps1` generated; `05-implementation-reference.md` saved
- [ ] Budget module with forecast alerts (80/100/120%) and anomaly detection

## Review Gates

- [ ] `bicep-validate-subagent` PASS + APPROVED
- [ ] Adversarial review completed (pass 2 conditional on pass 1 severity; pass 3 conditional on pass 2 must_fix)
