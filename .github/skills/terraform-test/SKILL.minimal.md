<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Terraform Test Skill (Minimal)

**Quick Reference**:

**File Structure**:
```text

**Test File Components**:

**Canonical Example**:
See `references/test-examples.md` for a complete Azure Resource Group test

**Key Syntax Rules**:
### Run Block Attributes

**Mock Providers (TF 1.7+)**:
Simulate Azure provider without API calls — ideal for unit tests.

**Common Test Patterns**:
See `references/test-examples.md` for: conditional resources, tag validation,

**Running Tests**:
```bash

**Best Practices**:
1. **Naming**: `*_unit_test.tftest.hcl` / `*_integration_test.tftest.hcl`

**Terraform MCP Integration**:
Use `mcp_terraform_search_providers` to validate that resource types used in

Read `SKILL.md` or `SKILL.digest.md` for full content.
