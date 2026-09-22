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
resource "random_string" "suffix" {
  length  = 4
  upper   = false
  lower   = true
  numeric = true
  special = false
}

locals {
  unique_suffix = random_string.suffix.result
  tags          = merge(var.additional_tags, var.policy_tags)
}
```

Declare `policy_tags` as a required `map(string)` of effective policy keys and
values; `additional_tags` is an optional `map(string)` defaulting to `{}`. Preserve
policy casing and prevent optional values overriding it. Use the canonical
greenfield tag contract only when discovery confirms no tag policy. Generate the
suffix once per root and pass it to children; do not replace existing deployed
names or suffix state without an approved migration.

## Key Pattern: Phased Deployment

Phases sharing state must be cumulative. Never move existing state backwards to
an earlier phase. Review saved plans for deletes and replacements; unexpected
destruction blocks progression. Preserve existing count addresses when correcting
conditions; switching to for_each requires an explicit state migration.

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
  version = "0.9.0"
  count   = contains(["security", "data", "compute", "edge", "all"], var.deployment_phase) ? 1 : 0
  # ...
}
```

This is a partial count example using the same pinned Key Vault version as
[module composition](module-composition.md); complete its required inputs from
the approved plan. Foundation is unconditional; each later module uses all phases
at or after its own phase, plus `all`. Do not use this condition for data/compute/edge
modules without moving their inclusion boundary to the corresponding phase.

## Output Files

| File                     | Location                                                        |
| ------------------------ | --------------------------------------------------------------- |
| Preflight Check          | `agent-output/{project}/04-preflight-check.md`                  |
| Implementation Ref       | `agent-output/{project}/05-implementation-reference.md`         |
| Terraform Configurations | `infra/terraform/{project}/`                                    |
| Bootstrap Backend (Bash) | `infra/terraform/{project}/bootstrap-backend.sh`                |
| Bootstrap Backend (PS)   | `infra/terraform/{project}/bootstrap-backend.ps1`               |
| Deploy Script (Bash)     | `infra/terraform/{project}/deploy.sh` _(deprecated — use azd)_  |
| Deploy Script (PS)       | `infra/terraform/{project}/deploy.ps1` _(deprecated — use azd)_ |
