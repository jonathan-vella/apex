<!-- ref:avm-modules-v1 -->

# AVM Module Registry

> **No version numbers are listed below — versions go stale.** Always
> resolve the latest published stable version at plan time:
>
> - **Bicep:** `curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/{path}/tags/list`
>   → highest non-prerelease semver in `tags[]`.
> - **Terraform:** `curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions`
>   → first entry in `modules[0].versions[]`.
> - **MCP equivalents** (preferred in Copilot Chat): the microsoft-foundry
>   and terraform MCP toolsets surface the same data.
> - **Validator:** `npm run validate:avm-versions:freeze` (planner agents
>   MUST call this before `apex-recall complete-step 4`).
>
> Stale pins are allowed ONLY via a `pin_policy.mode = "exception"` block
> in `04-iac-contract.json` with rationale + evidence + `review_after`.
> See `tools/schemas/iac-contract.schema.json` → `$defs.pinPolicy`.

## Common AVM Modules (Bicep)

| Resource           | Module Path                                        |
| ------------------ | -------------------------------------------------- |
| Key Vault          | `br/public:avm/res/key-vault/vault`                |
| Virtual Network    | `br/public:avm/res/network/virtual-network`        |
| Storage Account    | `br/public:avm/res/storage/storage-account`        |
| App Service Plan   | `br/public:avm/res/web/serverfarm`                 |
| App Service        | `br/public:avm/res/web/site`                       |
| SQL Server         | `br/public:avm/res/sql/server`                     |
| Log Analytics      | `br/public:avm/res/operational-insights/workspace` |
| App Insights       | `br/public:avm/res/insights/component`             |
| NSG                | `br/public:avm/res/network/network-security-group` |
| Static Web App     | `br/public:avm/res/web/static-site`                |
| Container App      | `br/public:avm/res/app/container-app`              |
| Container Env      | `br/public:avm/res/app/managed-environment`        |
| Cosmos DB          | `br/public:avm/res/document-db/database-account`   |
| Front Door         | `br/public:avm/res/cdn/profile`                    |
| Service Bus        | `br/public:avm/res/service-bus/namespace`          |
| Container Registry | `br/public:avm/res/container-registry/registry`    |

### Resolving the Latest AVM Version

```text
1. MCP (preferred): mcp_bicep_list_avm_metadata → filter by resource type → newest stable
2. CLI fallback:    curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/{path}/tags/list \
                      | jq -r '.tags[]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1
3. Validator:       npm run validate:avm-versions   (runs the same lookup with caching)
```

### AVM Usage Pattern

```bicep
// Pin to the EXACT version resolved at plan time. Do NOT copy this snippet's
// version number — query MCR for the current latest stable when generating IaC.
module keyVault 'br/public:avm/res/key-vault/vault:<LATEST>' = {
  name: '${kvName}-deploy'
  params: {
    name: kvName
    location: location
    tags: tags
    enableRbacAuthorization: true
    enablePurgeProtection: true
  }
}
```

## Common AVM-TF Modules (Bicep ↔ Terraform Cross-Reference)

| Resource               | Terraform AVM                                                |
| ---------------------- | ------------------------------------------------------------ |
| Key Vault              | `Azure/avm-res-keyvault-vault/azurerm`                       |
| Storage Account        | `Azure/avm-res-storage-storageaccount/azurerm`               |
| Virtual Network        | `Azure/avm-res-network-virtualnetwork/azurerm`               |
| App Service Plan       | `Azure/avm-res-web-serverfarm/azurerm`                       |
| Web App                | `Azure/avm-res-web-site/azurerm`                             |
| Container Registry     | `Azure/avm-res-containerregistry-registry/azurerm`           |
| AKS                    | `Azure/avm-res-containerservice-managedcluster/azurerm`      |
| SQL Database           | `Azure/avm-res-sql-server/azurerm`                           |
| Cosmos DB              | `Azure/avm-res-documentdb-databaseaccount/azurerm`           |
| Service Bus            | `Azure/avm-res-servicebus-namespace/azurerm`                 |
| Event Hub              | `Azure/avm-res-eventhub-namespace/azurerm`                   |
| Log Analytics          | `Azure/avm-res-operationalinsights-workspace/azurerm`        |
| App Insights           | `Azure/avm-res-insights-component/azurerm`                   |
| Private DNS Zone       | `Azure/avm-res-network-privatednszones/azurerm`              |
| User-Assigned Identity | `Azure/avm-res-managedidentity-userassignedidentity/azurerm` |
| API Management         | `Azure/avm-res-apimanagement-service/azurerm`                |
