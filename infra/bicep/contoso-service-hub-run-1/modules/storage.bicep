targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Blob storage account name.')
param blobStorageAccountName string

@description('Azure Files storage account name.')
param fileStorageAccountName string

@description('Project name for managed disk naming.')
param projectName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Subnet resource ID for storage private endpoints.')
param privateEndpointSubnetResourceId string

@description('Virtual network resource ID used to link the Azure Files private DNS zone.')
param virtualNetworkResourceId string

@description('Private DNS zone resource ID for privatelink.blob.core.windows.net.')
param blobPrivateDnsZoneResourceId string

@description('Key Vault resource ID for storage secret export configuration.')
param keyVaultResourceId string

var filePrivateDnsZoneName = 'privatelink.file.${az.environment().suffixes.storage}'

module fileDnsZone 'br/public:avm/res/network/private-dns-zone:0.8.1' = {
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

module blobStorage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    blobServices: {
      containers: [
        {
          name: 'media'
          publicAccess: 'None'
        }
        {
          name: 'assets'
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
    secretsExportConfiguration: {
      connectionString1Name: '${blobStorageAccountName}-connection-string'
      keyVaultResourceId: keyVaultResourceId
    }
    skuName: 'Standard_LRS'
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

module fileStorage 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
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
          name: 'shared'
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
              privateDnsZoneResourceId: fileDnsZone.outputs.resourceId
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
    secretsExportConfiguration: {
      connectionString1Name: '${fileStorageAccountName}-connection-string'
      keyVaultResourceId: keyVaultResourceId
    }
    skuName: 'Premium_LRS'
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

module disk01 'br/public:avm/res/compute/disk:0.6.0' = {
  params: {
    availabilityZone: -1
    createOption: 'Empty'
    diskSizeGB: 256
    location: location
    name: 'disk-${projectName}-${environment}-01'
    networkAccessPolicy: 'DenyAll'
    publicNetworkAccess: 'Disabled'
    sku: 'Premium_LRS'
    tags: tags
  }
}

module disk02 'br/public:avm/res/compute/disk:0.6.0' = {
  params: {
    availabilityZone: -1
    createOption: 'Empty'
    diskSizeGB: 256
    location: location
    name: 'disk-${projectName}-${environment}-02'
    networkAccessPolicy: 'DenyAll'
    publicNetworkAccess: 'Disabled'
    sku: 'Premium_LRS'
    tags: tags
  }
}

module disk03 'br/public:avm/res/compute/disk:0.6.0' = {
  params: {
    availabilityZone: -1
    createOption: 'Empty'
    diskSizeGB: 256
    location: location
    name: 'disk-${projectName}-${environment}-03'
    networkAccessPolicy: 'DenyAll'
    publicNetworkAccess: 'Disabled'
    sku: 'Premium_LRS'
    tags: tags
  }
}

@description('Blob storage account resource ID.')
output blobStorageId string = blobStorage.outputs.resourceId

@description('Blob storage account name.')
output blobStorageName string = blobStorage.outputs.name

@description('Azure Files storage account resource ID.')
output fileStorageId string = fileStorage.outputs.resourceId

@description('Azure Files storage account name.')
output fileStorageName string = fileStorage.outputs.name

@description('Managed disk resource IDs.')
output managedDiskIds array = [
  disk01.outputs.resourceId
  disk02.outputs.resourceId
  disk03.outputs.resourceId
]
