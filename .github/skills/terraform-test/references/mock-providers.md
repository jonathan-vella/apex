<!-- ref:mock-providers-v1 -->

# Mock Provider Patterns

Mock providers simulate Azure provider behavior without real API calls
(available since Terraform 1.7.0). Use for fast unit tests and CI without credentials.

---

## Basic Mock Provider

```hcl
mock_provider "azurerm" {
  mock_resource "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test"
      name     = "rg-test"
      location = "swedencentral"
      tags     = {}
    }
  }
}

run "test_with_mocks" {
  command = plan
  assert {
    condition     = azurerm_resource_group.this.location == "swedencentral"
    error_message = "Mock should return swedencentral"
  }
}
```

## Common Azure Resource Mocks

### Virtual Network

```hcl
mock_resource "azurerm_virtual_network" {
  defaults = {
    id            = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test"
    name          = "vnet-test"
    address_space = ["10.0.0.0/16"]
    location      = "swedencentral"
    tags          = {}
  }
}
```

### Subnet

```hcl
mock_resource "azurerm_subnet" {
  defaults = {
    id               = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test/subnets/snet-test"
    name             = "snet-test"
    address_prefixes = ["10.0.1.0/24"]
  }
}
```

### Key Vault

```hcl
mock_resource "azurerm_key_vault" {
  defaults = {
    id        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.KeyVault/vaults/kv-test"
    name      = "kv-test"
    vault_uri = "https://kv-test.vault.azure.net/"
    tags      = {}
  }
}
```

### Storage Account

```hcl
mock_resource "azurerm_storage_account" {
  defaults = {
    id                        = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Storage/storageAccounts/sttest"
    name                      = "sttest"
    primary_blob_endpoint     = "https://sttest.blob.core.windows.net/"
    primary_connection_string = "DefaultEndpointsProtocol=https;AccountName=sttest"
    tags                      = {}
  }
}
```

## Mock Data Sources

```hcl
mock_data "azurerm_client_config" {
  defaults = {
    tenant_id       = "00000000-0000-0000-0000-000000000000"
    subscription_id = "00000000-0000-0000-0000-000000000000"
    object_id       = "00000000-0000-0000-0000-000000000000"
  }
}

mock_data "azurerm_subscription" {
  defaults = {
    id              = "/subscriptions/00000000-0000-0000-0000-000000000000"
    subscription_id = "00000000-0000-0000-0000-000000000000"
    display_name    = "Test Subscription"
  }
}
```

## Aliased Mock Providers

```hcl
mock_provider "azurerm" {
  alias = "mocked"

  mock_resource "azurerm_resource_group" {
    defaults = {
      id       = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-mock"
      name     = "rg-mock"
      location = "swedencentral"
      tags     = {}
    }
  }
}

run "test_with_aliased_mock" {
  command = plan
  providers = {
    azurerm = provider.azurerm.mocked
  }
  assert {
    condition     = azurerm_resource_group.this.name == "rg-mock"
    error_message = "Should use aliased mock provider"
  }
}
```

## When to Use Mocks vs Real Providers

| Scenario                         | Mock | Real         |
| -------------------------------- | ---- | ------------ |
| Unit tests (logic, naming, tags) | ✅   | Overkill     |
| CI without Azure credentials     | ✅   | Not possible |
| for_each/count validation        | ✅   | Unnecessary  |
| Integration tests                | ❌   | ✅           |
| Azure API behavior validation    | ❌   | ✅           |
| End-to-end deployment tests      | ❌   | ✅           |

## Limitations

- Mocks only work with `command = plan` (not `apply`)
- Mock defaults may not match real computed attributes
- Cannot test actual provider API behavior or timing
- Need manual updates when provider schemas change
