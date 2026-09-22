---
name: apex-terraform-search-import
user-invocable: true
disable-model-invocation: true
argument-hint: "resource scope and search or import task"
description: '**WORKFLOW SKILL** — Manual-only discovery and import of existing Azure resources into Terraform management. WHEN: explicitly invoked as /apex-terraform-search-import for resource discovery or import planning. DO NOT USE FOR: automatic Terraform routing, Bicep code, new resource creation, architecture decisions. State changes require separate approval.'
compatibility: Manual workflow requires azurerm ~> 4.0 + Azure CLI. Search workflow requires Terraform >= 1.14 (experimental for azurerm).
---

# Terraform Search & Import for Azure

Manual-only: use `/apex-terraform-search-import` explicitly before this search/import workflow.
Do not auto-invoke it from a generic Terraform request. Invocation does not authorize state adoption or apply;
retain scope confirmation, import-only plan review and separate human authorization for state changes.

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

- **Manual Discovery is the primary path** with `azurerm ~> 4.0` and Azure CLI;
   Terraform Search is experimental and provider support is TBD.
- **Pin provider to `~> 4.0`** and retain the lockfile. Validate renamed 4.x attributes
   against the approved provider schema before import.
- **Plan before apply**: save and review an import-only plan, with no creates, updates,
   deletes or replacements; state adoption/apply requires explicit human authorization.
- **Adopt AVM modules post-import**: raw `azurerm_*` is acceptable as a temporary state;
   refactor with `moved {}` blocks per `apex-terraform-patterns` `references/refactor-module.md`.
- **Document the source**: record the originating `az resource list` query so discovery can be reproduced.
- **Out of scope**: Bicep (`apex-azure-bicep-patterns`), new resources (`apex-terraform-patterns`),
   architecture decisions (`apex-azure-adr`).

## Manual Discovery Workflow (Primary)

Three-step procedure: (1) discover existing resources via `az resource list` (by resource
group, tag, or type-specific commands like `az vm list`); (2) generate `resource` + `import`
blocks for each (full examples and bulk import scripts in
[`references/manual-import.md`](references/manual-import.md)); (3) `terraform plan` (review:
imports only — no creates / destroys) → `terraform apply`.
Use the saved-plan check in the manual reference before requesting approval;
discovery or generated import blocks do not authorize state changes.

Import ID format:
`/subscriptions/{sub}/resourceGroups/{rg}/providers/{type}/{name}`. The Azure-type ↔
Terraform-resource ↔ `az` CLI mapping table for the 8 most common services lives in
[`references/manual-import.md`](references/manual-import.md).

## Post-Import: Adopt AVM Modules

After importing raw `azurerm_*` resources, refactor to AVM modules using `moved {}` blocks.
See `apex-terraform-patterns` skill `references/refactor-module.md` for guidance.

## Provider and Module Metadata

Use Azure MCP or Azure CLI to discover deployed resource IDs. Use the public
Terraform Registry API for provider/module search and versions, then run
caller-approved `terraform init` preserving the lockfile, and
`terraform providers schema -json` for resource schemas. The
[list helper](scripts/list_resources.sh) only inspects schemas; it never initializes
or upgrades dependencies. A nonzero result means schema/initialization failure:
stop and diagnose it, not "Search unsupported". Only a successful empty list means
no list capability for the selected initialized provider.
The canonical commands and source boundaries are in
[`terraform-conventions.md`](../apex-azure-defaults/references/terraform-conventions.md).

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
