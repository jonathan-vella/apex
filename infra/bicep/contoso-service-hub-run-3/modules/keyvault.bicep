@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to tune retention and protection defaults.')
param environmentName string

@description('Azure region for the Key Vault deployment.')
param location string

@description('Common resource tags for Key Vault and its private endpoint.')
param tags object

@description('Key Vault name.')
param keyVaultName string

@description('Log Analytics workspace resource ID used for Key Vault diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID used for the Key Vault private endpoint.')
param privateEndpointSubnetResourceId string

@description('Virtual network resource ID used to link the Key Vault private DNS zone.')
param virtualNetworkResourceId string

var keyVaultPrivateDnsZoneName = 'privatelink.vaultcore.azure.net'

var purgeProtectionEnabled = environmentName != 'dev' ? true : true

module keyVaultPrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: keyVaultPrivateDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
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
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    enablePurgeProtection: purgeProtectionEnabled
    enableRbacAuthorization: true
    enableSoftDelete: true
    location: location
    name: keyVaultName
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
    }
    privateEndpoints: [
      {
        name: 'pe-${keyVaultName}'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'vaultcore'
              privateDnsZoneResourceId: keyVaultPrivateDnsZone.outputs.resourceId
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
