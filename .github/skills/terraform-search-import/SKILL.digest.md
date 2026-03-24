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

> _See SKILL.md for full content._

## Manual Discovery Workflow (Primary)

### Step 1: Discover Resources with az CLI

```bash
az resource list --resource-group rg-contoso-prod --output table
az resource list --tag Environment=prod --output json
```

> _See SKILL.md for full content._

## Post-Import: Adopt AVM Modules

After importing raw `azurerm_*` resources, refactor to AVM modules using `moved {}` blocks.
See `terraform-patterns` skill `references/refactor-module.md` for guidance.

## Integration with Terraform MCP

Use Terraform MCP tools during import workflows:

| Tool | Purpose |
|------|---------|
| `mcp_terraform_search_providers` | Validate resource type support in provider |
| `mcp_terraform_get_provider_details` | Get resource schemas and import ID format |
| `mcp_terraform_search_modules` | Find AVM modules for post-import refactoring |

> _See SKILL.md for full content._

## Terraform Search Workflow (Experimental)

> **Warning**: Requires Terraform >= 1.14 and `azurerm` provider support for
> `list_resource_schemas` (TBD). Use Manual Discovery above as primary path.

Uses `.tfquery.hcl` files with `list` blocks to discover resources, then
`terraform query -generate-config-out=imported.tf` to generate config.
Clean generated output by removing computed attrs, adding variables, applying CAF naming.

> _See SKILL.md for full content._

## Reference Index

| File | Contents |
|------|----------|
| `references/manual-import.md` | Detailed az CLI discovery, bulk import scripts, resource mapping |
| `scripts/list_resources.sh` | Extract supported list resources from providers |
