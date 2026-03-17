targetScope = 'resourceGroup'

param location string
param tags object
param blobStorageAccountName string
param logAnalyticsWorkspaceResourceId string
param privateEndpointSubnetResourceId string
param blobPrivateDnsZoneResourceId string

module blobStorage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    blobServices: {
      containers: [
        {
          name: 'platform-content'
          publicAccess: 'None'
        }
        {
          name: 'user-uploads'
          publicAccess: 'None'
        }
        {
          name: 'backups'
          publicAccess: 'None'
        }
      ]
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
      isVersioningEnabled: true
    }
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
    kind: 'StorageV2'
    location: location
    minimumTlsVersion: 'TLS1_2'
    name: blobStorageAccountName
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
    }
    privateEndpoints: [
      {
        location: location
        name: 'pe-${blobStorageAccountName}-blob'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'blob'
              privateDnsZoneResourceId: blobPrivateDnsZoneResourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${blobStorageAccountName}-blob'
        service: 'blob'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    requireInfrastructureEncryption: true
    skuName: 'Standard_LRS'
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

output blobStorageAccountId string = blobStorage.outputs.resourceId
output blobStorageAccountName string = blobStorage.outputs.name
