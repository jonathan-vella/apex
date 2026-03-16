targetScope = 'resourceGroup'

@description('Key Vault name.')
param keyVaultName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID for the Key Vault private endpoint.')
param privateEndpointSubnetResourceId string

@description('Private DNS zone resource ID for privatelink.vaultcore.azure.net.')
param keyVaultPrivateDnsZoneResourceId string

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
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    location: location
    name: keyVaultName
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
    }
    privateEndpoints: [
      {
        name: 'pe-kv-${keyVaultName}'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'vaultcore'
              privateDnsZoneResourceId: keyVaultPrivateDnsZoneResourceId
            }
          ]
        }
        service: 'vault'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    softDeleteRetentionInDays: 90
    tags: tags
  }
}

@description('Key Vault resource ID.')
output keyVaultId string = keyVault.outputs.resourceId

@description('Key Vault name.')
output keyVaultNameOut string = keyVault.outputs.name

@description('Key Vault URI.')
output keyVaultUri string = keyVault.outputs.uri
