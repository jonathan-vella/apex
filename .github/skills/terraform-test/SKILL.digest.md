<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Terraform Test Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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
