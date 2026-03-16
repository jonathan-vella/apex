<!-- ref:manual-import-v1 -->

# Manual Azure Resource Import Reference

Use this workflow when Terraform Search is not available (TF < 1.14 or
provider lacks `list_resource_schemas` support). This is the **primary**
import workflow for Azure.

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
  tags = {
    Environment = "prod"
    ManagedBy   = "Terraform"
    Project     = "contoso"
    Owner       = "platform-team"
  }
}

import {
  to = azurerm_resource_group.contoso
  id = "/subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-contoso-prod"
}
```

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
echo "# then run: terraform plan && terraform apply"
```

## 5. Post-Import Cleanup

After successful import:

1. Run `terraform plan` — should show zero changes
2. Replace hardcoded values with variables
3. Apply CAF naming patterns
4. Add mandatory tags
5. Refactor to AVM modules (see `terraform-patterns` skill, `references/refactor-module.md`)

## Troubleshooting

| Issue                                  | Solution                                                         |
| -------------------------------------- | ---------------------------------------------------------------- |
| Import fails with "resource not found" | Verify resource ID with `az resource show --ids <id>`            |
| Plan shows unexpected changes          | Some attributes have provider defaults — align with actual state |
| Sensitive values in state              | Use `sensitive = true` on outputs referencing imported secrets   |
| Import ID format unknown               | Use `az resource show --ids <id> --output json` for full ID      |
