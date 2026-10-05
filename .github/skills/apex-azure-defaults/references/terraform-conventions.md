<!-- ref:terraform-conventions-v1 -->

# Terraform Conventions

## Terraform Metadata Lookup

Use one source for each concern:

| Need | Source |
| --- | --- |
| Azure Terraform guidance | Azure MCP documentation and best-practice tools |
| Provider/module search and versions | Public Terraform Registry API |
| Initialized provider resource schemas | `terraform providers schema -json` |
| Existing Azure resource IDs | Azure MCP resource tools or Azure CLI |

Resolve an AVM-TF module version directly from the Registry API:

```bash
curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions \
  | jq -r '[.modules[0].versions[].version | select(test("^[0-9]+\\.[0-9]+\\.[0-9]+$"))]
           | sort_by(split(".") | map(tonumber)) | last'
```

The API does not return versions newest-first; always sort as above.

Use `https://registry.terraform.io/v1/providers/{namespace}/{provider}/versions`
for provider versions with the same sort (`hashicorp/azurerm`, `hashicorp/random`,
`Azure/azapi` — azapi is not under `hashicorp`). Run `terraform init` before
`terraform providers schema -json`. Do not claim Azure MCP exposes Terraform
Registry metadata.

## Tag Syntax (HCL)

Tag keys come from the governance tag contract (greenfield fallback: the
lowercase set in [`tag-strategy.md`](tag-strategy.md)):

```hcl
locals {
  tags = merge(var.tags, {
    environment = var.environment
    owner       = var.owner
    application = var.project
  })
}
```

## Required Commands

```bash
terraform fmt -recursive
terraform validate
terraform plan -out=plan.tfplan
```

## State Backend

Use Azure Storage Account for all remote state.
**Never** use HCP Terraform Cloud:

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-prod"
    storage_account_name = "sttfstate{suffix}"
    container_name       = "tfstate"
    key                  = "{project}.terraform.tfstate"
  }
}
```

## Unique Suffix

Generate once per root module, pass to all child modules:

```hcl
resource "random_string" "suffix" {
  length  = 4
  lower   = true
  numeric = true
  special = false
}
```
