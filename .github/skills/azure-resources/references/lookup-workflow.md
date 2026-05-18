<!-- ref:lookup-workflow-v1 -->

# Lookup Workflow (azure-resources)

> Loaded by `azure-resources` SKILL.md when the agent is performing a
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

## Step 2: Generate the ARG Query

Use `extension_cli_generate` to build the `az graph query` command:

```yaml
mcp_azure-mcp_extension_cli_generate
  intent: "query Azure Resource Graph to <user's request>"
  cli-type: "az"
```

See [Azure Resource Graph Query Patterns](./azure-resource-graph.md) for common KQL patterns.

## Step 3: Execute and Format Results

Run the generated command. Use `--query` (JMESPath) to shape output:

```bash
az graph query -q "<KQL>" --query "data[].{name:name, type:type, rg:resourceGroup}" -o table
```

Use `--first N` to limit results. Use `--subscriptions` to scope.
