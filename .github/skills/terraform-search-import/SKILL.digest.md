<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Terraform Search & Import for Azure (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## Reference Index

| File | Contents |
|------|----------|
| `references/manual-import.md` | Detailed az CLI discovery, bulk import scripts, resource mapping |
| `scripts/list_resources.sh` | Extract supported list resources from providers |
