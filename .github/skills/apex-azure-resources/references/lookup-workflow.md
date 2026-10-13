<!-- ref:lookup-workflow-v1 -->

# Lookup Workflow (apex-azure-resources)

> Loaded by `apex-azure-resources` SKILL.md when the agent is performing a
> read-only lookup (Mode A). Step 3 (format results) is the same
> regardless of which Step 2 path was taken.

## Step 1: Check for a Dedicated MCP Tool

For single-resource-type queries, check if a dedicated MCP tool can handle it before falling
back to Azure Resource Graph:

| Resource Type          | MCP Tool     | Coverage                               |
| ---------------------- | ------------ | -------------------------------------- |
| Virtual Machines       | `compute`    | ✅ Full — list, details, sizes         |
| Storage Accounts       | `storage`    | ✅ Full — accounts, blobs, tables      |
| Cosmos DB              | `cosmos`     | ✅ Full — accounts, databases, queries |
| Key Vault              | `keyvault`   | ⚠️ Partial — secrets/keys only         |
| SQL Databases          | `sql`        | ⚠️ Partial — requires resource group   |
| Container Registries   | `acr`        | ✅ Full — list registries              |
| Kubernetes (AKS)       | `aks`        | ✅ Full — clusters, node pools         |
| App Service / Web Apps | `appservice` | ❌ No list command — use ARG           |
| Container Apps         | —            | ❌ No MCP tool — use ARG               |
| Event Hubs             | `eventhubs`  | ✅ Full — namespaces, hubs             |
| Service Bus            | `servicebus` | ✅ Full — queues, topics               |

If a dedicated tool is available with full coverage, use it. Otherwise proceed to Step 2.

## Step 2: Build the ARG Query

Adapt a query from [Azure Resource Graph Query Patterns](./azure-resource-graph.md); for example:

```bash
az graph query -q "Resources | where type =~ 'microsoft.web/sites' | project name, resourceGroup, location"
```

The opt-in `azure-mcp-extension` server's `extension_cli_generate` (`intent`, `cli-type: "az"`) can draft a command
instead; see `.devcontainer/README.md`.

## Step 3: Execute and Format Results

Run the generated command. Use `--query` (JMESPath) to shape output:

```bash
az graph query -q "<KQL>" --query "data[].{name:name, type:type, rg:resourceGroup}" -o table
```

Use `--first N` to limit results. Use `--subscriptions` to scope.
