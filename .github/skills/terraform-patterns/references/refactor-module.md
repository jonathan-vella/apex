<!-- ref:refactor-module-v1 -->

# Module Refactoring Guide

Transform monolithic Terraform configurations into reusable, maintainable modules.
For testing refactored modules, see the `terraform-test` skill.

---

## Analysis Phase

### Identify Refactoring Candidates

- Group resources by logical function
- Identify repeated patterns
- Map resource dependencies
- Detect configuration coupling
- Evaluate state migration complexity

### Complexity Assessment

| Factor                | Low  | Medium   | High        |
| --------------------- | ---- | -------- | ----------- |
| Resource count        | < 10 | 10–30    | > 30        |
| Cross-references      | Few  | Moderate | Dense graph |
| State entries to move | < 5  | 5–15     | > 15        |

## Module Design

### Interface Design

```hcl
variable "network_config" {
  description = "Network configuration parameters"
  type = object({
    address_space = list(string)
    subnets       = map(object({
      address_prefix = string
    }))
    enable_nat = bool
  })

  validation {
    condition     = length(var.network_config.address_space) > 0
    error_message = "At least one address space required."
  }
}

output "vnet_id" {
  description = "ID of the created virtual network"
  value       = azurerm_virtual_network.this.id
}

output "subnet_ids" {
  description = "Map of subnet names to IDs"
  value = { for k, v in azurerm_subnet.this : k => v.id }
}
```

### Encapsulation Strategy

**Include in module:**

- Tightly coupled resources (VNet + subnets + NSGs)
- Resources with shared lifecycle
- Configuration with clear boundaries

**Keep separate:**

- Cross-cutting concerns (monitoring, tagging)
- Resources with different lifecycles
- Provider-specific configurations

## Code Transformation

### Before: Monolithic Configuration

```hcl
resource "azurerm_virtual_network" "main" {
  name                = "vnet-production"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "web" {
  name                 = "snet-web"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_subnet" "app" {
  name                 = "snet-app"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = ["10.0.2.0/24"]
}

resource "azurerm_network_security_group" "web" {
  name                = "nsg-web"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
}
```

### After: Modular Structure

```hcl
# modules/networking/main.tf
resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.name}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = var.address_space
  tags                = var.tags
}

resource "azurerm_subnet" "this" {
  for_each = var.subnets

  name                 = "snet-${each.key}"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value.address_prefix]
}

# modules/networking/variables.tf
variable "name" {
  description = "Name prefix for all networking resources"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "resource_group_name" {
  description = "Resource group for networking resources"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "address_space" {
  description = "VNet address space"
  type        = list(string)
}

variable "subnets" {
  description = "Map of subnet names to configuration"
  type = map(object({
    address_prefix = string
  }))
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# modules/networking/outputs.tf
output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.this.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.this.name
}

output "subnet_ids" {
  description = "Map of subnet names to IDs"
  value = { for k, v in azurerm_subnet.this : k => v.id }
}

# Root configuration using module
module "networking" {
  source = "./modules/networking"

  name                = var.project
  environment         = var.environment
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  address_space       = ["10.0.0.0/16"]

  subnets = {
    web = { address_prefix = "10.0.1.0/24" }
    app = { address_prefix = "10.0.2.0/24" }
  }

  tags = local.tags
}
```

## State Migration

### Using moved blocks (Terraform 1.1+, preferred)

```hcl
# migration.tf — add temporarily, remove after successful apply
moved {
  from = azurerm_virtual_network.main
  to   = module.networking.azurerm_virtual_network.this
}

moved {
  from = azurerm_subnet.web
  to   = module.networking.azurerm_subnet.this["web"]
}

moved {
  from = azurerm_subnet.app
  to   = module.networking.azurerm_subnet.this["app"]
}
```

### Manual state migration (pre-1.1 fallback)

```bash
terraform state mv azurerm_virtual_network.main \
  module.networking.azurerm_virtual_network.this

terraform state mv azurerm_subnet.web \
  'module.networking.azurerm_subnet.this["web"]'

terraform state mv azurerm_subnet.app \
  'module.networking.azurerm_subnet.this["app"]'
```

**Always** test migration in non-production first:

```bash
terraform plan -out=migration.tfplan
terraform show migration.tfplan   # Verify NO changes
terraform apply migration.tfplan
```

## Refactoring Patterns

### Pattern 1: Resource Grouping

Extract related resources into cohesive modules:

- **Networking**: VNet, subnets, NSGs, route tables
- **Compute**: VMs, VMSS, load balancers
- **Data**: SQL, Cosmos DB, storage accounts
- **Security**: Key Vault, managed identities, RBAC

### Pattern 2: Configuration Layering

```hcl
# Base module with defaults
module "networking_base" {
  source = "./modules/networking"
  # Minimal required inputs
}

# Environment-specific wrapper
module "networking_prod" {
  source = "./modules/networking-prod"
  # Inherits from base, adds prod-specific config
}
```

### Pattern 3: Composition

```hcl
module "networking" {
  source = "./modules/networking"
}

module "security" {
  source = "./modules/security"
  vnet_id    = module.networking.vnet_id
  subnet_ids = module.networking.subnet_ids
}

module "application" {
  source     = "./modules/application"
  subnet_ids = module.networking.subnet_ids
  kv_id      = module.security.key_vault_id
}
```

## Common Pitfalls

### Over-Abstraction

```hcl
# Avoid: too generic, hard to validate
variable "resources" {
  type = map(map(any))
}

# Prefer: specific, typed interfaces
variable "database_config" {
  type = object({
    sku_name   = string
    storage_mb = number
  })
}
```

### Tight Coupling

Pass dependencies through the root module rather than cross-referencing modules directly.

### State Migration Errors

Always run `terraform plan` after migration to verify **zero changes**.
If changes appear, the migration mapping is incorrect.

## Success Criteria

- [ ] Module has single, well-defined responsibility
- [ ] All variables have descriptions and types
- [ ] Validation rules prevent invalid configurations
- [ ] Outputs provide sufficient information for consumers
- [ ] State migration completed without resource recreation
- [ ] `terraform plan` shows no changes after refactoring
- [ ] Tests verify module behavior (see `terraform-test` skill)
