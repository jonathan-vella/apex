<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Terraform Test Skill (Minimal)

**Quick Reference**:

**File Structure**:
```text

**Test File Components**:

**Canonical Example — Azure Resource Group Test**:
```hcl

**Key Syntax Rules**:
### Run Block Attributes

**Mock Providers (TF 1.7+)**:
Simulate Azure provider without API calls — ideal for unit tests:

**Common Test Patterns**:
### Conditional Resources

**Running Tests**:
```bash

**Best Practices**:
1. **Naming**: `*_unit_test.tftest.hcl` / `*_integration_test.tftest.hcl`

**Terraform MCP Integration**:
Use `mcp_terraform_search_providers` to validate that resource types used in

**Reference Index**:

Read `SKILL.md` or `SKILL.digest.md` for full content.
