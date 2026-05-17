<!-- ref:codegen-file-order-v1 -->

# Codegen File-Order Reference

Per-tool file emission order for Phase 2 of the CodeGen agents
(`06b-bicep-codegen` / `06t-terraform-codegen`).

Each listed file is emitted in **its own response turn** — the table is
dependency ordering only, not a batch boundary. Full cadence rule
(per-file announce → create_file → end turn, plus anti-patterns and
resume-after-abort flow):
[`codegen-shared-workflow.md` → Phase 2: Output Cadence](./codegen-shared-workflow.md).

Adjust each set to match the project's Code-Generation Contract — drop
unused files, add project-specific ones. **Cadence stays one file per
response turn regardless of how the set is trimmed.**

## Bicep

Build cadence: after files 3, 6, 9, and 12, run
`bicep build infra/bicep/{project}/main.bicep` via `execution_subagent`.

| #  | File                                                                                                                                                       | Round (dep) |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1  | `main.bicep` (params, vars, `uniqueSuffix`, module composition)                                                                                            | 1           |
| 2  | `main.bicepparam` (or per-environment `.bicepparam` files, one turn each)                                                                                  | 1           |
| 3  | `modules/networking.bicep`                                                                                                                                 | 2           |
| 4  | `modules/keyvault.bicep`                                                                                                                                   | 2           |
| 5  | `modules/observability.bicep` (Log Analytics + Application Insights)                                                                                       | 2           |
| 6  | `modules/compute.bicep`                                                                                                                                    | 3           |
| 7  | `modules/data.bicep`                                                                                                                                       | 3           |
| 8  | `modules/messaging.bicep`                                                                                                                                  | 3           |
| 9  | `modules/cost-monitoring.bicep` per [cost-alerts-bicep.md](../../azure-defaults/references/cost-alerts-bicep.md) (branch on `cost_monitoring_mode`)        | 4           |
| 10 | `modules/diagnostics.bicep`                                                                                                                                | 4           |
| 11 | `modules/rbac.bicep`                                                                                                                                       | 4           |
| 12 | `azure.yaml` (azd manifest — primary deployment method)                                                                                                    | 4           |
| 13 | `deploy.ps1` (deprecated fallback)                                                                                                                         | 4           |

## Terraform

Build cadence: after files 6, 9, 12, and 15, run
`terraform -chdir=infra/terraform/{project} validate` via
`execution_subagent`.

| #  | File                                                                                                                                                              | Round (dep) |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1  | `versions.tf`                                                                                                                                                     | 1           |
| 2  | `providers.tf`                                                                                                                                                    | 1           |
| 3  | `backend.tf`                                                                                                                                                      | 1           |
| 4  | `variables.tf`                                                                                                                                                    | 1           |
| 5  | `locals.tf` (unique suffix + tag map + naming locals)                                                                                                             | 1           |
| 6  | `main.tf` (resource group + module composition root)                                                                                                              | 1           |
| 7  | `networking.tf` (VNet, subnets, NSGs)                                                                                                                             | 2           |
| 8  | `keyvault.tf`                                                                                                                                                     | 2           |
| 9  | `observability.tf` (Log Analytics + Application Insights)                                                                                                         | 2           |
| 10 | `compute.tf`                                                                                                                                                      | 3           |
| 11 | `data.tf`                                                                                                                                                         | 3           |
| 12 | `messaging.tf`                                                                                                                                                    | 3           |
| 13 | `cost-monitoring.tf` per [cost-alerts-terraform.md](../../azure-defaults/references/cost-alerts-terraform.md) (branch on `cost_monitoring_mode`)                  | 4           |
| 14 | `diagnostics.tf`                                                                                                                                                  | 4           |
| 15 | `rbac.tf`                                                                                                                                                         | 4           |
| 16 | `outputs.tf`                                                                                                                                                      | 4           |
