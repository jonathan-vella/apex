# recipes/sql/terraform/sql.tf
# Azure SQL Database recipe module for Terraform — adds SQL Server, database,
# and configuration for Azure Functions with managed identity authentication.
#
# REQUIREMENTS FOR BASE TEMPLATE:
# 1. Storage account MUST have: shared_access_key_enabled = false (Azure policy)
# 2. Storage account MUST have: allow_nested_items_to_be_public = false
# 3. Function app SHOULD use: storage_uses_managed_identity = true
# 4. Provider SHOULD set: storage_use_azuread = true
# 5. Function app MUST have tag: "azd-service-name" = "api" (for azd deploy)
#
# USAGE: Copy this file into infra/ alongside the base template's main.tf.
# Reference the function app identity from the base template.

# ============================================================================
# Variables (add to variables.tf if not already present)
# ============================================================================
variable "vnet_enabled" {
  type        = bool
  default     = true
  description = "VNet integration and private endpoints are required for SQL in every environment"
  validation {
    condition     = var.vnet_enabled
    error_message = "SQL requires private networking; vnet_enabled must be true."
  }
}

variable "is_production" {
  type        = bool
  default     = true
  description = "Retained for caller compatibility; SQL requires private networking in every environment"
}

variable "sql_public_network_access_approved" {
  type        = bool
  default     = false
  description = "Deprecated compatibility parameter; public SQL access is not permitted"
  validation {
    condition     = !var.sql_public_network_access_approved
    error_message = "Public SQL access is not permitted in any environment."
  }
}

variable "uami_client_id" {
  type        = string
  description = "Function user-assigned managed identity client ID"
}

variable "environment_name" {
  type        = string
  description = "Environment name used for resource naming and tagging"
}

variable "sql_database_name" {
  type        = string
  default     = "appdb"
  description = "SQL Database name"
}

variable "sql_admin_object_id" {
  type        = string
  description = "AAD admin object ID for SQL Server"
}

variable "sql_admin_login" {
  type        = string
  description = "AAD admin login name (UPN or group name)"
}

# ============================================================================
# Locals (merge with base template locals if already defined)
# ============================================================================
locals {
  tags = {
    "Environment" = var.environment_name
    "ManagedBy"   = "Terraform"
  }
}

# ============================================================================
# Naming
# ============================================================================
resource "azurecaf_name" "sql_server" {
  name          = var.environment_name
  resource_type = "azurerm_mssql_server"
  random_length = 5
}

# ============================================================================
# SQL Server
# ============================================================================
resource "azurerm_mssql_server" "main" {
  name                          = azurecaf_name.sql_server.result
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false

  lifecycle {
    precondition {
      condition     = var.vnet_enabled
      error_message = "Private SQL requires approved VNet integration, private endpoint and DNS."
    }
  }

  azuread_administrator {
    login_username              = var.sql_admin_login
    object_id                   = var.sql_admin_object_id
    tenant_id                   = data.azurerm_client_config.current.tenant_id
    azuread_authentication_only = true # Entra-only, no SQL auth
  }

  tags = local.tags
}

# ============================================================================
# SQL Database
# ============================================================================
resource "azurerm_mssql_database" "main" {
  name        = var.sql_database_name
  server_id   = azurerm_mssql_server.main.id
  collation   = "SQL_Latin1_General_CP1_CI_AS"
  sku_name    = "Basic"
  max_size_gb = 2

  tags = local.tags
}

# ============================================================================
# NOTE: SQL RBAC for managed identity requires T-SQL
# The function app's managed identity must be added as a database user:
#
# CREATE USER [<function-app-name>] FROM EXTERNAL PROVIDER;
# ALTER ROLE db_datareader ADD MEMBER [<function-app-name>];
# ALTER ROLE db_datawriter ADD MEMBER [<function-app-name>];
#
# This cannot be done via Terraform - use a null_resource with sqlcmd or
# a post-deploy script.
# ============================================================================

# ============================================================================
# Networking: Private Endpoint (conditional on vnet_enabled)
# ============================================================================
resource "azurerm_private_dns_zone" "sql" {
  count               = var.vnet_enabled ? 1 : 0
  name                = "privatelink.database.windows.net"
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "sql" {
  count                 = var.vnet_enabled ? 1 : 0
  name                  = "sql-dns-link"
  resource_group_name   = azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.sql[0].name
  virtual_network_id    = azurerm_virtual_network.main[0].id
}

resource "azurerm_private_endpoint" "sql" {
  count               = var.vnet_enabled ? 1 : 0
  name                = "pe-${azurerm_mssql_server.main.name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  subnet_id           = azurerm_subnet.private_endpoints[0].id
  tags                = local.tags

  private_service_connection {
    name                           = "sql-connection"
    private_connection_resource_id = azurerm_mssql_server.main.id
    subresource_names              = ["sqlServer"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "sql-dns-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.sql[0].id]
  }
}

# ============================================================================
# Function App Settings Additions
# ============================================================================
locals {
  sql_app_settings = {
    "AZURE_SQL_CONNECTION_STRING_KEY" = "Server=tcp:${azurerm_mssql_server.main.fully_qualified_domain_name},1433;Database=${var.sql_database_name};Authentication=Active Directory Managed Identity;User Id=${var.uami_client_id};Encrypt=True;TrustServerCertificate=False;"
    "SQL_SERVER_NAME"                 = azurerm_mssql_server.main.name
    "SQL_DATABASE_NAME"               = var.sql_database_name
  }
}

# ============================================================================
# Outputs
# ============================================================================
output "SQL_SERVER_NAME" {
  value = azurerm_mssql_server.main.name
}

output "SQL_SERVER_FQDN" {
  value = azurerm_mssql_server.main.fully_qualified_domain_name
}

output "SQL_DATABASE_NAME" {
  value = var.sql_database_name
}
