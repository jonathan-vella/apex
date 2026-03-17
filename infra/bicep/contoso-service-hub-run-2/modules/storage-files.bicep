targetScope = 'resourceGroup'

param location string
param tags object
param fileStorageAccountName string
param logAnalyticsWorkspaceResourceId string
param privateEndpointSubnetResourceId string
param filePrivateDnsZoneResourceId string

module fileStorage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    diagnosticSettings: [
      {
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    fileServices: {
      diagnosticSettings: [
        {
          logCategoriesAndGroups: [
            {
              categoryGroup: 'allLogs'
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
      shares: [
        {
          accessTier: 'Premium'
          enabledProtocols: 'SMB'
          name: 'app-data'
          shareQuota: 256
        }
      ]
    }
    kind: 'FileStorage'
    location: location
    minimumTlsVersion: 'TLS1_2'
    name: fileStorageAccountName
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
    }
    privateEndpoints: [
      {
        location: location
        name: 'pe-${fileStorageAccountName}-file'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'file'
              privateDnsZoneResourceId: filePrivateDnsZoneResourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${fileStorageAccountName}-file'
        service: 'file'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    requireInfrastructureEncryption: true
    skuName: 'Premium_LRS'
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

output fileStorageAccountId string = fileStorage.outputs.resourceId
output fileStorageAccountName string = fileStorage.outputs.name
