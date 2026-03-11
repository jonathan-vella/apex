targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Key Vault Module — AVM + Private Endpoint (prod)
// ──────────────────────────────────────────────

@description('Short project name for KV naming (max 24 chars total)')
param shortProjectName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

@description('Unique suffix from main.bicep')
param uniqueSuffix string

@description('Enable private endpoint')
param enablePrivateEndpoints bool

@description('Private endpoint subnet resource ID')
param peSubnetResourceId string

@description('Key Vault DNS zone resource ID')
param kvDnsZoneResourceId string

@description('Log Analytics workspace name for diagnostics')
param logAnalyticsWorkspaceName string

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var kvName = take('kv-${shortProjectName}-${environment}-${uniqueSuffix}', 24)

// ──────────────────────────────────────────────
// Log Analytics (existing)
// ──────────────────────────────────────────────

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

// ──────────────────────────────────────────────
// Key Vault (AVM)
// ──────────────────────────────────────────────

module keyVault 'br/public:avm/res/key-vault/vault:0.13.3' = {
  name: kvName
  params: {
    name: kvName
    location: location
    tags: tags
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: enablePrivateEndpoints ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
    diagnosticSettings: [
      {
        workspaceResourceId: workspace.id
        logCategoriesAndGroups: [
          {
            categoryGroup: 'audit'
            enabled: true
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]
    privateEndpoints: enablePrivateEndpoints ? [
      {
        subnetResourceId: peSubnetResourceId
        privateDnsZoneResourceIds: [
          kvDnsZoneResourceId
        ]
      }
    ] : []
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Key Vault resource ID')
output keyVaultResourceId string = keyVault.outputs.resourceId

@description('Key Vault name')
output keyVaultName string = keyVault.outputs.name

@description('Key Vault URI')
output keyVaultUri string = keyVault.outputs.uri
