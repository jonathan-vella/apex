---
title: "Validation Results"
sidebar:
  order: 2
---

## ✅ Validation Status

| Check                     | Result             | Details                                                                                                      |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `bicep build`             | ✅                 | 0 errors, ⚠️ 34 warnings (BCP318 conditional modules, BCP321 nullable MI outputs, no-hardcoded-env-urls DNS) |
| `bicep lint`              | ✅                 | 0 errors                                                                                                     |
| `bicep-validate-subagent` | ✅ PASS + APPROVED | 0 errors, 34 warnings (all acceptable); ❌ NEEDS_REVISION → all must_fix items resolved, re-validated        |

### Review Findings Applied

| Finding | Severity    | Description                                                                    | Resolution                                                             |
| ------- | ----------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| H2      | HIGH        | NSGs used raw Bicep instead of AVM                                             | Replaced with `br/public:avm/res/network/network-security-group:0.5.2` |
| H3      | HIGH        | NSG names missing project identifier                                           | Updated to `nsg-${projectName}-{role}-${environment}`                  |
| H4      | HIGH        | deploy.ps1 missing ARM token validation                                        | Added `az account get-access-token` check                              |
| H5      | HIGH        | deploy.ps1 wildcard in deployment name query                                   | Track phase-2 name explicitly via `$phase2DeploymentName`              |
| M3      | MEDIUM      | ftpsState set to FtpsOnly                                                      | Changed to `Disabled` per security baseline                            |
| M6      | MEDIUM      | Hardcoded technical contact email in deploy.ps1                                | Parameterized as `$TechnicalContact`                                   |
| H1      | HIGH (FP)   | dailyQuotaGb type — reviewer claimed int but BCP036 confirmed `null \| string` | No change needed — string is correct                                   |
| M2      | MEDIUM (FP) | availabilityZone: -1 questioned — build confirmed int works                    | No change needed                                                       |

### Findings Deferred (Non-Blocking)

| Finding | Severity | Description                                                                     | Rationale                                                                                     |
| ------- | -------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| M1      | MEDIUM   | SQL missing diagnosticSettings                                                  | AVM SQL Server module does not support `diagnosticSettings` parameter (build error confirmed) |
| M4      | MEDIUM   | Standard_LRS in prod                                                            | Implementation plan specifies Standard_LRS; aligns with cost-optimized architecture           |
| M5      | MEDIUM   | Budget startDate resets on each deploy                                          | `utcNow()` in param default is acceptable pattern; deployer can override                      |
| M7      | MEDIUM   | PE subnet network policies                                                      | `Enabled` is correct GA behavior for API 2024-01-01                                           |
| L1-L5   | LOW      | Health probe, log retention, blob diagnostics, autoscale ceiling, dev KV access | Non-blocking; addressable in subsequent iteration                                             |
