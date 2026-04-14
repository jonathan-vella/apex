<!-- ref:project-scaffold-v1 -->

# Terraform Project Scaffold

Standard file structure and key patterns for every Terraform project.

## File Structure

```text
infra/terraform/{project}/
├── versions.tf             # Terraform + provider requirements
├── providers.tf            # Provider configuration (features {})
├── backend.tf              # Azure Storage Account backend
├── variables.tf            # All input variable declarations
├── locals.tf               # unique_suffix, tags, computed values
├── main.tf                 # Resource group + module calls
├── outputs.tf              # Resource IDs, endpoints, connection info
├── bootstrap-backend.sh    # Bash: provision storage account for state
├── bootstrap-backend.ps1   # PowerShell: same
├── deploy.sh               # Bash deployment script (deprecated — use azd)
├── deploy.ps1              # PowerShell deployment script (deprecated — use azd)
└── modules/                # Optional — only for complex sub-compositions
    └── {component}/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## Key Pattern: `locals.tf`

```hcl
locals {
  unique_suffix = substr(md5(azurerm_resource_group.this.id), 0, 6)

  tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
      Owner       = var.owner
    },
    var.additional_tags  # extra tags from governance constraints
  )
}
```

## Key Pattern: Phased Deployment

```hcl
variable "deployment_phase" {
  description = "Deployment phase to execute. Use 'all' for full deployment."
  type        = string
  default     = "all"

  validation {
    condition     = contains(["all", "foundation", "security", "data", "compute", "edge"], var.deployment_phase)
    error_message = "Invalid deployment_phase value."
  }
}

module "key_vault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.9"
  count   = var.deployment_phase == "all" || var.deployment_phase == "security" ? 1 : 0
  # ...
}
```

## Output Files

| File                     | Location                                                |
| ------------------------ | ------------------------------------------------------- |
| Preflight Check          | `agent-output/{project}/04-preflight-check.md`          |
| Implementation Ref       | `agent-output/{project}/05-implementation-reference.md` |
| Terraform Configurations | `infra/terraform/{project}/`                            |
| Bootstrap Backend (Bash) | `infra/terraform/{project}/bootstrap-backend.sh`        |
| Bootstrap Backend (PS)   | `infra/terraform/{project}/bootstrap-backend.ps1`       |
| Deploy Script (Bash)     | `infra/terraform/{project}/deploy.sh` *(deprecated — use azd)*  |
| Deploy Script (PS)       | `infra/terraform/{project}/deploy.ps1` *(deprecated — use azd)* |
