---
name: azure-resources
description: "List, find, and visualize existing Azure resources. Two modes: LOOKUP for query/inventory work (list VMs, find orphaned resources, tag audits, cross-subscription queries via Azure Resource Graph) and VISUALIZE for generating Mermaid architecture diagrams of a resource group. USE FOR: list resources, list virtual machines, list VMs, list storage accounts, list websites, list web apps, list container apps, show resources, find resources, what resources do I have, list resources in resource group, list resources in subscription, find resources by tag, find orphaned resources, resource inventory, count resources by type, cross-subscription resource query, Azure Resource Graph, resource discovery, list container registries, list SQL servers, list Key Vaults, show resource groups, list app services, find resources across subscriptions, find unattached disks, tag analysis, create architecture diagram, visualize Azure resources, show resource relationships, generate Mermaid diagram, analyze resource group, diagram my resources, architecture visualization, resource topology, map Azure infrastructure. DO NOT USE FOR: deploying or modifying resources (use azure-deploy), cost optimization (use azure-cost-optimization), security scanning (use azure-compliance), performance troubleshooting (use azure-diagnostics), code generation (use relevant service skill)."
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
| Cosmos DB             | `cosmos`      | ✅ Full — accounts, databases, queries  |
| Key Vault             | `keyvault`    | ⚠️ Partial — secrets/keys only          |
| SQL Databases         | `sql`         | ⚠️ Partial — requires resource group     |
| Container Registries  | `acr`         | ✅ Full — list registries               |
| Kubernetes (AKS)      | `aks`         | ✅ Full — clusters, node pools          |
| App Service / Web Apps | `appservice` | ❌ No list command — use ARG            |
| Container Apps        | —             | ❌ No MCP tool — use ARG                |
| Event Hubs            | `eventhubs`   | ✅ Full — namespaces, hubs              |
| Service Bus           | `servicebus`  | ✅ Full — queues, topics                |

If a dedicated tool is available with full coverage, use it. Otherwise proceed to Step 2.

### Step 2: Generate the ARG Query

Use `extension_cli_generate` to build the `az graph query` command:

```yaml
mcp_azure_mcp_extension_cli_generate
  intent: "query Azure Resource Graph to <user's request>"
  cli-type: "az"
```

See [Azure Resource Graph Query Patterns](references/azure-resource-graph.md) for common KQL patterns.

### Step 3: Execute and Format Results

Run the generated command. Use `--query` (JMESPath) to shape output:

```bash
az graph query -q "<KQL>" --query "data[].{name:name, type:type, rg:resourceGroup}" -o table
```

Use `--first N` to limit results. Use `--subscriptions` to scope.

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

# Mode B: Visualize

Use this mode when the user asks for a **diagram** of a resource group, or to
understand how individual resources fit together.

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

If a resource group is specified, validate it exists and proceed.

### Step 2: Resource Discovery & Analysis

For bulk resource discovery across subscriptions, use Azure Resource Graph
queries — see [Azure Resource Graph Query Patterns](references/azure-resource-graph.md).

Once you have the resource group:

1. **Query all resources** in the resource group via Azure MCP tools or `az`.
2. **Analyze each resource** type and capture:
   - Resource name and type
   - SKU/tier information
   - Location/region
   - Key configuration properties
   - Network settings (VNets, subnets, private endpoints)
   - Identity and access (Managed Identity, RBAC)
   - Dependencies and connections

3. **Map relationships** by identifying:
   - **Network connections**: VNet peering, subnet assignments, NSG rules, private endpoints
   - **Data flow**: Apps → Databases, Functions → Storage, API Management → Backends
   - **Identity**: Managed identities connecting to resources
   - **Configuration**: App Settings pointing to Key Vaults, connection strings
   - **Dependencies**: Parent-child relationships, required resources

### Step 3: Diagram Construction

Create a **detailed Mermaid diagram** using `graph TB` (top-to-bottom) or
`graph LR` (left-to-right).

See [example-diagram.md](./assets/example-diagram.md) for a complete sample.

**Key Diagram Requirements:**

- **Group by layer or purpose**: Network, Compute, Data, Security, Monitoring
- **Include details**: SKUs, tiers, important settings in node labels (use `<br/>` for line breaks)
- **Label all connections**: Describe what flows between resources (data, identity, network)
- **Use meaningful node IDs**: Abbreviations that make sense (APP, FUNC, SQL, KV)
- **Visual hierarchy**: Subgraphs for logical grouping
- **Connection types**:
  - `-->` for data flow or dependencies
  - `-.->` for optional/conditional connections
  - `==>` for critical/primary paths

**Resource Type Examples:**

- App Service: Include plan tier (B1, S1, P1v2)
- Functions: Include runtime (.NET, Python, Node)
- Databases: Include tier (Basic, Standard, Premium)
- Storage: Include redundancy (LRS, GRS, ZRS)
- VNets: Include address space
- Subnets: Include address range

### Step 4: File Creation

Use [template-architecture.md](./assets/template-architecture.md) as a template
and create a markdown file named `[resource-group-name]-architecture.md` with:

1. **Header**: Resource group name, subscription, region
2. **Summary**: Brief overview of the architecture (2-3 paragraphs)
3. **Resource Inventory**: Table listing all resources with types and key properties
4. **Architecture Diagram**: The complete Mermaid diagram
5. **Relationship Details**: Explanation of key connections and data flows
6. **Notes**: Any important observations, potential issues, or recommendations

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
- ✅ Create a complete markdown file with the embedded diagram

**Never Do:**

- ❌ Skip resources because they seem unimportant
- ❌ Make assumptions about relationships without verification
- ❌ Create incomplete or placeholder diagrams
- ❌ Omit configuration details that affect architecture
- ❌ Proceed without confirming resource group selection
- ❌ Generate invalid Mermaid syntax
- ❌ Modify or delete Azure resources (read-only analysis)

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

### Markdown Structure

- Use H1 for main title; H2 for major sections; H3 for subsections
- Use tables for resource inventories
- Use bullet lists for notes and recommendations
- Use code blocks with `mermaid` language tag for diagrams

---

## Reference Index

Load these on demand — do NOT read all at once:

| Reference                            | Mode      | When to Load                                         |
| ------------------------------------ | --------- | ---------------------------------------------------- |
| `references/azure-resource-graph.md` | Both      | KQL patterns, ARG query examples                     |
| `assets/example-diagram.md`          | Visualize | Sample completed Mermaid architecture diagram        |
| `assets/template-architecture.md`    | Visualize | Markdown template for the generated documentation   |
