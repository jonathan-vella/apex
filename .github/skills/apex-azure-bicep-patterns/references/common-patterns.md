<!-- ref:common-patterns-v1 -->

# Common Bicep Patterns

Diagnostic settings, conditional deployment, module composition, and managed identity binding.

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

Standard module interface — every module follows this contract:

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

### Common Role Definition IDs

| Role                      | ID                                     |
| ------------------------- | -------------------------------------- |
| Key Vault Secrets User    | `4633458b-17de-408a-b874-0445c86b69e6` |
| Storage Blob Data Reader  | `2a2b9908-6ea1-4ae2-8e65-a410df84e7d1` |
| Storage Blob Data Contrib | `ba92f5b4-2d11-453d-a403-e96b0029c9fe` |
| Cosmos DB Account Reader  | `fbdf93bf-df7d-467e-a4d2-9458aa1360c8` |
| SQL DB Contributor        | `9b7fa17d-e63e-47b0-bb0a-15c516ac86ec` |

- Always use `guid()` for deterministic, idempotent assignment names
- Set `principalType: 'ServicePrincipal'` for managed identities
- Scope to the narrowest resource possible

---

## Existing Resource Dependencies (Race Condition Prevention)

The Bicep `existing` keyword resolves a resource reference at deployment time
but does **NOT** create an implicit ARM dependency. When using `existing` to
scope child resources (diagnostic settings, PE DNS zone groups), always add
explicit `dependsOn` to the module that creates the parent:

```bicep
resource vnetExisting 'Microsoft.Network/virtualNetworks@2024-01-01' existing = {
  name: vnetName
}

resource diagSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag'
  scope: vnetExisting
  dependsOn: [vnetModule]  // REQUIRED — ARM may evaluate before VNet exists
  properties: { /* ... */ }
}
```

This applies to ALL resource types: VNet, PostgreSQL, Redis, Storage, Key Vault.
ARM can evaluate the `existing` reference before the creating module completes.

---

## Key Vault Network ACLs

When `enabledForDeployment`, `enabledForDiskEncryption`, or
`enabledForTemplateDeployment` is `true`, `networkAcls.bypass` MUST include
`'AzureServices'`. Setting `bypass: 'None'` with these flags causes a BadRequest
at deployment time. The AVM Key Vault module defaults `enabledForDeployment: true`.

**Default**: Use `bypass: 'AzureServices'` unless all three flags are explicitly `false`.

---

## APIM SKU Compatibility Matrix

| Capability                     | Basic v2 | Standard v2 | Premium v2        | Premium (classic)  |
| ------------------------------ | -------- | ----------- | ----------------- | ------------------ |
| Zone redundancy                | No       | No          | Yes               | Yes (≥3 units)     |
| Internal VNet injection        | No       | No          | Yes               | Yes                |
| VNet integration (outbound)    | Yes      | Yes         | Yes               | N/A                |
| Private Endpoint (inbound)     | Yes      | Yes         | Yes               | Yes                |
| `virtualNetworkType` property  | N/A      | N/A         | Internal/External | Internal/External  |
| Front Door Private Link origin | Yes      | Yes         | Yes               | No (VNet injected) |

**Rule**: Standard v2 uses `virtualNetworkIntegration` (outbound) + Private Endpoint
(inbound). Never use `virtualNetworkType: Internal/External` — that is the
classic model for Developer/Premium only.

---

## Front Door + APIM Integration

1. **WAF resource**: Use `Microsoft.Network/FrontDoorWebApplicationFirewallPolicies`
   (not `Microsoft.Cdn/CdnWebApplicationFirewallPolicies` — CDN WAF creation is retired)
2. **Security policy**: Associate WAF via `securityPolicies` child resource on the
   Front Door profile
3. **APIM origin connectivity**:
   - Standard/Basic v2: Public origin with APIM's built-in TLS. Private Link supported.
   - Premium v2 (VNet injected, internal): Front Door Private Link is NOT supported
     for VNet-injected APIM. Use APIM's internal IP as origin with NSG allowing
     Front Door backend IPs.
4. **Front Door location**: Profile location is always `global`. For Private Link
   origins, `privateLinkLocation` must be the target resource's **region**
   (e.g., `swedencentral`), NOT `global`.

---

## AKS Preflight Constraints

Before deploying AKS, validate:

1. **Service CIDR**: Must NOT overlap any existing subnet CIDRs in the VNet
2. **Node RG name**: Must be ≤80 chars. Formula: `MC_{rgName}_{clusterName}_{region}`
   — shorten cluster name if total exceeds 80
3. **K8s version**: Verify with `az aks get-versions --location {region}`.
   Non-LTS versions require Standard tier; LTS versions require Premium tier
4. **Local accounts**: `disableLocalAccounts: true` requires `aadProfile`
   with managed AAD integration enabled
5. **Min nodes per zone**: `minCount` ≥ number of availability zones for
   true multi-zone resilience
6. **SSH public key**: Must start with `ssh-rsa`, `ssh-ed25519`, or
   `ecdsa-sha2-*` and be base64-decodable. Generate in deploy script if absent.
