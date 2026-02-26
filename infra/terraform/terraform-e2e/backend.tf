terraform {
  backend "azurerm" {
    resource_group_name  = "rg-tfstate-dev"
    storage_account_name = "sttfstate00858ffc"
    container_name       = "tfstate"
    key                  = "terraform-e2e.terraform.tfstate"
    use_azuread_auth     = true
  }
}
