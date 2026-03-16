targetScope = 'resourceGroup'

@description('Key Vault resource name.')
param keyVaultName string

@description('Azure region.')
param location string

@description('Log Analytics workspace name used for diagnostic settings.')
param logAnalyticsWorkspaceName string

@description('Resource tags.')
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

module keyVault 'br/public:avm/res/key-vault/vault:0.13.3' = {
  params: {
    diagnosticSettings: [
      {
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
        workspaceResourceId: workspace.id
      }
    ]
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    location: location
    name: keyVaultName
    // B1 App Service has no VNet integration; bypass for Azure services
    // is the compensating control for the simple-tier architecture
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
    }
    publicNetworkAccess: 'Enabled'
    softDeleteRetentionInDays: 90
    tags: tags
  }
}

@description('Key Vault resource ID.')
output resourceId string = keyVault.outputs.resourceId

@description('Key Vault resource name.')
output resourceName string = keyVault.outputs.name

@description('Key Vault URI.')
output uri string = keyVault.outputs.uri
