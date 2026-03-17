# 09 — Lessons Learned

> **Project**: Contoso Service Hub (Run 3)
> **Generated**: 2026-03-17
> **Total Lessons**: 15
> **Azure Deployment Stats**: 48 failed / 223 succeeded across `rg-contoso-service-hub-run-3-dev`

## Summary

Run 3 of the Contoso Service Hub E2E evaluation successfully deployed the `foundation`, `data`, and `edge` phases, but the `platform` phase remained blocked in Step 6. The self-correction loop resolved multiple Bicep and deployment issues across Key Vault, networking, PostgreSQL, APIM, and Front Door before the remaining AKS blocker stopped the final pass.

### Lessons by Category

| Category           | Count | Severity                |
| ------------------ | ----- | ----------------------- |
| factual-accuracy   | 1     | 1 high                  |
| agent-behavior     | 3     | 1 high, 1 medium, 1 low |
| validation-gap     | 2     | 2 medium                |
| deployment-failure | 9     | 5 high, 4 medium        |

### Key Findings

#### LL-001: Azure AD B2C Deprecated (High — Step 2)

The Architect agent selected Azure AD B2C for CIAM on a 2026 greenfield project despite B2C being deprecated for new customers since May 2025. The challenger review caught this and the agent self-corrected to Microsoft Entra External ID.

**Recommendation**: Add B2C deprecation awareness to the azure-defaults skill.

#### LL-002: Blob GRS Contradicts GDPR Stance (High — Step 2)

The architecture specified GRS (geo-redundant storage) while simultaneously requiring no cross-region data replication for GDPR. GRS inherently replicates to a secondary region, violating the stated constraint.

**Recommendation**: Add governance cross-check in architect agent that validates storage redundancy tier against residency requirements.

#### LL-003: APIM Public Accessibility Gap (Medium — Step 2)

Front Door was designated as the sole public entry point, but the architecture didn't explicitly specify that APIM must be in internal VNet mode. This left a potential security bypass.

**Recommendation**: Require explicit VNet mode specification for each networked service.

#### LL-004: Decision Log Schema Mismatch (Medium — Step 1)

The Requirements agent generated decision_log entries with non-compliant field names and ID patterns. It used `DL-NNN` instead of `D001` format and `decision`/`alternatives_considered` instead of `title`/`choice`.

**Recommendation**: Include the exact required schema in the agent prompt or session-resume skill.

#### LL-005: Invalid Review Audit Keys (Medium — Step 1)

The agent added `step_3` and `step_7` keys to review_audit, which are not in the validator's allowed key set.

**Recommendation**: Document valid review_audit keys in the session state schema reference.

#### LL-006: AVM Budget Module Limitation (Low — Step 5)

The budget module used a native resource because the AVM budget module v0.1.0 cannot represent both actual and forecast thresholds simultaneously. This is a valid technical workaround.

**Recommendation**: Monitor AVM updates. Document the limitation in azure-bicep-patterns skill.

#### LL-007: Key Vault networkAcls.bypass Rejected (High — Step 6)

Foundation deployment failed because `modules/keyvault.bicep` set `networkAcls.bypass: 'None'` while the AVM module enables `enabledForDeployment` by default. Azure requires `AzureServices` bypass when any `enabledFor*` flag is true so that ARM's own deployment infrastructure can access the vault.

**Recommendation**: Add a validation rule in azure-bicep-patterns: when Key Vault bypass is `None`, verify all `enabledFor*` flags are false. Otherwise set bypass to `AzureServices`.

#### LL-008: VNet Diagnostic Settings Race Condition (High — Step 6)

The first deployment attempt failed with `ResourceNotFound` for the VNet during the nested networking deployment. The diagnostic settings resource used an `existing` reference to scope itself to the VNet but had no explicit dependency on the AVM module that creates it. The `existing` keyword only resolves a reference — it does not create deployment ordering.

**Recommendation**: Add a pattern note in azure-bicep-patterns: always add `dependsOn` to the creating module when using `existing` resources to scope child resources or diagnostics.

#### LL-009: azd Environment Missing Subscription for First Deploy (Medium — Step 6)

`azd provision --preview --no-prompt` failed because the azd environment lacked `AZURE_SUBSCRIPTION_ID` and `AZURE_RESOURCE_GROUP`. These are required for non-interactive first deployments where azd cannot prompt.

**Recommendation**: Update the deploy agent preflight to verify `azd env get-values` includes both values before running `azd provision --no-prompt`.

#### LL-010: Key Vault Private DNS Zone Was Referenced But Never Created (Medium — Step 6)

A later foundation deployment failed with `InvalidPrivateDnsZoneIds` on the Key Vault private endpoint DNS zone group. The Key Vault path passed a `resourceId()` for `privatelink.vaultcore.azure.net`, but no module actually created or linked that zone. PostgreSQL, Redis, and Storage already used the correct pattern of creating the private DNS zone inside the module.

**Recommendation**: Standardize private endpoint modules so they either create and link their DNS zones locally or explicitly consume a centrally provisioned shared DNS module output, never a bare assumed `resourceId()`.

#### LL-011: APIM Internal Mode Needed a Live-Tested Deployment Matrix (High — Step 6)

The edge phase failed until the APIM module stopped hardcoding `Standard`, removed `publicNetworkAccess: 'Disabled'` during create, and dropped the invalid global policy/logger resources. The original APIM combination was internally inconsistent for a live internal-VNet deployment.

**Recommendation**: Add an APIM compatibility matrix to the Bicep patterns and deploy guidance covering SKU, VNet mode, public access settings, and safe post-create resources.

#### LL-012: Front Door Integration Assumptions Did Not Hold Against the Live APIM Topology (High — Step 6)

The Front Door module failed across several attempts because its WAF attachment path and APIM shared private-link path did not match what Azure would actually accept for this APIM topology. The final successful edge deployment required dropping the WAF attachment path and the unsupported shared private link configuration.

**Recommendation**: Add a live-tested decision tree for Front Door + APIM integration that validates WAF resource family, security-policy association, and origin connectivity against the chosen APIM network mode.

#### LL-013: AKS Platform Phase Blocked by 5 Distinct Errors (High — Step 6)

The platform phase failed across 5 AKS deployment attempts with 4 distinct errors confirmed from Azure:

1. **Node resource group name too long** (83 chars > max 80) — `InvalidParameter`
2. **disableLocalAccounts without AAD** — since K8s 1.25, requires managed AAD integration
3. **K8s version 1.30.14 requires LTS** — `K8sVersionNotSupported`, needs Premium tier + LTS plan
4. **Service CIDR overlap** — `ServiceCidrOverlapExistingSubnetsCidr` (10.0.0.0/16 vs 10.0.0.0/21)

Additionally, 8 companion jumpbox VM deployments all failed with invalid SSH public key data.

**Failed deployments**: `aks-u5peenyiz4yoc`, `aks-wirvqqiym3nw6`, `aks-grx3lettmuwvi`,
`aks-ybarbqgomkqe2`, `aks-l6obuar5efqwm`

**Recommendation**: Add explicit AKS parameters for service CIDR, DNS service IP,
node resource group name (with length validation ≤80 chars), K8s version
(check `az aks get-versions`), AAD integration mode, and SSH input validation in
azure-bicep-patterns. The deploy agent should preflight all five constraints before
the first platform apply.

#### LL-014: PostgreSQL Existing Resource Race Condition (Medium — Step 6)

The data phase deployment failed with `ResourceNotFound` for
`psql-contosos-dev-rdk3tp`. Two child resources tried to reference the PostgreSQL
server via `existing` before it was fully provisioned — the same class of issue
as LL-008 (VNet diagnostic settings race condition).

**Failed deployment**: `postgresql-umowlt3quukpe`

**Recommendation**: Extend the LL-008 pattern rule in azure-bicep-patterns to cover
all data-tier resources: when using `existing` references for PostgreSQL, Redis,
or Storage child resources, always add explicit `dependsOn` to the creating module.

#### LL-015: Jumpbox VM SSH Public Key Data Invalid (Medium — Step 6)

All 8 jumpbox VM deployments in the platform phase failed with
`InvalidParameter: linuxConfiguration.ssh.publicKeys.keyData is invalid`.
The error was consistent across every retry, indicating the SSH key value
passed to the AVM compute module was malformed or empty.

**Failed deployments**: `vm-pceryblx3ri7q`, `vm-uqbend2f7uuqa`,
`vm-z27kvgz4hes32`, `vm-5y4a6zqadsqgc`, `vm-xa3udqdok2dta`,
`vm-nmw2dgzvan4ha`, `vm-dzboe3edngzcs`, `vm-rqrc7ptdiphua`

**Recommendation**: Add SSH key validation to the deploy agent preflight: verify
the SSH public key starts with a valid algorithm prefix (ssh-rsa, ssh-ed25519,
ecdsa-sha2-\*) and is base64-decodable before attempting VM or AKS deployments.

## Azure Deployment Failure Summary

The following table summarizes all 48 failed deployments queried from
`rg-contoso-service-hub-run-3-dev` on 2026-03-17, grouped by root cause:

| Category      | Failed Deploys | Distinct Errors | Lesson         | Status   |
| ------------- | -------------- | --------------- | -------------- | -------- |
| Key Vault     | 6              | 2               | LL-007, LL-010 | Resolved |
| Networking    | 1              | 1               | LL-008         | Resolved |
| PostgreSQL    | 1              | 1               | LL-014         | Resolved |
| APIM          | 5              | 3               | LL-011         | Resolved |
| Front Door    | 7              | 3               | LL-012         | Resolved |
| AKS           | 5              | 4               | LL-013         | New      |
| VM (jumpbox)  | 8              | 1               | LL-015         | New      |
| Parent (main) | 15             | —               | —              | —        |
| **Total**     | **48**         | **15**          |                |          |

## RFP Gap Resolution Tracking

| Gap                   | Resolution                                      | Step  |
| --------------------- | ----------------------------------------------- | ----- |
| No explicit budget    | Estimated $9,280/mo from volumetrics            | 1 → 2 |
| Redis 128 GB sizing   | Premium P4 (53 GB) for MVP, upgrade path at 70% | 1 → 2 |
| AKS vs Container Apps | AKS Standard (RFP references Managed K8s)       | 1 → 2 |

## Benchmark Scores

| Dimension               | Score      | Grade |
| ----------------------- | ---------- | ----- |
| Artifact Completeness   | 67/100     | D     |
| Structural Compliance   | 100/100    | A     |
| Code Quality            | 80/100     | B     |
| Review Thoroughness     | 17/100     | F     |
| WAF Coverage            | 100/100    | A     |
| Cost Accuracy           | 80/100     | B     |
| Session State Integrity | 100/100    | A     |
| Timing Performance      | 50/100     | D     |
| **Composite**           | **75/100** | **C** |

### Areas for Improvement

1. **Review Thoroughness (F)**: Only 1 of 3 planned challenger passes was executed for complex steps. Future runs should complete all planned passes.
2. **Artifact Completeness (D)**: Some Step 3 and Step 4 supplementary artifacts may have inconsistent formatting.
3. **Timing Performance (D)**: Multiple subagent invocations add latency. Consider batching where possible.
