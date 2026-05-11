---
name: terraform-search-import
description: '**WORKFLOW SKILL** — Discover existing Azure resources and bulk import them into Terraform management. WHEN: "terraform import", "import Azure resources", "bring unmanaged infra under Terraform", "adopt Terraform for existing resources", "generate import blocks". USE FOR: importing Azure resources, audit, migration to IaC, bulk import. DO NOT USE FOR: Bicep code (use azure-bicep-patterns), new resource creation (use terraform-patterns), architecture decisions (use azure-adr).'
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

## Rules

- **Manual Discovery is the primary path** — always works with `azurerm ~> 4.0` and Azure CLI; Terraform Search is experimental and provider support is TBD
- **Pin provider to `~> 4.0`** — azurerm 4.x renamed many attributes (`allow_blob_public_access` → `allow_nested_items_to_be_public`, etc.); pinning to anything else causes drift after import
- **Plan before apply** — always run `terraform plan` after generating import blocks; the plan should show import actions ONLY (no creates / destroys)
- **Adopt AVM modules post-import** — raw `azurerm_*` is acceptable as a temporary state; refactor to `Azure/avm-res-*` modules with `moved {}` blocks (see `terraform-patterns` `references/refactor-module.md`)
- **Document the source** — in the imported `resource` block, comment the originating `az resource list` query so future runs can be reproduced
- **Out of scope**: Bicep code (use `azure-bicep-patterns`), new resource creation (use `terraform-patterns`), architecture decisions (use `azure-adr`)

## Manual Discovery Workflow (Primary)

Three-step procedure: (1) discover existing resources via `az resource list` (by resource
group, tag, or type-specific commands like `az vm list`); (2) generate `resource` + `import`
blocks for each (full examples and bulk import scripts in
[`references/manual-import.md`](references/manual-import.md)); (3) `terraform plan` (review:
imports only — no creates / destroys) → `terraform apply`.

Import ID format:
`/subscriptions/{sub}/resourceGroups/{rg}/providers/{type}/{name}`. The Azure-type ↔
Terraform-resource ↔ `az` CLI mapping table for the 8 most common services lives in
[`references/manual-import.md`](references/manual-import.md).

## Post-Import: Adopt AVM Modules

After importing raw `azurerm_*` resources, refactor to AVM modules using `moved {}` blocks.
See `terraform-patterns` skill `references/refactor-module.md` for guidance.

## Integration with Terraform MCP

Use Terraform MCP tools during import workflows:

| Tool                                      | Purpose                                      |
| ----------------------------------------- | -------------------------------------------- |
| `mcp_terraform_search_providers`          | Validate resource type support in provider   |
| `mcp_terraform_get_provider_details`      | Get resource schemas and import ID format    |
| `mcp_terraform_search_modules`            | Find AVM modules for post-import refactoring |
| `mcp_terraform_get_latest_module_version` | Get latest AVM module version                |

---

## Terraform Search Workflow (Experimental)

> **Warning**: Requires Terraform >= 1.14 and `azurerm` provider support for
> `list_resource_schemas` (TBD). Use Manual Discovery above as primary path.

Uses `.tfquery.hcl` files with `list` blocks to discover resources, then
`terraform query -generate-config-out=imported.tf` to generate config.
Clean generated output by removing computed attrs, adding variables, applying CAF naming.

---

## Reference Index

| File                          | Contents                                                         |
| ----------------------------- | ---------------------------------------------------------------- |
| `references/manual-import.md` | Detailed az CLI discovery, bulk import scripts, resource mapping |
| `scripts/list_resources.sh`   | Extract supported list resources from providers                  |
