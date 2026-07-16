variable "project_name" {
  description = "Short project identifier used in Azure resource names."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.project_name))
    error_message = "project_name must contain 3-20 lowercase letters, numbers, or hyphens."
  }
}

variable "environment" {
  description = "Qualification environment identifier."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,20}$", var.environment))
    error_message = "environment must contain 3-20 lowercase letters, numbers, or hyphens."
  }
}

variable "location" {
  description = "Azure region for the qualification workload."
  type        = string
}

variable "resource_group_name" {
  description = "Existing resource group dedicated to the Terraform qualification workload."
  type        = string
}

variable "log_analytics_workspace_resource_id" {
  description = "Resource ID of the shared Log Analytics workspace."
  type        = string
}

variable "tags" {
  description = "Live-policy tag contract applied to the workload."
  type        = map(string)

  validation {
    condition = alltrue([
      for key in [
        "environment",
        "owner",
        "costcenter",
        "application",
        "workload",
        "sla",
        "backup-policy",
        "maint-window",
        "technical-contact",
        "tech-contact"
      ] : contains(keys(var.tags), key)
    ])
    error_message = "tags must contain the complete live-policy qualification contract."
  }
}