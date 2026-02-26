variable "subscription_id" {
  description = "Azure subscription ID for the deployment."
  type        = string
}

variable "project" {
  description = "Project identifier used in resource naming."
  type        = string
  default     = "terraform-e2e"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "swedencentral"

  validation {
    condition     = contains(["swedencentral", "germanywestcentral"], var.location)
    error_message = "Location must be an approved EU region (swedencentral or germanywestcentral)."
  }
}

variable "owner" {
  description = "Resource owner for tagging and RBAC."
  type        = string
  default     = "team-terraform"
}

variable "deployment_phase" {
  description = "Deployment phase to execute (1=foundation, 2=security+data, 3=compute). Use 3 for full deployment."
  type        = number
  default     = 3

  validation {
    condition     = var.deployment_phase >= 1 && var.deployment_phase <= 3
    error_message = "Deployment phase must be 1, 2, or 3."
  }
}

variable "sql_admin_object_id" {
  description = "Entra ID object ID for the SQL Server administrator."
  type        = string
  default     = ""
}

variable "sql_admin_login_name" {
  description = "Entra ID login name for the SQL Server administrator."
  type        = string
  default     = "sqladmin-terraform-e2e"
}

variable "additional_tags" {
  description = "Additional tags to merge with baseline tags."
  type        = map(string)
  default     = {}
}
