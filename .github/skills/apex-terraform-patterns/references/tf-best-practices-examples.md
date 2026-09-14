<!-- ref:tf-best-practices-examples-v1 -->

# Terraform Best Practices — HCL Examples

Detailed HCL code examples for rules in
`iac-terraform-best-practices.instructions.md`.
Rules and enforcement live in the instruction file; this file is copy-paste code.

## Unique Suffix Pattern

Generate ONCE in the root module, pass to ALL child modules:

```hcl
# versions.tf or locals.tf
resource "random_string" "suffix" {
  length  = 4
  upper   = false
  lower   = true
  numeric = true
  special = false
}

locals {
  suffix = random_string.suffix.result

  # Length-constrained names
  kv_name = join("-", [
    "kv",
    substr(var.project, 0, 8),
    substr(var.environment, 0, 3),
    local.suffix
  ])
  st_name = "st${substr(
    replace(var.project, "-", ""), 0, 8
  )}${substr(var.environment, 0, 3)}${local.suffix}"
}
```

## Provider Configuration

```hcl
# versions.tf
terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}
```

```hcl
# providers.tf
provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
```

## State Backend

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-prod"
    storage_account_name = "sttfstate{suffix}"
    container_name       = "tfstate"
    key                  = "{project}.terraform.tfstate"
    use_azuread_auth      = true
  }
}
```

## Tags

```hcl
# locals.tf
locals {
  tags = merge(var.additional_tags, var.policy_tags)
}
```

Pass `local.tags` to every resource and AVM module. Populate `policy_tags` from
effective governance, preserving casing and values. Optional tags cannot override
that contract. Use the canonical greenfield fallback only when no tag policy applies.

## Security Defaults

```hcl
# Storage Account
resource "azurerm_storage_account" "this" {
  # ...
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
}

# SQL Server
resource "azurerm_mssql_server" "this" {
  # ...
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
  azuread_administrator {
    azuread_authentication_only = true
  }
}
```

## AVM-TF Examples

Use the pinned [canonical composition](module-composition.md) for Resource Group
and Key Vault. Raw `azurerm_*` requires approval when no suitable AVM module exists.

### Module Source Format

Registry sources use `Azure/avm-res-{service}-{resource}/azurerm` with an exact
approved semantic version, not a module version range.

### Common AVM Modules

| Resource        | Source                                         |
| --------------- | ---------------------------------------------- |
| Key Vault       | `Azure/avm-res-keyvault-vault/azurerm`         |
| Storage         | `Azure/avm-res-storage-storageaccount/azurerm` |
| Virtual Network | `Azure/avm-res-network-virtualnetwork/azurerm` |
| App Service     | `Azure/avm-res-web-site/azurerm`               |

Use the public Terraform Registry API per
`apex-azure-defaults/references/terraform-conventions.md`, then pin the resolved
stable version as exact semver.

Never replace an approved project pin with an example's version or an
unreviewed latest version.

## Variables

```hcl
# variables.tf
variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "swedencentral"

  validation {
    condition = contains(
      ["swedencentral", "germanywestcentral", "northeurope"],
      var.location
    )
    error_message = "Location must be an approved EU region."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  validation {
    condition = contains(
      ["dev", "staging", "prod"], var.environment
    )
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "policy_tags" {
  description = "Effective policy tag keys and values, or approved greenfield contract."
  type        = map(string)
}

variable "additional_tags" {
  description = "Optional tags; cannot override policy tags."
  type        = map(string)
  default     = {}
}
```

## Outputs

```hcl
# outputs.tf — every module must output BOTH ID and name
output "resource_group_id" {
  description = "Resource group resource ID."
  value       = azurerm_resource_group.this.id
}

output "resource_group_name" {
  description = "Resource group name."
  value       = azurerm_resource_group.this.name
}
```

---

## Code Formatting & Ordering

> Naming conventions and file organization are in
> `iac-terraform-best-practices.instructions.md`. Below covers
> formatting and block-internal ordering only.

### Indentation and Alignment

- Use **two spaces** per nesting level (no tabs)
- Align equals signs for consecutive arguments

```hcl
resource "azurerm_linux_virtual_machine" "web" {
  name                = "vm-web-${var.environment}"
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  size                = "Standard_B2s"

  tags = merge(local.tags, {
    Role = "web-server"
  })
}
```

### Block Organization

Arguments precede blocks, with meta-arguments first:

```hcl
resource "azurerm_linux_virtual_machine" "example" {
  # Meta-arguments
  count = var.instance_count

  # Arguments (required then optional, alphabetical)
  admin_username      = var.admin_username
  location            = var.location
  name                = "vm-${var.project}-${count.index}"
  resource_group_name = azurerm_resource_group.this.name
  size                = var.vm_size

  # Blocks
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
  }

  # Lifecycle last
  lifecycle {
    create_before_destroy = true
  }
}
```

### Dynamic Resource Creation

Prefer `for_each` over `count` for named resources
(see `iac-terraform-best-practices.instructions.md` for the rule;
this shows the pattern):

```hcl
# for_each with named instances
variable "subnet_map" {
  type = map(object({
    address_prefix = string
  }))
}

resource "azurerm_subnet" "this" {
  for_each             = var.subnet_map
  name                 = each.key
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value.address_prefix]
}
```

Use `count` only for conditional creation:

```hcl
resource "azurerm_nat_gateway" "this" {
  count               = var.enable_nat_gateway ? 1 : 0
  name                = "ng-${var.project}-${var.environment}"
  location            = var.location
  resource_group_name = azurerm_resource_group.this.name
}
```

## Version Control

**Never commit:**

- `terraform.tfstate`, `terraform.tfstate.backup`
- `.terraform/` directory
- `*.tfplan`
- `.tfvars` files with sensitive data

**Always commit:**

- All `.tf` configuration files
- `.terraform.lock.hcl` (dependency lock file)

## Code Review Checklist

- [ ] Code formatted with `terraform fmt`
- [ ] Configuration validated with `terraform validate`
- [ ] Files organized per standard structure
- [ ] All variables have `type` and `description`
- [ ] All outputs have `description`
- [ ] Resource names use descriptive nouns with underscores
- [ ] AVM module versions are exact approved semver; provider constraints retain the approved major series and lockfile
- [ ] Sensitive values marked with `sensitive = true`
- [ ] No hardcoded credentials or secrets
- [ ] Security best practices applied (TLS 1.2, HTTPS-only, managed identity)
- [ ] AVM modules used where available

_Source: [HashiCorp Terraform Style Guide](https://developer.hashicorp.com/terraform/language/style)_
