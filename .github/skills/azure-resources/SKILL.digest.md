<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Resources (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use Lookup

- **List resources** of any type (VMs, web apps, storage accounts, container apps, databases, etc.)
- **Show resources** in a specific subscription or resource group
- Query resources **across multiple subscriptions** or resource types
- Find **orphaned resources** (unattached disks, unused NICs, idle IPs)
- Discover resources **missing required tags** or configurations
- Get a **resource inventory** spanning multiple types
- Find resources in a **specific state** (unhealthy, failed provisioning, stopped)
- Answer "**what resources do I have?**" or "**show me my Azure resources**"
> _See SKILL.md for full content._

## Quick Reference

| Property           | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| **Query Language** | KQL (Kusto Query Language subset)                         |
| **CLI Command**    | `az graph query -q "<KQL>" -o table`                      |
| **Extension**      | `az extension add --name resource-graph`                  |
| **MCP Tool**       | `extension_cli_generate` with intent for `az graph query` |
| **Best For**       | Cross-subscription queries, orphaned resources, tag audits |

## MCP Tools

| Tool                              | Purpose                            | When to Use                                              |
| --------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| `extension_cli_generate`          | Generate `az graph query` commands | Primary — generate ARG queries from user intent          |
| `mcp_azure_mcp_subscription_list` | List available subscriptions       | Discover subscription scope before querying              |
| `mcp_azure_mcp_group_list`        | List resource groups               | Narrow query scope                                        |

## Lookup Workflow

### Step 1: Check for a Dedicated MCP Tool

For single-resource-type queries, check if a dedicated MCP tool can handle it:

| Resource Type         | MCP Tool      | Coverage                                |
| --------------------- | ------------- | --------------------------------------- |
| Virtual Machines      | `compute`     | ✅ Full — list, details, sizes          |
| Storage Accounts      | `storage`     | ✅ Full — accounts, blobs, tables       |
> _See SKILL.md for full content._

## Lookup Constraints

- ✅ **Always** use `=~` for case-insensitive type matching (types are lowercase)
- ✅ **Always** scope queries with `--subscriptions` or `--first` for large tenants
- ✅ **Prefer** dedicated MCP tools for single-resource-type queries
- ❌ **Never** use ARG for real-time monitoring (data has slight delay)
- ❌ **Never** attempt mutations through ARG (read-only)

## Lookup Error Handling

| Error                                | Cause                          | Fix                                                            |
| ------------------------------------ | ------------------------------ | -------------------------------------------------------------- |
| `resource-graph extension not found` | Extension not installed        | `az extension add --name resource-graph`                       |
| `AuthorizationFailed`                | No read access to subscription | Check RBAC — need Reader role                                  |
| `BadRequest` on query                | Invalid KQL syntax             | Verify table/column names; use `=~` for case-insensitive match |
| Empty results                        | No matching resources or wrong scope | Check `--subscriptions` flag; verify resource type spelling |

---
> _See SKILL.md for full content._

## When to Use Visualize

The user wants to:

- Create an architecture diagram of an existing resource group
- See how resources connect (VNets, private endpoints, identities, app settings)
- Document deployed infrastructure with embedded Mermaid

## Visualize Workflow

### Step 1: Resource Group Selection

If the user hasn't specified a resource group:

1. Use your tools to query available resource groups (use `az` if no MCP tool).
2. Present a numbered list of resource groups with their locations.
3. Ask the user to select one by number or name.
4. Wait for user response before proceeding.
> _See SKILL.md for full content._

## Visualize Quality Standards

- **Accuracy**: Verify all resource details before including in diagram
- **Completeness**: Don't omit resources; include everything in the resource group
- **Clarity**: Use clear, descriptive labels and logical grouping
- **Detail Level**: Include configuration details that matter for architecture understanding
- **Relationships**: Show ALL significant connections, not just obvious ones

## Visualize Constraints

**Always Do:**

- ✅ List resource groups if not specified
- ✅ Wait for user selection before proceeding
- ✅ Analyze ALL resources in the group
- ✅ Create detailed, accurate diagrams
- ✅ Group resources logically with subgraphs
- ✅ Label all connections descriptively
> _See SKILL.md for full content._

## Visualize Edge Cases

- **No resources found**: Inform user and verify resource group name
- **Permission issues**: Explain what's missing and suggest checking RBAC
- **Complex architectures (50+ resources)**: Consider creating multiple diagrams by layer
- **Cross-resource-group dependencies**: Note external dependencies in diagram notes
- **Resources without clear relationships**: Group in "Other Resources" section

## Visualize Output Format

### Mermaid Diagram Syntax

- Use `graph TB` (top-to-bottom) for vertical layouts
- Use `graph LR` (left-to-right) for horizontal layouts (better for wide architectures)
- Subgraph syntax: `subgraph "Descriptive Name"`
- Node syntax: `ID["Display Name<br/>Details"]`
- Connection syntax: `SOURCE -->|"Label"| TARGET`
> _See SKILL.md for full content._

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                            | Mode      | When to Load                                         |
| ------------------------------------ | --------- | ---------------------------------------------------- |
| `references/azure-resource-graph.md` | Both      | KQL patterns, ARG query examples                     |
| `assets/example-diagram.md`          | Visualize | Sample completed Mermaid architecture diagram        |
| `assets/template-architecture.md`    | Visualize | Markdown template for the generated documentation   |
