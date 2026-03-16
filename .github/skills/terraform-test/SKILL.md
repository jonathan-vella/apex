---
name: terraform-test
description: "Write and run Terraform tests (.tftest.hcl). USE FOR: test files, run blocks, assertions, mock providers, plan-mode unit tests, apply-mode integration tests, test troubleshooting. WHEN: create test, write test, terraform test, .tftest.hcl, mock provider, test module, validate infrastructure, test assertion. DO NOT USE FOR: Bicep code, architecture decisions, deployment."
compatibility: Requires Terraform >= 1.6 (test blocks), >= 1.7 (mock providers), >= 1.9 (parallel execution)
---

# Terraform Test Skill

Write, organize, and run Terraform's built-in test framework for Azure infrastructure modules.

**Reference:** [Terraform Testing Documentation](https://developer.hashicorp.com/terraform/language/tests)

---

## Quick Reference

| Concept | Description | Min Version |
|---------|-------------|-------------|
| Test file | `.tftest.hcl` in `tests/` directory | 1.6 |
| Run block | Single test scenario with assertions | 1.6 |
| Assert block | Condition that must be true for test to pass | 1.6 |
| Plan mode | `command = plan` — validates logic, no resources created | 1.6 |
| Apply mode | `command = apply` (default) — creates real infrastructure | 1.6 |
| Mock provider | Simulates provider without real API calls | 1.7 |
| Parallel execution | `parallel = true` on independent run blocks | 1.9 |
| Expect failures | Verify validation rules reject invalid input | 1.6 |

## File Structure

```text
my-module/
├── main.tf
├── variables.tf
├── outputs.tf
└── tests/
    ├── defaults_unit_test.tftest.hcl        # Plan mode (fast)
    ├── validation_unit_test.tftest.hcl      # Plan mode (fast)
    └── full_stack_integration_test.tftest.hcl  # Apply mode (creates resources)
```

**Naming convention**: `*_unit_test.tftest.hcl` (plan mode), `*_integration_test.tftest.hcl` (apply mode).

## Test File Components

- **0–1** `test` block (test-wide settings)
- **1+** `run` blocks (test scenarios, sequential by default)
- **0–1** `variables` block (file-level inputs, highest precedence)
- **0+** `provider` blocks (provider configuration)
- **0+** `mock_provider` blocks (simulated providers, TF 1.7+)

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

## Key Syntax Rules

### Run Block Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `command` | `plan`/`apply` | `apply` | Test mode |
| `variables` | block | — | Override file-level variables |
| `module` | block | — | Test alternate module (local/registry only) |
| `providers` | map | — | Provider overrides |
| `assert` | block (1+) | — | Validation conditions |
| `expect_failures` | list | — | Expected validation failures |
| `state_key` | string | — | State file isolation (TF 1.9+) |
| `parallel` | bool | `false` | Parallel execution (TF 1.9+) |

### Assert Syntax

```hcl
assert {
  condition     = <boolean expression>
  error_message = "Human-readable failure description"
}
```

Assertions can reference: resource attributes, outputs, `run.<name>.<output>`, `var.*`, data sources.

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

## Mock Providers (TF 1.7+)

Simulate Azure provider without API calls — ideal for unit tests:

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

  mock_resource "azurerm_virtual_network" {
    defaults = {
      id            = "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-test/providers/Microsoft.Network/virtualNetworks/vnet-test"
      name          = "vnet-test"
      address_space = ["10.0.0.0/16"]
      tags          = {}
    }
  }

  mock_data "azurerm_client_config" {
    defaults = {
      tenant_id       = "00000000-0000-0000-0000-000000000000"
      subscription_id = "00000000-0000-0000-0000-000000000000"
      object_id       = "00000000-0000-0000-0000-000000000000"
    }
  }
}

run "test_with_azure_mocks" {
  command = plan

  assert {
    condition     = azurerm_resource_group.this.location == "swedencentral"
    error_message = "Mock should return swedencentral"
  }
}
```

**When to use mocks**: Unit tests, CI without Azure credentials, fast local development.
**When NOT to use**: Integration tests, validating actual Azure API behavior.

See `references/mock-providers.md` for advanced mock patterns.

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

## Running Tests

```bash
terraform test                              # All tests
terraform test tests/defaults.tftest.hcl    # Specific file
terraform test -verbose                     # Detailed output
terraform test -filter=test_resource_group  # Filter by name
terraform test -no-cleanup                  # Debug: keep resources
```

## Best Practices

1. **Naming**: `*_unit_test.tftest.hcl` / `*_integration_test.tftest.hcl`
2. **Plan mode first**: Use `command = plan` for fast, cost-free validation
3. **Clear error messages**: Describe what went wrong and expected state
4. **Test isolation**: Independent run blocks where possible
5. **Variable coverage**: Test multiple combinations for all code paths
6. **Mock for speed**: Use mock providers in CI without Azure access
7. **Negative testing**: Use `expect_failures` for validation rule coverage
8. **Sequential only when needed**: Only chain run blocks via `run.<name>` when required

## Terraform MCP Integration

Use `mcp_terraform_search_providers` to validate that resource types used in
test assertions exist in the target provider version.

---

## Reference Index

| File | Contents |
|------|----------|
| `references/test-patterns.md` | Unit vs integration patterns, CI/CD examples, complex assertions |
| `references/mock-providers.md` | Mock provider setup, mock resources/data sources, override files |
| `references/test-execution.md` | CLI commands, parallel execution, verbose/debug, diagnostics |
