---
name: terraform-search-import
description: "Discover existing Azure resources and bulk import them into Terraform management. USE FOR: import Azure resources, bring unmanaged infra under Terraform, audit Azure resources, migrate to IaC, terraform import, bulk import. WHEN: import existing resources, discover Azure infrastructure, adopt Terraform for existing resources, generate import blocks. DO NOT USE FOR: Bicep code, new resource creation, architecture decisions."
compatibility: Manual workflow requires azurerm ~> 4.0 + Azure CLI. Search workflow requires Terraform >= 1.14 (experimental for azurerm).
---

# Terraform Search & Import for Azure

Discover existing Azure resources and generate Terraform configuration for bulk import.

**References:**
- [Terraform Import](https://developer.hashicorp.com/terraform/language/import)
- [Terraform Search](https://developer.hashicorp.com/terraform/language/block/tfquery/list) (TF 1.14+)

---

## Decision Tree

```text
┌─ Identify target Azure resources
│
├─ PRIMARY: Manual Discovery via az CLI (always works)
│  └─ az resource list → create import blocks → terraform plan → apply
│
└─ SECONDARY: Terraform Search (EXPERIMENTAL)
   ├─ Check: terraform version >= 1.14?
   │  └─ NO → use Manual workflow
   ├─ Check: azurerm supports list_resource_schemas for this type?
   │  └─ UNKNOWN/NO → use Manual workflow
   └─ YES to both → use Search workflow
```

**Primary workflow = Manual Discovery** via `az` CLI. Always works with azurerm ~> 4.0.

**Search workflow is experimental** — `azurerm` provider support for `list_resource_schemas`
is TBD. Use Manual Discovery as the reliable default.

---

## Manual Discovery Workflow (Primary)

### Step 1: Discover Resources with az CLI

```bash
# List all resources in a resource group
az resource list --resource-group rg-contoso-prod --output table

# List specific resource types
az vm list --resource-group rg-contoso-prod --output json
az network vnet list --resource-group rg-contoso-prod --output json
az storage account list --resource-group rg-contoso-prod --output json
az keyvault list --resource-group rg-contoso-prod --output json
az sql server list --resource-group rg-contoso-prod --output json
az webapp list --resource-group rg-contoso-prod --output json

# List across all resource groups
az resource list --query "[?type=='Microsoft.Compute/virtualMachines']" --output table

# Filter by tags
az resource list --tag Environment=prod --output json
```

### Step 2: Create Import Blocks

For each discovered resource, create a `resource` block + `import` block:

```hcl
# imports.tf
resource "azurerm_resource_group" "existing" {
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
  to = azurerm_resource_group.existing
  id = "/subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-contoso-prod"
}

resource "azurerm_virtual_network" "existing" {
  name                = "vnet-contoso-prod"
  resource_group_name = azurerm_resource_group.existing.name
  location            = azurerm_resource_group.existing.location
  address_space       = ["10.0.0.0/16"]
  tags = {
    Environment = "prod"
    ManagedBy   = "Terraform"
    Project     = "contoso"
    Owner       = "platform-team"
  }
}

import {
  to = azurerm_virtual_network.existing
  id = "/subscriptions/SUBSCRIPTION_ID/resourceGroups/rg-contoso-prod/providers/Microsoft.Network/virtualNetworks/vnet-contoso-prod"
}
```

### Step 3: Plan and Apply

```bash
terraform plan    # Review — should show import actions only
terraform apply   # Execute imports
```

### Azure Resource Type ↔ Terraform Mapping

| Azure Resource Type | az CLI Command | Terraform Resource | Import ID Format |
|---------------------|---------------|--------------------|------------------|
| `Microsoft.Resources/resourceGroups` | `az group list` | `azurerm_resource_group` | `/subscriptions/{sub}/resourceGroups/{name}` |
| `Microsoft.Network/virtualNetworks` | `az network vnet list` | `azurerm_virtual_network` | `.../Microsoft.Network/virtualNetworks/{name}` |
| `Microsoft.Network/networkSecurityGroups` | `az network nsg list` | `azurerm_network_security_group` | `.../Microsoft.Network/networkSecurityGroups/{name}` |
| `Microsoft.Compute/virtualMachines` | `az vm list` | `azurerm_linux_virtual_machine` / `azurerm_windows_virtual_machine` | `.../Microsoft.Compute/virtualMachines/{name}` |
| `Microsoft.Storage/storageAccounts` | `az storage account list` | `azurerm_storage_account` | `.../Microsoft.Storage/storageAccounts/{name}` |
| `Microsoft.KeyVault/vaults` | `az keyvault list` | `azurerm_key_vault` | `.../Microsoft.KeyVault/vaults/{name}` |
| `Microsoft.Sql/servers` | `az sql server list` | `azurerm_mssql_server` | `.../Microsoft.Sql/servers/{name}` |
| `Microsoft.Web/sites` | `az webapp list` | `azurerm_linux_web_app` / `azurerm_windows_web_app` | `.../Microsoft.Web/sites/{name}` |
| `Microsoft.App/containerApps` | `az containerapp list` | `azurerm_container_app` | `.../Microsoft.App/containerApps/{name}` |

Full import ID is always: `/subscriptions/{sub}/resourceGroups/{rg}/providers/{type}/{name}`

Use `az resource show --ids <resource-id>` to get the full resource ID for import.

## Post-Import: Adopt AVM Modules

After importing raw `azurerm_*` resources, refactor to AVM modules:

1. Import resources into state (above)
2. Replace `azurerm_*` with AVM module calls
3. Use `moved {}` blocks to migrate state
4. Run `terraform plan` to verify zero changes

```hcl
# Before: imported raw resource
resource "azurerm_key_vault" "existing" {
  name                = "kv-contoso-prod-a1b2"
  resource_group_name = azurerm_resource_group.existing.name
  location            = "swedencentral"
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
}

# After: AVM module (use moved block for state migration)
module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"
  name                = "kv-contoso-prod-a1b2"
  resource_group_name = azurerm_resource_group.existing.name
  location            = "swedencentral"
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}

moved {
  from = azurerm_key_vault.existing
  to   = module.key_vault.azurerm_key_vault.this
}
```

See `terraform-patterns` skill `references/refactor-module.md` for full refactoring guidance.

## Integration with Terraform MCP

Use Terraform MCP tools during import workflows:

| Tool | Purpose |
|------|---------|
| `mcp_terraform_search_providers` | Validate resource type support in provider |
| `mcp_terraform_get_provider_details` | Get resource schemas and import ID format |
| `mcp_terraform_search_modules` | Find AVM modules for post-import refactoring |
| `mcp_terraform_get_latest_module_version` | Get latest AVM module version |

---

## Terraform Search Workflow (Experimental)

> **Warning**: This workflow requires Terraform >= 1.14 and provider support for
> `list_resource_schemas`. The `azurerm` provider's support status is TBD.
> Use the Manual Discovery workflow above as the reliable primary path.

### Version Prerequisite Check

```bash
# Verify Terraform version
terraform version
# Must show >= 1.14.0

# Check if azurerm supports list resources
./scripts/list_resources.sh azurerm
# If empty array, search is not supported — use Manual workflow
```

### Query File Structure

```hcl
# discovery.tfquery.hcl
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

list "azurerm_resource_group" "all" {
  provider = azurerm
}

list "azurerm_virtual_network" "all" {
  provider = azurerm
}
```

### Running Search Queries

```bash
terraform init
terraform query                                    # Discover resources
terraform query -generate-config-out=imported.tf   # Generate config
# Review and clean imported.tf
terraform plan
terraform apply
```

### Post-Generation Cleanup

Generated configuration includes all attributes. Clean up by:
1. Remove computed/read-only attributes (`id`, `arn`, etc.)
2. Replace hardcoded values with variables
3. Apply CAF naming and mandatory tags
4. Organize into standard file structure

---

## Reference Index

| File | Contents |
|------|----------|
| `references/manual-import.md` | Detailed az CLI discovery, bulk import scripts, resource mapping |
| `scripts/list_resources.sh` | Extract supported list resources from providers |
