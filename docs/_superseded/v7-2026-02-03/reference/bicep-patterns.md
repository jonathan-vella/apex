# Bicep Patterns Reference

> **Version 5.3.0** | Critical deployment patterns for Azure Bicep

This document contains essential Bicep patterns extracted from the copilot instructions. These patterns solve
common deployment challenges and policy compliance issues.

---

## Resource Naming with Unique Suffixes

**Problem**: Azure resources like Key Vault, Storage Accounts, and SQL Servers require globally unique names.
Without suffixes, deployments fail with naming collisions.

### Solution Pattern

```bicep
// main.bicep - Generate suffix once
var uniqueSuffix = uniqueString(resourceGroup().id)

// Pass to all modules
module keyVault 'modules/key-vault.bicep' = {
  params: {
    uniqueSuffix: uniqueSuffix
    // ... other params
  }
}

// modules/key-vault.bicep - Apply to resource names
param uniqueSuffix string
var keyVaultName = 'kv-${take(replace(projectName, '-', ''), 8)}-${take(environment, 3)}-${take(uniqueSuffix, 6)}'
// Result: "kv-contosop-dev-abc123" (22 chars, within 24 limit)
```

### Key Points

- Use `take()` to control name length (Key Vault = 24 chars max)
- Remove hyphens for Storage Accounts (no special chars allowed)
- Shorten project names (e.g., "contoso-patient-portal" → "contosop")
- Apply suffix to ALL resources for consistency
- Generate suffix in `main.bicep`, pass to all modules

---

## Diagnostic Settings Module Pattern

When creating diagnostic settings, pass resource **names** (not IDs) and use the `existing` keyword.

### ❌ Wrong Approach

```bicep
// This fails with BCP036 error
module diagnosticsModule 'modules/diagnostics.bicep' = {
  params: {
    appServiceId: appServiceModule.outputs.appServiceId  // String IDs don't work!
  }
}
```

### ✅ Correct Approach

```bicep
// Pass resource names instead
module diagnosticsModule 'modules/diagnostics.bicep' = {
  params: {
    appServiceName: appServiceModule.outputs.appServiceName
    logAnalyticsWorkspaceId: logAnalyticsModule.outputs.workspaceId
  }
}

// In modules/diagnostics.bicep:
param appServiceName string
param logAnalyticsWorkspaceId string

resource appService 'Microsoft.Web/sites@2023-12-01' existing = {
  name: appServiceName
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-appservice'
  scope: appService  // ✅ Symbolic reference works
  properties: {
    workspaceId: logAnalyticsWorkspaceId
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

### Why This Works

The `scope` property requires a resource symbolic reference, not a string. Resource IDs are strings and cause
`BCP036: The property "scope" expected a value of type "resource | tenant"` errors.

**Module Output Rule**: Always output BOTH `resourceId` AND `resourceName` from modules to support downstream
diagnostic settings.

---

## Azure Policy Workarounds

Common Azure Policy blockers and their solutions:

### SQL Server Azure AD-Only Authentication

```bicep
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true  // Required by policy
      login: sqlAdminGroupName
      sid: sqlAdminGroupObjectId
      tenantId: tenant().tenantId
      principalType: 'Group'
    }
  }
}
```

### App Service Zone Redundancy

> ⚠️ Must use **P1v4** or higher. Standard SKU (S1/S2/S3) does NOT support zone redundancy.

```bicep
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'P1v4'  // Premium required for zone redundancy
    tier: 'PremiumV3'
    capacity: 3
  }
  properties: {
    zoneRedundant: true  // Only works with Premium SKU
  }
}
```

### Storage Account Shared Key Access

When Azure Policy blocks `allowSharedKeyAccess`, use identity-based connections:

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  properties: {
    allowSharedKeyAccess: false  // Required by Azure Policy
  }
}

// For Azure Functions, use identity-based storage
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  identity: { type: 'SystemAssigned' }
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storageAccount.name }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
      ]
    }
  }
}
```

Required RBAC roles for identity-based storage:

- Storage Blob Data Owner (for blob triggers)
- Storage Queue Data Contributor (for durable functions)
- Storage Table Data Contributor (for durable functions checkpoints)

### WAF Policy Naming

WAF policy names must start with letter, alphanumeric only (NO hyphens):

```bicep
// ❌ Wrong
var wafPolicyName = 'waf-${projectName}-${environment}'  // Hyphens not allowed

// ✅ Correct
var wafPolicyName = 'wafpolicy${replace(projectName, '-', '')}${environment}001'
```

### WAF matchVariable Values

Use `RequestHeader` (singular) not `RequestHeaders`. Valid values:

- `RemoteAddr`, `RequestMethod`, `QueryString`, `PostArgs`
- `RequestUri`, `RequestHeader`, `RequestBody`, `Cookies`, `SocketAddr`

### SQL Server Diagnostic Settings

Don't use `SQLSecurityAuditEvents` category—use `auditingSettings` resource instead:

```bicep
resource sqlAuditing 'Microsoft.Sql/servers/auditingSettings@2023-05-01-preview' = {
  parent: sqlServer
  name: 'default'
  properties: {
    state: 'Enabled'
    storageEndpoint: storageAccount.properties.primaryEndpoints.blob
    storageAccountAccessKey: storageAccount.listKeys().keys[0].value
    retentionDays: 90
  }
}
```

---

## Progressive Deployment Pattern

For complex infrastructure (10+ resources, multiple modules):

| Phase | Resources                                 |
| ----- | ----------------------------------------- |
| 1     | Foundation (networking, NSGs)             |
| 2     | Platform services (Key Vault, SQL, ASP)   |
| 3     | Application tier (App Service, databases) |
| 4     | Configuration (secrets, RBAC, monitoring) |

Between each phase:

```bash
bicep build main.bicep
bicep lint main.bicep
az deployment group create --what-if ...
az deployment group create ...
# Validate resources exist before proceeding
```

**Why**: Helps isolate dependency issues, provides clear rollback points, makes debugging easier.

---

## Parameter Documentation Pattern

```bicep
@description('Azure region for all resources')
@allowed([
  'swedencentral'
  'germanywestcentral'
  'northeurope'
])
param location string = 'swedencentral'

@description('Unique suffix for resource naming (generated from resource group ID)')
param uniqueSuffix string

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
  'demo'
])
param environment string = 'dev'

@description('Project name for resource naming and tagging')
@minLength(3)
@maxLength(20)
param projectName string
```

---

## Module Output Pattern

Always output both ID and name:

```bicep
// modules/key-vault.bicep

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  // ...
}

// ✅ Output both ID and name
output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
```

---

## Security Defaults

```bicep
// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false  // If policy requires
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  properties: {
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    enableRbacAuthorization: true
  }
}

// NSG deny rule
{
  name: 'DenyAllInbound'
  properties: {
    priority: 4096
    direction: 'Inbound'
    access: 'Deny'
    protocol: '*'
    sourceAddressPrefix: '*'
    destinationAddressPrefix: '*'
    sourcePortRange: '*'
    destinationPortRange: '*'
  }
}
```

---

## Related Documentation

- [Defaults Reference](defaults.md) — Regions, naming, tags, SKUs
- [Agents Overview](agents-overview.md) — All 7 agents
- [Workflow Reference](workflow.md) — 7-step workflow
- [ADR-003: AVM-First (Archived)](../_superseded/adr/ADR-003-avm-first-approach.md) — Use Azure Verified Modules
