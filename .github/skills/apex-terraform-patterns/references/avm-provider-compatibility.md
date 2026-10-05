<!-- ref:avm-provider-compatibility-v1 -->

# AVM-TF Provider Compatibility Matrix

Why APEX pins `azurerm ~> 4.0` and Terraform `>= 1.11`. Each row is the
newest published release of an AVM-TF module that APEX guidance cites,
with the constraints it declares at its root. The `azurerm 5.x` column
records whether that release accepts the current 5.x provider.

Snapshot: 2026-10-05 against `registry.terraform.io` (azurerm 4.81.0,
azurerm 5.8.0, azapi 2.13.0). Versions are examples, not pins — resolve
exact versions at plan time per
[`terraform-conventions.md`](../../apex-azure-defaults/references/terraform-conventions.md).

| Module                                                       | Version | Terraform Core   | azurerm              | azapi             | azurerm 5.x  |
| ------------------------------------------------------------ | ------- | ---------------- | -------------------- | ----------------- | ------------ |
| `Azure/avm-res-apimanagement-service/azurerm`                | 0.9.0   | not declared     | `>= 4.0, < 5.0`      | `~> 2.4`          | No           |
| `Azure/avm-res-authorization-roleassignment/azurerm`         | 0.3.1   | `~> 1.6`         | `>= 3.71, < 5.0`     | `~> 2.4`          | No           |
| `Azure/avm-res-containerregistry-registry/azurerm`           | 0.8.0   | `>= 1.8`         | `>= 4.81.0, < 5.0.0` | `~> 2.4`          | No           |
| `Azure/avm-res-containerservice-managedcluster/azurerm`      | 0.8.3   | `>= 1.11, < 2.0` | not used             | `~> 2.9`          | Yes          |
| `Azure/avm-res-documentdb-databaseaccount/azurerm`           | 0.11.0  | `>= 1.9, < 2.0`  | `~> 4.0`             | `~> 2.12`         | No           |
| `Azure/avm-res-eventhub-namespace/azurerm`                   | 0.1.0   | `>= 1.9, < 2.0`  | `~> 4.0`             | not used          | No           |
| `Azure/avm-res-insights-component/azurerm`                   | 0.4.0   | `>= 1.9, < 2.0`  | `>= 3.71, < 5.0.0`   | `~> 2.4, < 3.0.0` | No           |
| `Azure/avm-res-keyvault-vault/azurerm`                       | 0.11.0  | `>= 1.11, < 2.0` | `>= 4.81, < 5.1`     | `~> 2.4`          | 5.0.x only   |
| `Azure/avm-res-managedidentity-userassignedidentity/azurerm` | 0.5.3   | `>= 1.9, < 2.0`  | `>= 4.60.0, < 5.0.0` | `~> 2.12`         | No           |
| `Azure/avm-res-network-privatednszone/azurerm`               | 0.5.0   | `>= 1.9, < 2.0`  | not used             | `~> 2.4`          | Yes          |
| `Azure/avm-res-network-privateendpoint/azurerm`              | 0.2.0   | `>= 1.9, < 2.0`  | `>= 3.71, < 5.0`     | not used          | No           |
| `Azure/avm-res-network-virtualnetwork/azurerm`               | 0.22.2  | `>= 1.9, < 2.0`  | not used             | `~> 2.12`         | Yes          |
| `Azure/avm-res-operationalinsights-workspace/azurerm`        | 0.5.1   | `>= 1.9, < 2.0`  | `>= 4.36.0, < 5.0.0` | `~> 2.4`          | No           |
| `Azure/avm-res-resources-resourcegroup/azurerm`              | 0.4.0   | `>= 1.9, < 2.0`  | not used             | `~> 2.4`          | Yes          |
| `Azure/avm-res-servicebus-namespace/azurerm`                 | 0.4.0   | not declared     | `~> 4.14`            | not used          | No           |
| `Azure/avm-res-sql-server/azurerm`                           | 0.2.1   | `>= 1.9, < 2.0`  | `~> 4.26`            | `~> 2.4`          | No           |
| `Azure/avm-res-storage-storageaccount/azurerm`               | 0.10.0  | `>= 1.10.0`      | not used             | `~> 2.11`         | Yes          |
| `Azure/avm-res-web-serverfarm/azurerm`                       | 2.0.8   | `>= 1.9, < 2.0`  | not used             | `~> 2.4`          | Yes          |
| `Azure/avm-res-web-site/azurerm`                             | 0.23.0  | `>= 1.9, < 2.0`  | not used             | `~> 2.12`         | Yes          |

Not published (no registry entry): `avm-res-insights-actiongroup` and
`avm-res-consumption-budget` are `Proposed`; there is no diagnostic-setting
module — use each module's `diagnostic_settings` input instead.

## Derived Root-Module Constraints

- `azurerm ~> 4.0` — most modules cap azurerm below 5.0; Terraform resolves
  the newest 4.x release, which satisfies the highest module floor (4.81).
- `azapi ~> 2.12` when a root module calls azapi-based modules.
- `required_version = ">= 1.11"` — Key Vault and AKS modules require it.

## Revisit azurerm 5.x When

1. Every module APEX composes by default (Key Vault, Log Analytics,
   Private Endpoint, Managed Identity, SQL, Container Registry) accepts
   azurerm 5.x in its newest release; and
2. Provider examples have been updated for 5.x behavior (resource
   provider registration defaults and enhanced validation).

Refresh this table with the Terraform Registry module API
(`/v1/modules/Azure/{module}/azurerm/{version}` → `root.provider_dependencies`)
and each module's `terraform.tf` for `required_version`.
