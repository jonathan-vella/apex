@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size the storage account.')
param environmentName string

@description('Azure region for the storage deployment.')
param location string

@description('Common resource tags applied to storage resources.')
param tags object

@description('Storage account name.')
param storageAccountName string

@description('Log Analytics workspace resource ID used for storage diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID used for storage private endpoints.')
param privateEndpointSubnetResourceId string

@description('Virtual network resource ID used to link storage private DNS zones.')
param virtualNetworkResourceId string

@description('Key Vault resource ID used for secret export configuration.')
param keyVaultResourceId string

var blobPrivateDnsZoneName = 'privatelink.blob.${az.environment().suffixes.storage}'
var filePrivateDnsZoneName = 'privatelink.file.${az.environment().suffixes.storage}'
var fileShareQuota = environmentName == 'prod' ? 256 : environmentName == 'staging' ? 128 : 64
var storageSkuName = environmentName == 'prod' ? 'Standard_ZRS' : 'Standard_LRS'

module blobPrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: blobPrivateDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module filePrivateDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
  params: {
    location: 'global'
    name: filePrivateDnsZoneName
    tags: tags
    virtualNetworkLinks: [
      {
        registrationEnabled: false
        virtualNetworkResourceId: virtualNetworkResourceId
      }
    ]
  }
}

module storage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    blobServices: {
      containers: [
        {
          name: 'content'
          publicAccess: 'None'
        }
        {
          name: 'uploads'
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
          name: 'shared'
          shareQuota: fileShareQuota
        }
      ]
    }
    kind: 'StorageV2'
    location: location
    minimumTlsVersion: 'TLS1_2'
    name: storageAccountName
    networkAcls: {
      bypass: 'None'
      defaultAction: 'Deny'
    }
    privateEndpoints: [
      {
        location: location
        name: 'pe-${storageAccountName}-blob'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'blob'
              privateDnsZoneResourceId: blobPrivateDnsZone.outputs.resourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${storageAccountName}-blob'
        service: 'blob'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
      {
        location: location
        name: 'pe-${storageAccountName}-file'
        privateDnsZoneGroup: {
          name: 'default'
          privateDnsZoneGroupConfigs: [
            {
              name: 'file'
              privateDnsZoneResourceId: filePrivateDnsZone.outputs.resourceId
            }
          ]
        }
        privateLinkServiceConnectionName: 'plsc-${storageAccountName}-file'
        service: 'file'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: 'Disabled'
    requireInfrastructureEncryption: true
    secretsExportConfiguration: {
      connectionString1Name: '${storageAccountName}-connection-string'
      keyVaultResourceId: keyVaultResourceId
    }
    skuName: storageSkuName
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

@description('Storage account resource ID.')
output storageAccountId string = storage.outputs.resourceId

@description('Storage account name.')
output storageAccountNameOut string = storage.outputs.name

@description('Primary blob endpoint for the storage account.')
output blobEndpoint string = 'https://${storageAccountName}.blob.${az.environment().suffixes.storage}'

@description('Primary file endpoint for the storage account.')
output fileEndpoint string = 'https://${storageAccountName}.file.${az.environment().suffixes.storage}'
