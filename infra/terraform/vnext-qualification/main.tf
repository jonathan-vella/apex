data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

resource "random_string" "suffix" {
  length  = 4
  lower   = true
  numeric = true
  special = false
  upper   = false
}

locals {
  storage_account_name = substr(
    lower("st${substr(replace(var.project_name, "-", ""), 0, 8)}${substr(var.environment, 0, 4)}${random_string.suffix.result}"),
    0,
    24
  )
}

module "storage_account" {
  source  = "Azure/avm-res-storage-storageaccount/azurerm"
  version = "0.7.3"

  name                              = local.storage_account_name
  parent_id                         = data.azurerm_resource_group.this.id
  location                          = var.location
  tags                              = var.tags
  account_kind                      = "StorageV2"
  account_sku_name                  = "Standard_LRS"
  allow_nested_items_to_be_public   = false
  cross_tenant_replication_enabled  = false
  default_to_oauth_authentication   = true
  enable_telemetry                  = false
  https_traffic_only_enabled        = true
  infrastructure_encryption_enabled = true
  min_tls_version                   = "TLS1_2"
  public_network_access_enabled     = false
  shared_access_key_enabled         = false

  network_rules = {
    bypass         = ["AzureServices", "Logging", "Metrics"]
    default_action = "Deny"
  }

  blob_properties = {
    versioning_enabled = true
    delete_retention_policy = {
      days    = 7
      enabled = true
    }
    container_delete_retention_policy = {
      days    = 7
      enabled = true
    }
  }

  containers = {
    qualification = {
      name          = "qualification"
      public_access = "None"
    }
  }

  diagnostic_settings_storage_account = {
    account = {
      name                           = "diag-account"
      log_analytics_destination_type = "Dedicated"
      workspace_resource_id          = var.log_analytics_workspace_resource_id
      metrics = [{
        category = "AllMetrics"
      }]
    }
  }

  diagnostic_settings_blob = {
    blob = {
      name                           = "diag-blob"
      log_analytics_destination_type = "Dedicated"
      workspace_resource_id          = var.log_analytics_workspace_resource_id
      logs = [{
        category_group = "allLogs"
      }]
      metrics = [{
        category = "AllMetrics"
      }]
    }
  }
}