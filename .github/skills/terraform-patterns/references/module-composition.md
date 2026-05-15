<!-- ref:module-composition-v1 -->

# Module Composition — Canonical Example

> Loaded by `terraform-patterns` SKILL.md when authoring or auditing a
> root module. Demonstrates the AVM-first composition pattern: pass
> outputs as inputs, never hardcode IDs.

```hcl
module "resource_group" {
  source  = "Azure/avm-res-resources-resourcegroup/azurerm"
  version = "~> 0.1"
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.tags
}

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"
  name                = local.kv_name
  resource_group_name = module.resource_group.name  # ← output wiring
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}
```

**Why this pattern**:

- `module.<name>.<output>` wiring keeps the dependency graph explicit and lets Terraform
  parallelize unrelated modules.
- Hardcoding IDs (`/subscriptions/…/resourceGroups/foo`) breaks reuse and re-creates a
  resource if a parent rename happens.
- Pinning `version = "~> X.Y"` allows AVM patch updates while preventing surprise major
  bumps.
- `local.tags` and `var.location` come from the project-level `locals` block, making the
  module body environment-agnostic.

The same wiring pattern applies to networking modules (output `vnet_id` →
`virtual_network_id` input), monitoring (`log_analytics_workspace_id`), and identity
(`principal_id`).
