<!-- ref:visualize-v1 -->

# Visualize Workflow Reference

> Loaded by the **azure-resources** skill when the user asks to visualize a resource group as a Mermaid architecture diagram. Do NOT read this file unless the request is a Visualize-mode task.

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
