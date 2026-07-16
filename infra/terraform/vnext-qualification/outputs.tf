output "resource_id" {
  description = "Resource ID of the Terraform qualification storage account."
  value       = module.storage_account.resource_id
}

output "resource_name" {
  description = "Name of the Terraform qualification storage account."
  value       = module.storage_account.name
}

output "principal_id" {
  description = "Storage account principal ID; null because no managed identity is enabled."
  value       = null
}