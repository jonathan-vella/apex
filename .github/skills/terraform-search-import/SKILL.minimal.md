<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Terraform Search & Import for Azure (Minimal)

**Decision Tree**:
```text

**Manual Discovery Workflow (Primary)**:
### Step 1: Discover Resources with az CLI

**Post-Import: Adopt AVM Modules**:
After importing raw `azurerm_*` resources, refactor to AVM modules using `moved {}` blocks.

**Integration with Terraform MCP**:
Use Terraform MCP tools during import workflows:

**Terraform Search Workflow (Experimental)**:
Uses `.tfquery.hcl` files with `list` blocks to discover resources, then

**Reference Index**:

Read `SKILL.md` or `SKILL.digest.md` for full content.
