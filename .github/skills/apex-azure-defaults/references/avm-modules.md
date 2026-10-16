<!-- ref:avm-modules-v1 -->

# AVM Module Registry

> **No version numbers are listed below — versions go stale.** Always
> resolve the latest published stable version at plan time:
>
> - **Bicep:** `curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/{path}/tags/list`
>   → highest non-prerelease semver in `tags[]`.
> - **Terraform:** Azure MCP `azureterraform avm versions --module-name avm-res-{path}` lists versions; or
>   `curl -sf https://registry.terraform.io/v1/modules/Azure/avm-res-{path}/azurerm/versions`
>   → highest stable exact semver in `modules[0].versions[]` (the API is not sorted).
> - **Guidance:** Azure MCP provides Azure Terraform documentation, best practices,
>   AVM module READMEs (`avm get`) and provider docs (`azurerm get`, `azapi get`). Use it
>   only for modules the index lists as published. `avm versions` reports a module absent from the AVM list
>   as `status: 400` with `results.type: "ArgumentException"` and "not found in available modules"; only that
>   response means "unpublished". Any other status or error is a verification failure — stop and escalate,
>   do not emit a raw-resource exception. `avm get` on an unknown version returns `status: 422` (HTTP 404), and
>   `azurerm get` returns `status: 200` even for unknown types: empty `arguments` plus a "Documentation not
>   found" `summary` means the resource type does not exist.
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
1. MCR (authoritative): curl -sf https://mcr.microsoft.com/v2/bicep/avm/res/{path}/tags/list \
                      | jq -r '.tags[]' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1
   A 404 here is the only valid basis for a "no AVM module" conclusion.
2. MCP (parameters only): mcp_bicep_list_avm_metadata -> module parameters and outputs.
   It can omit published modules, so never use it to decide a module does not exist.
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
| Private DNS Zone       | `Azure/avm-res-network-privatednszone/azurerm`               |
| User-Assigned Identity | `Azure/avm-res-managedidentity-userassignedidentity/azurerm` |
| API Management         | `Azure/avm-res-apimanagement-service/azurerm`                |
