data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 4
  lower   = true
  numeric = true
  special = false
  upper   = false
}

locals {
  suffix = random_string.suffix.result

  # Resource-level tags (PascalCase keys — Deny policy enforced)
  tags = merge({
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = var.project
    Owner       = var.owner
  }, var.additional_tags)

  # Resource Group tags (lowercase keys — JV-Enforce RG Tags v3 Deny policy requires 9 tags)
  rg_tags = {
    environment         = var.environment
    owner               = var.owner
    costcenter          = var.project
    application         = var.project
    workload            = "ecommerce-storefront"
    sla                 = "99.5"
    "backup-policy"     = "default"
    "maint-window"      = "weekends"
    "technical-contact" = var.owner
  }

  # Length-constrained names (24-char limit for KV and Storage)
  kv_name = "kv-${substr(replace(var.project, "terraform-", "tf"), 0, 4)}${substr(var.environment, 0, 3)}-${local.suffix}"
  st_name = "st${substr(replace(var.project, "-", ""), 0, 8)}${substr(var.environment, 0, 3)}${local.suffix}"
}
