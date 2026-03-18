<!-- ref:test-patterns-v1 -->

# Terraform Test Patterns

Extended test patterns beyond the core examples in SKILL.md.

---

## Unit Test Patterns (Plan Mode)

### Testing Module Outputs

```hcl
run "test_module_outputs" {
  command = plan

  assert {
    condition     = output.vnet_id != null
    error_message = "VNet ID output must be defined"
  }

  assert {
    condition     = can(regex("^/subscriptions/", output.vnet_id))
    error_message = "VNet ID should be a valid Azure resource ID"
  }

  assert {
    condition     = length(output.subnet_ids) >= 2
    error_message = "Should output at least 2 subnet IDs"
  }
}
```

### Testing Data Sources

```hcl
run "test_client_config" {
  command = plan

  assert {
    condition     = data.azurerm_client_config.current.tenant_id != ""
    error_message = "Should resolve tenant ID"
  }
}
```

### Testing Validation Rules

```hcl
# Test that valid input passes
run "test_valid_environment" {
  command = plan
  variables { environment = "staging" }
  assert {
    condition     = var.environment == "staging"
    error_message = "Valid environment should be accepted"
  }
}

# Test that invalid input is rejected
run "test_invalid_environment" {
  command = plan
  variables { environment = "invalid" }
  expect_failures = [var.environment]
}
```

### Complex Conditions

```hcl
run "test_all_subnets_in_vnet_range" {
  command = plan
  assert {
    condition = alltrue([
      for subnet in azurerm_subnet.this :
      can(regex("^10\\.0\\.", subnet.address_prefixes[0]))
    ])
    error_message = "All subnets should use 10.0.0.0/8 CIDR range"
  }
}
```

### Sequential Tests with Dependencies

```hcl
run "setup_resource_group" {
  command = apply
  variables {
    project     = "test"
    environment = "dev"
    location    = "swedencentral"
  }
  assert {
    condition     = output.resource_group_id != ""
    error_message = "Resource group should be created"
  }
}

run "test_vnet_in_resource_group" {
  command = plan
  variables {
    resource_group_name = run.setup_resource_group.resource_group_name
    location            = "swedencentral"
  }
  assert {
    condition     = azurerm_virtual_network.this.resource_group_name == run.setup_resource_group.resource_group_name
    error_message = "VNet should be in the setup resource group"
  }
}
```

## Integration Test Patterns (Apply Mode)

### Full Stack Test

```hcl
run "integration_full_stack" {
  # command defaults to apply
  variables {
    project     = "integration-test"
    environment = "test"
    location    = "swedencentral"
  }

  assert {
    condition     = azurerm_resource_group.this.id != ""
    error_message = "Resource group should be created"
  }

  assert {
    condition     = azurerm_virtual_network.this.id != ""
    error_message = "VNet should be created"
  }

  assert {
    condition     = length(azurerm_subnet.this) == 2
    error_message = "Should create 2 subnets"
  }
}
# Resources are destroyed automatically in reverse order
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Terraform Tests
on:
  pull_request:
    branches: [main]

jobs:
  terraform-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.9"
      - run: terraform init
      - run: terraform fmt -check -recursive
      - run: terraform validate
      - run: terraform test -verbose
        env:
          ARM_SUBSCRIPTION_ID: ${{ secrets.ARM_SUBSCRIPTION_ID }}
          ARM_TENANT_ID: ${{ secrets.ARM_TENANT_ID }}
          ARM_CLIENT_ID: ${{ secrets.ARM_CLIENT_ID }}
          ARM_CLIENT_SECRET: ${{ secrets.ARM_CLIENT_SECRET }}
```

### GitLab CI

```yaml
terraform-test:
  image: hashicorp/terraform:1.9
  stage: test
  before_script:
    - terraform init
  script:
    - terraform fmt -check -recursive
    - terraform validate
    - terraform test -verbose
  only:
    - merge_requests
    - main
```

## Testing AVM Modules

When testing Azure Verified Modules, include:

1. **Plan-mode unit tests** for naming, tags, conditional resources
2. **Expect_failures tests** for all validation rules
3. **Mock tests** for complex logic without Azure access
4. **Integration tests** only in CI with real Azure credentials

```hcl
# Test AVM module via registry
run "test_avm_key_vault" {
  command = plan
  module {
    source  = "Azure/avm-res-keyvault-vault/azurerm"
    version = "0.9.0"
  }
  variables {
    name                = "kv-test-dev-a1b2"
    resource_group_name = "rg-test"
    location            = "swedencentral"
    tenant_id           = "00000000-0000-0000-0000-000000000000"
  }
  assert {
    condition     = output.resource_id != ""
    error_message = "Key Vault should be created"
  }
}
```
