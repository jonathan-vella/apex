<!-- ref:test-examples-v1 -->

# Terraform Test Examples

## Canonical Example — Azure Resource Group Test

```hcl
# tests/resource_group_unit_test.tftest.hcl

variables {
  project     = "contoso"
  environment = "test"
  location    = "swedencentral"
  tags = {
    Environment = "test"
    ManagedBy   = "Terraform"
    Project     = "contoso"
    Owner       = "platform-team"
  }
}

# Unit test: validate naming and tags
run "test_resource_group_name" {
  command = plan

  assert {
    condition     = azurerm_resource_group.this.name == "rg-contoso-test"
    error_message = "Resource group name should follow CAF: rg-{project}-{env}"
  }

  assert {
    condition     = azurerm_resource_group.this.location == "swedencentral"
    error_message = "Location should be swedencentral"
  }
}

run "test_mandatory_tags" {
  command = plan

  assert {
    condition = alltrue([
      for tag in ["Environment", "ManagedBy", "Project", "Owner"] :
      contains(keys(azurerm_resource_group.this.tags), tag)
    ])
    error_message = "All 4 mandatory tags must be present"
  }
}

# Validation test: reject invalid environment
run "test_invalid_environment_rejected" {
  command = plan
  variables {
    environment = "invalid"
  }
  expect_failures = [var.environment]
}
```

## Common Test Patterns

### Conditional Resources

```hcl
run "test_nat_gateway_created" {
  command = plan
  variables { enable_nat_gateway = true }
  assert {
    condition     = length(azurerm_nat_gateway.this) == 1
    error_message = "NAT gateway should be created when enabled"
  }
}

run "test_nat_gateway_not_created" {
  command = plan
  variables { enable_nat_gateway = false }
  assert {
    condition     = length(azurerm_nat_gateway.this) == 0
    error_message = "NAT gateway should not be created when disabled"
  }
}
```

### Tag Validation

```hcl
run "test_mandatory_tags" {
  command = plan
  assert {
    condition = alltrue([
      for tag in ["Environment", "ManagedBy", "Project", "Owner"] :
      contains(keys(azurerm_resource_group.this.tags), tag)
    ])
    error_message = "All mandatory tags must be present"
  }
}
```

### Resource Count with for_each

```hcl
run "test_subnet_count" {
  command = plan
  variables {
    subnets = {
      web = { address_prefix = "10.0.1.0/24" }
      app = { address_prefix = "10.0.2.0/24" }
    }
  }
  assert {
    condition     = length(keys(azurerm_subnet.this)) == 2
    error_message = "Should create 2 subnets"
  }
}
```

### Variables Precedence

Test file variables have **highest precedence**, overriding all other sources.
Run-block variables override file-level variables.

```hcl
variables {
  location = "swedencentral"  # File-level default
}

run "test_with_override" {
  command = plan
  variables {
    location = "germanywestcentral"  # Overrides file-level
  }
  assert {
    condition     = azurerm_resource_group.this.location == "germanywestcentral"
    error_message = "Should use overridden location"
  }
}
```

### Referencing Prior Run Outputs

```hcl
run "setup" {
  command = apply
}

run "validate" {
  command = plan
  variables {
    resource_group_name = run.setup.resource_group_name
  }
  assert {
    condition     = var.resource_group_name == run.setup.resource_group_name
    error_message = "Should reference prior run output"
  }
}
```

### Module Block (Testing Specific Modules)

Supports **local** and **registry** sources only (no git/HTTP):

```hcl
run "test_networking_module" {
  command = plan
  module {
    source = "./modules/networking"
  }
  variables {
    address_space = ["10.0.0.0/16"]
  }
  assert {
    condition     = output.vnet_id != ""
    error_message = "VNet should be created"
  }
}
```

### Plan Options

```hcl
run "test_targeted" {
  command = plan
  plan_options {
    mode    = "normal"       # or "refresh-only"
    refresh = true
    target  = [azurerm_resource_group.this]
  }
}
```
