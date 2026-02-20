---
name: azure-bicep-patterns
description: Common Azure Bicep infrastructure patterns including hub-spoke networking, private endpoints, diagnostic settings, conditional deployments, and AVM module composition. Use when designing or generating Bicep templates that combine multiple Azure resources into repeatable patterns.
compatibility: Requires Azure CLI with Bicep extension
---

# Azure Bicep Patterns Skill

Reusable infrastructure patterns for Azure Bicep templates. These patterns complement
the `bicep-code-best-practices.instructions.md` (style rules) and `azure-defaults`
skill (naming, tags, regions) with composable architecture building blocks.

---

## Quick Reference

| Pattern                  | When to Use                                     |
| ------------------------ | ----------------------------------------------- |
| Hub-Spoke Networking     | Multi-workload environments with shared services |
| Private Endpoint Wiring  | Any PaaS service requiring private connectivity  |
| Diagnostic Settings      | Every deployed resource (mandatory)              |
| Conditional Deployment   | Optional resources controlled by parameters      |
| Module Composition       | Breaking main.bicep into reusable modules        |
| Managed Identity Binding | Any service-to-service authentication            |
| What-If Interpretation   | Pre-deployment validation                        |

---

## Hub-Spoke Networking

Standard pattern for shared services hub with workload spokes:

```bicep
// main.bicep — hub-spoke orchestration
module hub 'modules/hub-vnet.bicep' = {
  name: 'hub-vnet'
  params: {
    vnetName: 'vnet-hub-${uniqueSuffix}'
    addressPrefix: '10.0.0.0/16'
    subnets: [
      { name: 'AzureFirewallSubnet', prefix: '10.0.1.0/24' }
      { name: 'GatewaySubnet', prefix: '10.0.2.0/24' }
    ]
    tags: tags
  }
}

module spoke 'modules/spoke-vnet.bicep' = {
  name: 'spoke-vnet-${workloadName}'
  params: {
    vnetName: 'vnet-spoke-${workloadName}-${uniqueSuffix}'
    addressPrefix: spokeAddressPrefix
    hubVnetId: hub.outputs.resourceId
    tags: tags
  }
}
```

Key rules:

- Hub contains shared infrastructure (firewall, gateway, DNS)
- Spokes peer to hub — never to each other directly
- Use `hubVnetId` output to wire peering in spoke modules
- Apply NSGs per subnet, not per VNet

---

## Private Endpoint Wiring

Standard three-resource pattern for private connectivity:

```bicep
// Private endpoint for a PaaS service
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: 'pe-${serviceName}-${uniqueSuffix}'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'plsc-${serviceName}'
        properties: {
          privateLinkServiceId: targetResourceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource privateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'config'
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}
```

Group IDs by service type:

| Service          | Group ID       | DNS Zone                                  |
| ---------------- | -------------- | ----------------------------------------- |
| Storage Blob     | `blob`         | `privatelink.blob.core.windows.net`       |
| Storage Table    | `table`        | `privatelink.table.core.windows.net`      |
| Key Vault        | `vault`        | `privatelink.vaultcore.azure.net`         |
| SQL Server       | `sqlServer`    | `privatelink.database.windows.net`        |
| Cosmos DB        | `Sql`          | `privatelink.documents.azure.com`         |
| App Service      | `sites`        | `privatelink.azurewebsites.net`           |
| Event Hub        | `namespace`    | `privatelink.servicebus.windows.net`      |
| Container Reg    | `registry`     | `privatelink.azurecr.io`                  |

---

## Diagnostic Settings

Every resource must send logs and metrics to a workspace:

```bicep
// Pass workspace NAME (not ID) to modules — resolve inside with existing keyword
param logAnalyticsWorkspaceName string

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${parentResourceName}'
  scope: parentResource
  properties: {
    workspaceId: workspace.id
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}
```

- Use `categoryGroup: 'allLogs'` instead of listing individual categories
- Always include `AllMetrics`
- Pass workspace **name** not ID — use `existing` keyword to resolve

---

## Conditional Deployment

Use parameters to control optional resource deployment:

```bicep
@description('Deploy a Redis cache for session state')
param deployRedis bool = false

module redis 'modules/redis.bicep' = if (deployRedis) {
  name: 'redis-cache'
  params: {
    name: 'redis-${projectName}-${environment}-${uniqueSuffix}'
    location: location
    tags: tags
  }
}

// Conditional output — empty string when not deployed
output redisHostName string = deployRedis ? redis.outputs.hostName : ''
```

- Use `bool` parameters with sensible defaults
- Guard outputs with ternary expressions
- Group related optional resources (e.g., `deployMonitoring` enables workspace + alerts + dashboard)

---

## Module Composition

Standard module interface pattern — every module follows this contract:

```bicep
// modules/storage.bicep
@description('Storage account name (max 24 chars)')
param name string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Log Analytics workspace name for diagnostics')
param logAnalyticsWorkspaceName string

// ... resource definition ...

// MANDATORY outputs
@description('Resource ID of the storage account')
output resourceId string = storageAccount.id

@description('Name of the storage account')
output resourceName string = storageAccount.name

@description('Principal ID of the managed identity (empty if none)')
output principalId string = storageAccount.identity.?principalId ?? ''
```

Module conventions:

- Every module accepts `name`, `location`, `tags`, `logAnalyticsWorkspaceName`
- Every module outputs `resourceId`, `resourceName`, `principalId`
- Use `@description` on all parameters and outputs
- Use AVM modules when available — wrap with project-specific defaults if needed

---

## Managed Identity Binding

Standard pattern for granting service-to-service access:

```bicep
// Grant App Service access to Key Vault secrets
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appService.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      keyVaultSecretsUserRoleId
    )
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}
```

Common role definition IDs:

| Role                        | ID                                     |
| --------------------------- | -------------------------------------- |
| Key Vault Secrets User      | `4633458b-17de-408a-b874-0445c86b69e6` |
| Storage Blob Data Reader    | `2a2b9908-6ea1-4ae2-8e65-a410df84e7d1` |
| Storage Blob Data Contrib   | `ba92f5b4-2d11-453d-a403-e96b0029c9fe` |
| Cosmos DB Account Reader    | `fbdf93bf-df7d-467e-a4d2-9458aa1360c8` |
| SQL DB Contributor          | `9b7fa17d-e63e-47b0-bb0a-15c516ac86ec` |

- Always use `guid()` for deterministic, idempotent assignment names
- Set `principalType: 'ServicePrincipal'` for managed identities
- Scope to the narrowest resource possible

---

## What-If Interpretation

Before deploying, always run what-if to preview changes:

```bash
az deployment group what-if \
  --resource-group "$rgName" \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --no-pretty-print
```

Interpret results:

| Change Type  | Icon   | Action Required                                |
| ------------ | ------ | ---------------------------------------------- |
| Create       | green  | New resource — verify name and configuration   |
| Modify       | yellow | Property change — check for breaking changes   |
| Delete       | red    | Resource removal — confirm intentional         |
| NoChange     | grey   | Idempotent — no action needed                  |
| Deploy       | blue   | Child resource deployment                      |
| Ignore       | grey   | Read-only property change — safe to ignore     |

Red flags to catch: unexpected deletes, SKU downgrades, public access changes,
authentication mode changes, or identity removal.

---

## Learn More

For patterns not covered here, query official documentation:

| Topic                    | How to Find                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| AVM module catalog       | `microsoft_docs_search(query="Azure Verified Modules registry Bicep")`     |
| Resource type schema     | `microsoft_docs_search(query="{resource-type} Bicep template reference")` |
| Networking patterns      | `microsoft_docs_search(query="Azure hub-spoke network topology Bicep")`   |
| Security baseline        | `microsoft_docs_search(query="{service} security baseline")`              |
