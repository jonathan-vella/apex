---
description: "Infrastructure as Code best practices for Azure Terraform templates. AVM-first, CAF naming, security baseline."
applyTo: "**/*.tf"
---

# Terraform Development Best Practices

## Quick Reference

| Rule          | Standard                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| Region        | `swedencentral` (alt: `germanywestcentral`)                              |
| Unique suffix | `resource "random_string" "suffix" { length = 4; lower = true }` in root |
| AVM first     | **MANDATORY** - Use Azure Verified Modules where available               |
| Tags          | Environment, ManagedBy, Project, Owner on ALL resources                  |
| Provider      | Pin `azurerm` to `~> 4.0`                                                |
| State backend | Azure Storage Account — **NEVER** HCP Terraform Cloud                    |

> [!IMPORTANT]
> The 4 tags above are baseline defaults. Discovered Azure Policy constraints
> (`04-governance-constraints.md`) ALWAYS take precedence. See
> `terraform-policy-compliance.instructions.md`.

## File Structure (MANDATORY)

Every root module MUST follow this file layout:

| File           | Purpose                                      |
| -------------- | -------------------------------------------- |
| `main.tf`      | Root module resources and module calls       |
| `variables.tf` | Input variable declarations                  |
| `outputs.tf`   | Output value declarations                    |
| `providers.tf` | Provider configuration blocks                |
| `versions.tf`  | `terraform {}` block with required_providers |
| `locals.tf`    | Local value computations                     |
| `backend.tf`   | Remote state backend configuration           |

## Naming Conventions

### Resource Identifiers

Use `azurerm_resource_group.this` for singleton resources (single instance per module).
Use descriptive names for multiple instances: `azurerm_subnet.app`, `azurerm_subnet.data`.

```hcl
# Singleton resource pattern
resource "azurerm_resource_group" "this" {
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.tags
}
```

### Azure Resource Names

Use lowercase with hyphens for Azure resource names. Follow CAF abbreviations:

| Resource        | Pattern                        | Example                |
| --------------- | ------------------------------ | ---------------------- |
| Resource Group  | `rg-{project}-{env}`           | `rg-contoso-dev`       |
| Virtual Network | `vnet-{project}-{env}`         | `vnet-contoso-dev`     |
| Key Vault       | `kv-{short}-{env}-{suffix}`    | `kv-contoso-dev-a1b2`  |
| Storage Account | `st{short}{env}{suffix}`       | `stcontosodevа1b2`     |
| App Service     | `app-{project}-{env}-{suffix}` | `app-contoso-dev-a1b2` |
| SQL Server      | `sql-{project}-{env}-{suffix}` | `sql-contoso-dev-a1b2` |

> [!CAUTION]
> Storage Account names have a 24-char limit and no hyphens. Key Vault names have a
> 24-char limit. Always use `substr()` to trim long names.

## Unique Suffix Pattern (CRITICAL)

Generate ONCE in the root module, pass to ALL child modules:

```hcl
# versions.tf or locals.tf
resource "random_string" "suffix" {
  length  = 4
  lower   = true
  numeric = true
  special = false
}

locals {
  suffix = random_string.suffix.result

  # Length-constrained names
  kv_name  = "kv-${substr(var.project, 0, 8)}-${substr(var.environment, 0, 3)}-${local.suffix}"
  st_name  = "st${substr(replace(var.project, "-", ""), 0, 8)}${substr(var.environment, 0, 3)}${local.suffix}"
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

## State Backend (MANDATORY)

Use Azure Storage Account for remote state. **NEVER** use HCP Terraform Cloud.

```hcl
# backend.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-prod"
    storage_account_name = "sttfstate{suffix}"
    container_name       = "tfstate"
    key                  = "{project}.terraform.tfstate"
  }
}
```

## Tags (MANDATORY)

> [!IMPORTANT]
> These 4 tags are the MINIMUM baseline. Azure Policy in your subscription may enforce
> additional tags. Always defer to `04-governance-constraints.md` for the actual required tag list.

```hcl
# locals.tf
locals {
  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = var.project
    Owner       = var.owner
  })
}
```

Pass `local.tags` to every resource and AVM module.

## Security Defaults (MANDATORY)

> [!IMPORTANT]
> The security settings below are baseline defaults. Discovered Azure Policy
> security constraints (`04-governance-constraints.md`) ALWAYS take precedence.
> See `terraform-policy-compliance.instructions.md`.

```hcl
# Storage Account
resource "azurerm_storage_account" "this" {
  # ...
  https_traffic_only_enabled    = true
  min_tls_version               = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled     = false  # Policy may require this
}

# SQL Server
resource "azurerm_mssql_server" "this" {
  # ...
  minimum_tls_version          = "1.2"
  public_network_access_enabled = false
  azuread_administrator {
    azuread_authentication_only = true
  }
}
```

## RBAC Least Privilege (MANDATORY)

Do not grant broad built-in control-plane roles to runtime app identities.

### Forbidden by Default

The following roles are **not allowed** for application runtime identities unless
explicitly approved in a tracked exception:

- `Owner`
- `Contributor`
- `User Access Administrator`

### Approved Role Mappings

Use the smallest role and narrowest scope that satisfies the workload.

| Resource Type | Approved Role(s)                                                    | Required Scope Pattern             |
| ------------- | ------------------------------------------------------------------- | ---------------------------------- |
| Key Vault     | `Key Vault Secrets User`                                            | Specific Key Vault resource ID     |
| Storage Blob  | `Storage Blob Data Reader` / `Storage Blob Data Contributor`        | Storage account or container scope |
| SQL Database  | `SQL DB Contributor` (or DB-level Entra roles)                      | Database scope, not server scope   |
| Service Bus   | `Azure Service Bus Data Sender` / `Azure Service Bus Data Receiver` | Namespace or queue/topic scope     |
| Event Hubs    | `Azure Event Hubs Data Sender` / `Azure Event Hubs Data Receiver`   | Namespace or hub scope             |
| ACR Pull      | `AcrPull`                                                           | Specific registry scope            |

### SQL-Specific Rule

For app-to-SQL access, prefer:

1. Entra-based DB user and DB roles (`db_datareader`, `db_datawriter`) where possible
2. Otherwise `SQL DB Contributor` at database scope

Never assign `Contributor` at SQL server scope for app runtime identities.

### Exception Process

If a broad role is unavoidable, all of the following are required:

1. Inline comment marker on the role assignment:
   `RBAC_EXCEPTION_APPROVED: <ticket-or-ADR>`
2. Matching justification in implementation docs (ADR or implementation reference)
3. Time-bound review date and owner in the justification

Without all three, the configuration is non-compliant.

## Azure Verified Modules (AVM-TF)

**MANDATORY: Use AVM-TF modules for ALL resources where an AVM module exists.**

Raw `azurerm_*` resources are only permitted when no AVM module exists AND the user
explicitly approves. Document the rationale in the implementation reference.

```hcl
# ✅ Use AVM-TF for Key Vault
module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"

  name                = local.kv_name
  resource_group_name = azurerm_resource_group.this.name
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}

# ❌ Only use raw azurerm_* if no AVM module exists
# Requires explicit user approval: "approve raw terraform"
```

### AVM-TF Module Source Format

```hcl
source  = "Azure/avm-res-{service}-{resource}/azurerm"
version = "~> {major}.{minor}"
```

Examples:

| Resource        | Source                                         |
| --------------- | ---------------------------------------------- |
| Key Vault       | `Azure/avm-res-keyvault-vault/azurerm`         |
| Storage         | `Azure/avm-res-storage-storageaccount/azurerm` |
| Virtual Network | `Azure/avm-res-network-virtualnetwork/azurerm` |
| App Service     | `Azure/avm-res-web-site/azurerm`               |

Use `mcp_terraform_get_latest_module_version` or `registry.terraform.io/modules/Azure`
to find the latest version before generating code. Update pinned minor version
(`~> X.Y`) to the latest available.

## Variables

```hcl
# variables.tf
variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "swedencentral"

  validation {
    condition     = contains(["swedencentral", "germanywestcentral", "northeurope"], var.location)
    error_message = "Location must be an approved EU region."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "tags" {
  description = "Additional tags to merge with baseline tags."
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

## Managed Identity Pattern

Prefer SystemAssigned managed identity over access keys or connection strings:

```hcl
resource "azurerm_linux_web_app" "this" {
  # ...
  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_role_assignment" "app_kv" {
  scope                = module.key_vault.resource_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.this.identity[0].principal_id
}
```

## Lifecycle Rules

```hcl
# Avoid phantom diffs on externally-managed tags
lifecycle {
  ignore_changes = [tags["DateCreated"]]
}

# Prevent accidental deletion of stateful resources
lifecycle {
  prevent_destroy = true
}
```

## Resource Renaming Without Destroy

Use `moved` blocks instead of destroying and re-creating:

```hcl
moved {
  from = azurerm_key_vault.main
  to   = azurerm_key_vault.this
}
```

## Patterns to Avoid

| Anti-Pattern                    | Problem                       | Solution                               |
| ------------------------------- | ----------------------------- | -------------------------------------- |
| Hardcoded resource names        | Naming collisions             | Use `random_string.suffix`             |
| `count` for named resources     | Index-based drift on deletion | Use `for_each` with string keys        |
| Missing `description` on vars   | Poor documentation            | Document all input variables           |
| `>= 3.0` provider version range | Unintended major upgrades     | Use `~> 4.0` for minor-version pinning |
| HCP Terraform Cloud as backend  | Vendor lock-in                | Use Azure Storage Account backend      |
| Raw `azurerm_*` when AVM exists | Policy drift and maintenance  | Use AVM-TF modules or get approval     |
| `connection_string` auth        | Credential exposure           | Use managed identity RBAC              |

## Validation Commands

```bash
terraform fmt -recursive
terraform validate
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan | python scripts/analyze_plan.py  # optional: set-diff analysis
```

Always run `terraform fmt` before committing. Always run `terraform validate` before planning.

## Cross-References

- **Policy compliance**: `.github/instructions/terraform-policy-compliance.instructions.md`
- **Governance discovery**: `.github/instructions/governance-discovery.instructions.md`
- **Terraform patterns**: `.github/skills/terraform-patterns/SKILL.md`
- **Azure defaults**: `.github/skills/azure-defaults/SKILL.md`
