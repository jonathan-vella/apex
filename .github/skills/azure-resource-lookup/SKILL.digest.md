<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Resource Lookup (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## When to Use This Skill

Use this skill when the user wants to:
- **List resources** of any type (VMs, web apps, storage accounts, container apps, databases, etc.)
- **Show resources** in a specific subscription or resource group
- Query resources **across multiple subscriptions** or resource types
- Find **orphaned resources** (unattached disks, unused NICs, idle IPs)
- Discover resources **missing required tags** or configurations

> _See SKILL.md for full content._

## Quick Reference

| Property | Value |
|----------|-------|
| **Query Language** | KQL (Kusto Query Language subset) |
| **CLI Command** | `az graph query -q "<KQL>" -o table` |
| **Extension** | `az extension add --name resource-graph` |
| **MCP Tool** | `extension_cli_generate` with intent for `az graph query` |

> _See SKILL.md for full content._

## MCP Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `extension_cli_generate` | Generate `az graph query` commands | Primary tool — generate ARG queries from user intent |
| `mcp_azure_mcp_subscription_list` | List available subscriptions | Discover subscription scope before querying |
| `mcp_azure_mcp_group_list` | List resource groups | Narrow query scope |

## Workflow

### Step 1: Check for a Dedicated MCP Tool

For single-resource-type queries, check if a dedicated MCP tool can handle it:

| Resource Type | MCP Tool | Coverage |
|---|---|---|

> _See SKILL.md for full content._

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `resource-graph extension not found` | Extension not installed | `az extension add --name resource-graph` |
| `AuthorizationFailed` | No read access to subscription | Check RBAC — need Reader role |
| `BadRequest` on query | Invalid KQL syntax | Verify table/column names; use `=~` for case-insensitive type matching |
| Empty results | No matching resources or wrong scope | Check `--subscriptions` flag; verify resource type spelling |

> _See SKILL.md for full content._

## Constraints

- ✅ **Always** use `=~` for case-insensitive type matching (types are lowercase)
- ✅ **Always** scope queries with `--subscriptions` or `--first` for large tenants
- ✅ **Prefer** dedicated MCP tools for single-resource-type queries
- ❌ **Never** use ARG for real-time monitoring (data has slight delay)
- ❌ **Never** attempt mutations through ARG (read-only)
