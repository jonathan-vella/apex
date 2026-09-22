<!-- ref:manual-import-v1 -->

# Manual Azure Resource Import Reference

Use this workflow when Terraform Search is not available (TF < 1.14 or
provider lacks `list_resource_schemas` support). This is the **primary**
import workflow for Azure.

Read-only discovery does not authorize state adoption. Initialize only after
approval, preserving the reviewed provider constraints and lockfile without
`-upgrade`. A schema command error is a blocker, not evidence of missing Search
support. Use [the helper](../scripts/list_resources.sh) for that distinction.

---

## 1. Discover Resources Using az CLI

### List All Resources

```bash
# All resources in a resource group
az resource list --resource-group rg-contoso-prod --output table

# All resources in subscription
az resource list --output table

# Filter by type
az resource list --resource-type "Microsoft.Compute/virtualMachines" --output json

# Filter by tags
az resource list --tag Environment=prod --output json
```

### Resource-Specific Discovery

```bash
# Resource groups
az group list --output json | jq -r '.[].name'

# Virtual networks
az network vnet list -g rg-contoso-prod --output json | jq -r '.[].id'

# Subnets
az network vnet subnet list -g rg-contoso-prod --vnet-name vnet-contoso-prod --output json

# Network security groups
az network nsg list -g rg-contoso-prod --output json | jq -r '.[].id'

# Virtual machines
az vm list -g rg-contoso-prod --output json | jq -r '.[].id'

# Storage accounts
az storage account list -g rg-contoso-prod --output json | jq -r '.[].id'

# Key Vaults
az keyvault list -g rg-contoso-prod --output json | jq -r '.[].id'

# SQL servers
az sql server list -g rg-contoso-prod --output json | jq -r '.[].id'

# Web apps
az webapp list -g rg-contoso-prod --output json | jq -r '.[].id'

# Container apps
az containerapp list -g rg-contoso-prod --output json | jq -r '.[].id'

# Container registries
az acr list -g rg-contoso-prod --output json | jq -r '.[].id'
```

## 2. Azure Resource Type ↔ Terraform Mapping

| ARM Resource Type                           | az CLI                                    | Terraform Resource                        | Notes         |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------- |
| `Microsoft.Resources/resourceGroups`        | `az group list`                           | `azurerm_resource_group`                  |               |
| `Microsoft.Network/virtualNetworks`         | `az network vnet list`                    | `azurerm_virtual_network`                 |               |
| `Microsoft.Network/virtualNetworks/subnets` | `az network vnet subnet list`             | `azurerm_subnet`                          |               |
| `Microsoft.Network/networkSecurityGroups`   | `az network nsg list`                     | `azurerm_network_security_group`          |               |
| `Microsoft.Network/publicIPAddresses`       | `az network public-ip list`               | `azurerm_public_ip`                       |               |
| `Microsoft.Network/loadBalancers`           | `az network lb list`                      | `azurerm_lb`                              |               |
| `Microsoft.Network/privateDnsZones`         | `az network private-dns zone list`        | `azurerm_private_dns_zone`                |               |
| `Microsoft.Compute/virtualMachines`         | `az vm list`                              | `azurerm_linux_virtual_machine`           | Check OS type |
| `Microsoft.Compute/virtualMachineScaleSets` | `az vmss list`                            | `azurerm_linux_virtual_machine_scale_set` | Check OS type |
| `Microsoft.Storage/storageAccounts`         | `az storage account list`                 | `azurerm_storage_account`                 |               |
| `Microsoft.KeyVault/vaults`                 | `az keyvault list`                        | `azurerm_key_vault`                       |               |
| `Microsoft.Sql/servers`                     | `az sql server list`                      | `azurerm_mssql_server`                    |               |
| `Microsoft.Sql/servers/databases`           | `az sql db list`                          | `azurerm_mssql_database`                  |               |
| `Microsoft.Web/sites`                       | `az webapp list`                          | `azurerm_linux_web_app`                   | Check OS type |
| `Microsoft.Web/serverfarms`                 | `az appservice plan list`                 | `azurerm_service_plan`                    |               |
| `Microsoft.App/containerApps`               | `az containerapp list`                    | `azurerm_container_app`                   |               |
| `Microsoft.App/managedEnvironments`         | `az containerapp env list`                | `azurerm_container_app_environment`       |               |
| `Microsoft.ContainerRegistry/registries`    | `az acr list`                             | `azurerm_container_registry`              |               |
| `Microsoft.DocumentDB/databaseAccounts`     | `az cosmosdb list`                        | `azurerm_cosmosdb_account`                |               |
| `Microsoft.OperationalInsights/workspaces`  | `az monitor log-analytics workspace list` | `azurerm_log_analytics_workspace`         |               |

## 3. Create Import Blocks

Use config-driven import (Terraform 1.5+):

```hcl
resource "azurerm_resource_group" "contoso" {
  name     = "rg-contoso-prod"
  location = "swedencentral"
  tags     = var.existing_tags
}

import {
  to = azurerm_resource_group.contoso
  id = "/subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-contoso-prod"
}
```

Declare `existing_tags` as a `map(string)` populated from the actual resource,
including its original casing. Do not rename or retag during import. Reconcile
policy/tag drift as a separately approved change after adoption.

### Saved Import Plan Gate

Review the full plan, including import IDs. The machine check below rejects
managed creates, updates, deletes and both replacement orders, and requires an
actual import. Data reads and unchanged managed resources are permitted.

```bash
set -euo pipefail
terraform plan -out=import.tfplan
terraform show -json import.tfplan | jq -e '
  (.resource_changes | type == "array") and
  any(.resource_changes[]; .mode == "managed" and .change.importing != null) and
  all(.resource_changes[];
    if .mode == "data" then (.change.actions == ["read"] or .change.actions == ["no-op"])
    elif .mode == "managed" then .change.actions == ["no-op"]
    else false end)
' >/dev/null
```

Only after this succeeds and a human approves that exact plan may the deploy
owner run `terraform apply import.tfplan`. A failed check never falls through to apply.

## 4. Bulk Import Script

Script to generate import blocks from `az resource list` output:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./bulk-import-rg.sh <resource-group-name>
RG="${1:?Usage: bulk-import-rg.sh <resource-group-name>}"

# Get all resources as JSON
RESOURCES=$(az resource list --resource-group "$RG" --output json)

echo "# Auto-generated import blocks for $RG"
echo "# Review and edit before running terraform plan"
echo ""

# Generate import blocks
echo "$RESOURCES" | jq -c '.[]' | while IFS= read -r resource; do
  id=$(echo "$resource" | jq -r '.id')
  type=$(echo "$resource" | jq -r '.type')
  name=$(echo "$resource" | jq -r '.name')

  # Convert ARM type to safe Terraform symbolic name
  safe_name=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -c '[:alnum:]' '_' | sed 's/_$//')

  echo "# $type: $name"
  echo "import {"
  echo "  to = <terraform_resource_type>.$safe_name"
  echo "  id = \"$id\""
  echo "}"
  echo ""
done

echo "# Map ARM types to Terraform types using the reference table"
echo "# then create and review a saved import-only plan; apply requires separate approval"
```

## 5. Post-Import Cleanup

After successful import:

1. Run `terraform plan` — should show zero changes
2. Replace hardcoded values with variables
3. Propose naming/tag policy remediation separately; changing names may replace resources
4. Preserve original tags until that change is reviewed and approved
5. Refactor to AVM modules only with an approved state migration (see `apex-terraform-patterns` skill, `references/refactor-module.md`)

## Troubleshooting

| Issue                                  | Solution                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| Import fails with "resource not found" | Verify resource ID with `az resource show --ids <id>`            |
| Plan shows unexpected changes          | Some attributes have provider defaults — align with actual state |
| Sensitive values in state              | Use `sensitive = true` on outputs referencing imported secrets   |
| Import ID format unknown               | Use `az resource show --ids <id> --output json` for full ID      |
