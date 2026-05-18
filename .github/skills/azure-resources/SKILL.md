---
name: azure-resources
description: "**ANALYSIS SKILL** — List, find, and visualize Azure resources via Resource Graph or Mermaid. WHEN: 'list resources', 'list VMs', 'find orphaned resources', 'resource inventory', 'cross-subscription query', 'visualize Azure resources', 'diagram my resources'. DO NOT USE FOR: deploys (azure-deploy), cost (azure-cost-optimization), security (azure-compliance), troubleshooting (azure-diagnostics)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure Resources

Discover, inventory, and visualize existing Azure resources. Combines two
related capabilities:

- **Lookup mode** — query and list resources (single type or cross-cutting via
  Azure Resource Graph). Replaces the legacy `azure-resource-lookup` skill.
- **Visualize mode** — analyze a resource group and generate a detailed Mermaid
  architecture diagram. Replaces the legacy `azure-resource-visualizer` skill.

Both modes share `references/azure-resource-graph.md` for KQL patterns.

---

# Mode A: Lookup

Use this mode when the user wants to **list / find / show** Azure resources.

## When to Use Lookup

- **List resources** of any type (VMs, web apps, storage accounts, container apps, databases, etc.)
- **Show resources** in a specific subscription or resource group
- Query resources **across multiple subscriptions** or resource types
- Find **orphaned resources** (unattached disks, unused NICs, idle IPs)
- Discover resources **missing required tags** or configurations
- Get a **resource inventory** spanning multiple types
- Find resources in a **specific state** (unhealthy, failed provisioning, stopped)
- Answer "**what resources do I have?**" or "**show me my Azure resources**"

> 💡 **Tip:** For single-resource-type queries, first check if a dedicated MCP
> tool can handle it (see routing table below). If none exists, use Azure
> Resource Graph (ARG).

## Quick Reference

| Property           | Value                                                      |
| ------------------ | ---------------------------------------------------------- |
| **Query Language** | KQL (Kusto Query Language subset)                          |
| **CLI Command**    | `az graph query -q "<KQL>" -o table`                       |
| **Extension**      | `az extension add --name resource-graph`                   |
| **MCP Tool**       | `extension_cli_generate` with intent for `az graph query`  |
| **Best For**       | Cross-subscription queries, orphaned resources, tag audits |

## MCP Tools

| Tool                              | Purpose                            | When to Use                                     |
| --------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `extension_cli_generate`          | Generate `az graph query` commands | Primary — generate ARG queries from user intent |
| `mcp_azure-mcp_subscription_list` | List available subscriptions       | Discover subscription scope before querying     |
| `mcp_azure-mcp_group_list`        | List resource groups               | Narrow query scope                              |

## Rules

- **Prefer dedicated MCP tools** for single-resource-type queries (`compute`, `storage`, `cosmos`, etc.) before falling back to Azure Resource Graph
- **Use ARG for cross-cutting queries** — cross-subscription, cross-type, orphaned resources, tag audits
- **Generate queries via `extension_cli_generate`** — do not hand-author KQL when intent-based generation is available
- **Shape output with `--query` JMESPath** for tabular display; do not load raw JSON dumps into context
- **Mode A is read-only** — lookup never modifies resources; remediation is out of scope (use `azure-deploy`)
- **Mode B (Visualize) is for documentation** — emit Mermaid only when the user explicitly asks for a diagram; do not auto-visualize lookup results
- **Out of scope**: deploying resources (use `azure-deploy`), cost optimization (use `azure-cost-optimization`), security scanning (use `azure-compliance`), troubleshooting (use `azure-diagnostics`)

## Lookup Workflow

Three-step procedure: (1) check for a dedicated MCP tool by resource type
(`compute` / `storage` / `cosmos` / `keyvault` / `sql` / `acr` / `aks` /
`appservice` / `eventhubs` / `servicebus`); (2) if no full-coverage tool, generate an
Azure Resource Graph query via `extension_cli_generate`; (3) execute with `--query`
JMESPath shaping. Full per-resource-type tool table and example commands in
[`references/lookup-workflow.md`](references/lookup-workflow.md).

## Lookup Constraints

- ✅ **Always** use `=~` for case-insensitive type matching (types are lowercase)
- ✅ **Always** scope queries with `--subscriptions` or `--first` for large tenants
- ✅ **Prefer** dedicated MCP tools for single-resource-type queries
- ❌ **Never** use ARG for real-time monitoring (data has slight delay)
- ❌ **Never** attempt mutations through ARG (read-only)

## Lookup Error Handling

| Error                                | Cause                                | Fix                                                            |
| ------------------------------------ | ------------------------------------ | -------------------------------------------------------------- |
| `resource-graph extension not found` | Extension not installed              | `az extension add --name resource-graph`                       |
| `AuthorizationFailed`                | No read access to subscription       | Check RBAC — need Reader role                                  |
| `BadRequest` on query                | Invalid KQL syntax                   | Verify table/column names; use `=~` for case-insensitive match |
| Empty results                        | No matching resources or wrong scope | Check `--subscriptions` flag; verify resource type spelling    |

---

# Mode B: Visualize

Use this mode when the user asks for a **diagram** of a resource group, or to
understand how individual resources fit together.

## When to Use Visualize

The user wants to:

- Create an architecture diagram of an existing resource group
- See how resources connect (VNets, private endpoints, identities, app settings)
- Document deployed infrastructure with embedded Mermaid

For the full Visualize-mode procedure (resource discovery, diagram construction, file creation, quality standards, constraints, edge cases, and output format), load **[references/visualize.md](references/visualize.md)**.

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                            | Mode      | When to Load                                          |
| ------------------------------------ | --------- | ----------------------------------------------------- |
| `references/azure-resource-graph.md` | Both      | KQL patterns, ARG query examples                      |
| `references/visualize.md`            | Visualize | Full Visualize-mode workflow (Steps 2–4, constraints) |
| `assets/example-diagram.md`          | Visualize | Sample completed Mermaid architecture diagram         |
| `assets/template-architecture.md`    | Visualize | Markdown template for the generated documentation     |
