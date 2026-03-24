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

> _See SKILL.md for full content._

## File Structure

```text
my-module/
├── main.tf
├── variables.tf
├── outputs.tf
└── tests/

> _See SKILL.md for full content._

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

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `command` | `plan`/`apply` | `apply` | Test mode |
| `variables` | block | — | Override file-level variables |

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._
