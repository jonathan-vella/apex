# --------------------------------------------------------------------------
# Phase 1: Foundation & Monitoring
# --------------------------------------------------------------------------

resource "azurerm_resource_group" "this" {
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.rg_tags
}

module "log_analytics" {
  source  = "Azure/avm-res-operationalinsights-workspace/azurerm"
  version = "~> 0.5"

  name                = "log-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

  log_analytics_workspace_retention_in_days = 30

  tags = local.tags
}

module "app_insights" {
  source  = "Azure/avm-res-insights-component/azurerm"
  version = "~> 0.3"

  name                = "appi-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location

  application_type = "web"
  workspace_id     = module.log_analytics.resource_id

  tags = local.tags
}

# --------------------------------------------------------------------------
# Phase 2: Security & Data
# --------------------------------------------------------------------------

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.10"
  count   = var.deployment_phase >= 2 ? 1 : 0

  name                       = local.kv_name
  resource_group_name        = azurerm_resource_group.this.name
  location                   = azurerm_resource_group.this.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  purge_protection_enabled   = true
  soft_delete_retention_days = 90
  sku_name                   = "standard"

  tags = local.tags
}

module "sql_server" {
  source  = "Azure/avm-res-sql-server/azurerm"
  version = "~> 0.1"
  count   = var.deployment_phase >= 2 ? 1 : 0

  name                = "sql-${var.project}-${var.environment}-${local.suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  server_version      = "12.0"

  administrator_login = null

  azuread_administrator = {
    login_username              = var.sql_admin_login_name
    object_id                   = var.sql_admin_object_id != "" ? var.sql_admin_object_id : data.azurerm_client_config.current.object_id
    azuread_authentication_only = true
  }

  databases = {
    ecommerce = {
      name     = "sqldb-${var.project}-${var.environment}"
      sku_name = "Basic"
    }
  }

  tags = local.tags
}

# --------------------------------------------------------------------------
# Phase 3: Compute & Frontend
# --------------------------------------------------------------------------

module "app_service_plan" {
  source  = "Azure/avm-res-web-serverfarm/azurerm"
  version = "~> 2.0"
  count   = var.deployment_phase >= 3 ? 1 : 0

  name      = "asp-${var.project}-${var.environment}"
  parent_id = azurerm_resource_group.this.id
  location  = azurerm_resource_group.this.location

  os_type  = "Linux"
  sku_name = "P1v3"

  tags = local.tags
}

module "app_service" {
  source  = "Azure/avm-res-web-site/azurerm"
  version = "~> 0.21"
  count   = var.deployment_phase >= 3 ? 1 : 0

  name      = "app-${var.project}-${var.environment}-${local.suffix}"
  parent_id = azurerm_resource_group.this.id
  location  = azurerm_resource_group.this.location

  kind                     = "webapp"
  os_type                  = "Linux"
  service_plan_resource_id = module.app_service_plan[0].resource_id
  https_only               = true

  managed_identities = {
    system_assigned = true
  }

  application_insights_connection_string = module.app_insights.connection_string

  app_settings = {
    KEY_VAULT_URI = var.deployment_phase >= 2 ? module.key_vault[0].uri : ""
  }

  tags = local.tags
}

module "app_service_fe" {
  source  = "Azure/avm-res-web-site/azurerm"
  version = "~> 0.21"
  count   = var.deployment_phase >= 3 ? 1 : 0

  name      = "app-${var.project}-fe-${var.environment}-${local.suffix}"
  parent_id = azurerm_resource_group.this.id
  location  = azurerm_resource_group.this.location

  kind                     = "webapp"
  os_type                  = "Linux"
  service_plan_resource_id = module.app_service_plan[0].resource_id
  https_only               = true

  managed_identities = {
    system_assigned = true
  }

  application_insights_connection_string = module.app_insights.connection_string

  tags = local.tags
}

# --------------------------------------------------------------------------
# RBAC Role Assignments (Phase 3)
# --------------------------------------------------------------------------

resource "azurerm_role_assignment" "app_kv_secrets" {
  count                = var.deployment_phase >= 3 ? 1 : 0
  scope                = module.key_vault[0].resource_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = module.app_service[0].system_assigned_mi_principal_id
}

resource "azurerm_role_assignment" "app_sql_contributor" {
  count                = var.deployment_phase >= 3 ? 1 : 0
  scope                = module.sql_server[0].resource_id
  role_definition_name = "Contributor"
  principal_id         = module.app_service[0].system_assigned_mi_principal_id
}
