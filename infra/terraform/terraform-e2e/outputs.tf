# --------------------------------------------------------------------------
# Foundation outputs (always available)
# --------------------------------------------------------------------------

output "resource_group_id" {
  description = "Resource group resource ID."
  value       = azurerm_resource_group.this.id
}

output "resource_group_name" {
  description = "Resource group name."
  value       = azurerm_resource_group.this.name
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace resource ID."
  value       = module.log_analytics.resource_id
}

output "app_insights_connection_string" {
  description = "Application Insights connection string."
  value       = module.app_insights.connection_string
  sensitive   = true
}

output "app_insights_instrumentation_key" {
  description = "Application Insights instrumentation key (deprecated — use connection string)."
  value       = module.app_insights.instrumentation_key
  sensitive   = true
}

# --------------------------------------------------------------------------
# Phase 2 outputs
# --------------------------------------------------------------------------

output "key_vault_id" {
  description = "Key Vault resource ID."
  value       = var.deployment_phase >= 2 ? module.key_vault[0].resource_id : null
}

output "key_vault_uri" {
  description = "Key Vault URI."
  value       = var.deployment_phase >= 2 ? module.key_vault[0].uri : null
}

output "sql_server_id" {
  description = "SQL Server resource ID."
  value       = var.deployment_phase >= 2 ? module.sql_server[0].resource_id : null
}

output "sql_server_fqdn" {
  description = "SQL Server fully qualified domain name."
  value       = var.deployment_phase >= 2 ? module.sql_server[0].resource.fully_qualified_domain_name : null
  sensitive   = true
}

# --------------------------------------------------------------------------
# Phase 3 outputs
# --------------------------------------------------------------------------

output "app_service_default_hostname" {
  description = "Backend App Service default hostname."
  value       = var.deployment_phase >= 3 ? module.app_service[0].resource_uri : null
}

output "app_service_fe_default_hostname" {
  description = "Frontend App Service default hostname."
  value       = var.deployment_phase >= 3 ? module.app_service_fe[0].resource_uri : null
}

output "app_service_plan_id" {
  description = "App Service Plan resource ID."
  value       = var.deployment_phase >= 3 ? module.app_service_plan[0].resource_id : null
}
