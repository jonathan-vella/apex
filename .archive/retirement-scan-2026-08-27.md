# Whole-Repository Retirement Scan

> Baseline: `b87b57f719520049d6bcf2f00bc3d9431c1002a7` | Scan date: 2026-08-27 | Status: **completed**

## Summary

| Status    | Files |
| --------- | ----: |
| defer     |    24 |
| protected |   465 |
| retain    |   850 |

## Domains

| Domain         | Files |
| -------------- | ----: |
| agent-output   |     1 |
| agents         |    22 |
| archive        |   199 |
| ci             |    14 |
| documentation  |    85 |
| infrastructure |     3 |
| instructions   |    37 |
| registries     |     7 |
| root-config    |    65 |
| schemas        |    19 |
| site           |    49 |
| skills         |   564 |
| tests          |   103 |
| tooling        |   171 |

## Review Queue

| ID                | Status | Risk   | Path                                                                                | Evidence                                                 |
| ----------------- | ------ | ------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| FILE-d701d1f89aab | defer  | medium | `.github/skills/azure-compliance/references/auth-best-practices.md`                 | exact_duplicate, normalized_similarity, direct_reference |
| FILE-4c3cb71a6302 | defer  | medium | `.github/skills/azure-compliance/references/sdk/azure-keyvault-py.md`               | exact_duplicate, normalized_similarity, direct_reference |
| FILE-fb6e7d66f0b2 | defer  | medium | `.github/skills/azure-compliance/references/sdk/azure-keyvault-secrets-ts.md`       | exact_duplicate, normalized_similarity, direct_reference |
| FILE-09cea16df305 | defer  | medium | `.github/skills/azure-cost-optimization/references/auth-best-practices.md`          | exact_duplicate, normalized_similarity, direct_reference |
| FILE-1c56ce8c6276 | defer  | medium | `.github/skills/azure-deploy/references/auth-best-practices.md`                     | exact_duplicate, normalized_similarity, direct_reference |
| FILE-06a62f4e4ad8 | defer  | medium | `.github/skills/azure-deploy/references/sdk/azure-identity-dotnet.md`               | exact_duplicate, normalized_similarity, direct_reference |
| FILE-20af4b47cc70 | defer  | medium | `.github/skills/azure-deploy/references/sdk/azure-identity-java.md`                 | exact_duplicate, normalized_similarity, direct_reference |
| FILE-38abfcc2851b | defer  | medium | `.github/skills/azure-deploy/references/sdk/azure-identity-py.md`                   | exact_duplicate, normalized_similarity, direct_reference |
| FILE-07a5a684ffdc | defer  | medium | `.github/skills/azure-deploy/references/sdk/azure-identity-ts.md`                   | exact_duplicate, normalized_similarity, direct_reference |
| FILE-614abd27bf98 | defer  | medium | `.github/skills/azure-prepare/references/auth-best-practices.md`                    | exact_duplicate, normalized_similarity, direct_reference |
| FILE-12b9191bb4a4 | defer  | medium | `.github/skills/azure-prepare/references/global-rules.md`                           | exact_duplicate, normalized_similarity, direct_reference |
| FILE-2f51147935cd | defer  | medium | `.github/skills/azure-prepare/references/sdk/azure-identity-dotnet.md`              | exact_duplicate, normalized_similarity                   |
| FILE-0a1e7082dffd | defer  | medium | `.github/skills/azure-prepare/references/sdk/azure-identity-java.md`                | exact_duplicate, normalized_similarity                   |
| FILE-39f195bf424c | defer  | medium | `.github/skills/azure-prepare/references/sdk/azure-identity-py.md`                  | exact_duplicate, normalized_similarity                   |
| FILE-008e4f8eef79 | defer  | medium | `.github/skills/azure-prepare/references/sdk/azure-identity-ts.md`                  | exact_duplicate, normalized_similarity                   |
| FILE-409d5530553e | defer  | medium | `.github/skills/azure-storage/references/auth-best-practices.md`                    | exact_duplicate, normalized_similarity, direct_reference |
| FILE-12de39f2508f | defer  | medium | `.github/skills/azure-validate/references/global-rules.md`                          | exact_duplicate, normalized_similarity, direct_reference |
| FILE-2a79664f6abd | defer  | medium | `.github/skills/entra-app-registration/references/auth-best-practices.md`           | exact_duplicate, normalized_similarity, direct_reference |
| FILE-1d0c588da471 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-identity-dotnet.md`     | exact_duplicate, normalized_similarity                   |
| FILE-8638dc6a5123 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-identity-java.md`       | exact_duplicate, normalized_similarity                   |
| FILE-3928f0049926 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-identity-py.md`         | exact_duplicate, normalized_similarity                   |
| FILE-e6fb9322b749 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-identity-ts.md`         | exact_duplicate, normalized_similarity                   |
| FILE-23f0e6ee73c6 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-keyvault-py.md`         | exact_duplicate, normalized_similarity                   |
| FILE-5722d0abcc01 | defer  | medium | `.github/skills/entra-app-registration/references/sdk/azure-keyvault-secrets-ts.md` | exact_duplicate, normalized_similarity                   |

## Approval Gate

Adversarial review found two exact duplicate groups confined to frozen archives; they remain unchanged. The human
reviewer approved consolidation of all active duplicate groups and accepted the cross-skill portability trade-off.

| Recommendation                   | Groups                                 | Next decision                             |
| -------------------------------- | -------------------------------------- | ----------------------------------------- |
| Retain frozen archive duplicates | `DUP-0ebe20edc3e9`, `DUP-32786c07c92a` | None                                      |
| Consolidate active references    | Remaining exact duplicate groups       | Archive superseded copies after migration |

Jonathan Vella approved all active duplicate groups for consolidation on 2026-08-27. Archive-only duplicates remain
protected and unchanged.

## Execution

Superseded copies were archived in `redundant-content/consolidated-skill-references-2026-08-27.tar.gz`. Canonical
owners are Entra App Registration for authentication, Azure Deploy for identity SDKs, Azure Compliance for Key Vault
SDKs, and Azure Prepare for global rules. The checksum is recorded in `redundant-content/CHECKSUMS.sha256`.
