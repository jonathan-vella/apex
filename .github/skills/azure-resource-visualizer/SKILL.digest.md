<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Resource Visualizer - Architecture Diagram Generator (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Core Responsibilities

1. **Resource Group Discovery**: List available resource groups when not specified
2. **Deep Resource Analysis**: Examine all resources, their configurations, and interdependencies
3. **Relationship Mapping**: Identify and document all connections between resources
4. **Diagram Generation**: Create detailed, accurate Mermaid diagrams
5. **Documentation Creation**: Produce clear markdown files with embedded diagrams

## Workflow Process

### Step 1: Resource Group Selection

If the user hasn't specified a resource group:

1. Use your tools to query available resource groups. If you do not have a tool for this, use `az`.
2. Present a numbered list of resource groups with their locations
3. Ask the user to select one by number or name
4. Wait for user response before proceeding

If a resource group is specified, validate it exists and proceed.

### Step 2: Resource Discovery & Analysis

For bulk resource discovery across subscriptions, use Azure Resource Graph queries. See [Azure Resource Graph Queries](references/azure-resource-graph.md) for cross-subscription inventory and relationship discovery patterns.

> _See SKILL.md for full content._

## Operating Guidelines

### Quality Standards

- **Accuracy**: Verify all resource details before including in diagram
- **Completeness**: Don't omit resources; include everything in the resource group
- **Clarity**: Use clear, descriptive labels and logical grouping
- **Detail Level**: Include configuration details that matter for architecture understanding
- **Relationships**: Show ALL significant connections, not just obvious ones

### Tool Usage Patterns

1. **Azure MCP Search**:
   - Use `intent="list resource groups"` to discover resource groups
   - Use `intent="list resources in group"` with group name to get all resources
   - Use `intent="get resource details"` for individual resource analysis

> _See SKILL.md for full content._

## Output Format Specifications

### Mermaid Diagram Syntax
- Use `graph TB` (top-to-bottom) for vertical layouts
- Use `graph LR` (left-to-right) for horizontal layouts (better for wide architectures)
- Subgraph syntax: `subgraph "Descriptive Name"`
- Node syntax: `ID["Display Name<br/>Details"]`
- Connection syntax: `SOURCE -->|"Label"| TARGET`

### Markdown Structure
- Use H1 for main title
- Use H2 for major sections
- Use H3 for subsections
- Use tables for resource inventories
- Use bullet lists for notes and recommendations
- Use code blocks with `mermaid` language tag for diagrams

> _See SKILL.md for full content._

## Success Criteria

A successful analysis includes:
- ✅ Valid resource group identified
- ✅ All resources discovered and analyzed
- ✅ All significant relationships mapped
- ✅ Detailed Mermaid diagram with proper grouping
- ✅ Complete markdown file created
- ✅ Clear, actionable documentation
- ✅ Valid Mermaid syntax that renders correctly
- ✅ Professional, architect-level output

Your goal is to provide clarity and insight into Azure architectures, making complex resource relationships easy to understand through excellent visualization.

## Reference Index

Load these on demand — do NOT read all at once:

| Reference | When to Load |
| --------- | ------------ |
| `references/azure-resource-graph.md` | Azure Resource Graph |
