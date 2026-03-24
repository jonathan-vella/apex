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

| Concept            | Description                                               | Min Version |
| ------------------ | --------------------------------------------------------- | ----------- |
| Test file          | `.tftest.hcl` in `tests/` directory                       | 1.6         |
| Run block          | Single test scenario with assertions                      | 1.6         |
| Assert block       | Condition that must be true for test to pass              | 1.6         |
| Plan mode          | `command = plan` — validates logic, no resources created  | 1.6         |
| Apply mode         | `command = apply` (default) — creates real infrastructure | 1.6         |
| Mock provider      | Simulates provider without real API calls                 | 1.7         |
| Parallel execution | `parallel = true` on independent run blocks               | 1.9         |
| Expect failures    | Verify validation rules reject invalid input              | 1.6         |

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

## Canonical Example

See `references/test-examples.md` for a complete Azure Resource Group test
(unit tests, tag validation, expect_failures).

## Key Syntax Rules

### Run Block Attributes

| Attribute         | Type           | Default | Description                                 |
| ----------------- | -------------- | ------- | ------------------------------------------- |
| `command`         | `plan`/`apply` | `apply` | Test mode                                   |
| `variables`       | block          | —       | Override file-level variables               |
| `module`          | block          | —       | Test alternate module (local/registry only) |
| `assert`          | block (1+)     | —       | Validation conditions                       |
| `expect_failures` | list           | —       | Expected validation failures                |

### Assert Syntax

```hcl
assert {
  condition     = <boolean expression>
  error_message = "Human-readable failure description"
}
```

Assertions can reference: resource attributes, outputs, `run.<name>.<output>`, `var.*`, data sources.
Variables precedence: run-block > file-level > all other sources.
See `references/test-examples.md` for module blocks, plan options, and prior run references.

## Mock Providers (TF 1.7+)

Simulate Azure provider without API calls — ideal for unit tests.
Use `mock_provider "azurerm"` with `mock_resource` and `mock_data` blocks.
**When to use**: Unit tests, CI without Azure credentials, fast local development.
**When NOT to use**: Integration tests, validating actual Azure API behavior.
See `references/mock-providers.md` for full mock patterns and examples.

## Common Test Patterns

See `references/test-examples.md` for: conditional resources, tag validation,
resource count with for_each, variables precedence, and prior run references.

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

| File                           | Contents                                                         |
| ------------------------------ | ---------------------------------------------------------------- |
| `references/test-examples.md`  | Canonical example, common patterns, variables, module blocks     |
| `references/test-patterns.md`  | Unit vs integration patterns, CI/CD examples, complex assertions |
| `references/mock-providers.md` | Mock provider setup, mock resources/data sources, override files |
| `references/test-execution.md` | CLI commands, parallel execution, verbose/debug, diagnostics     |
