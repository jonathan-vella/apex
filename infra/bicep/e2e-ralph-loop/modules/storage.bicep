targetScope = 'resourceGroup'

@description('Azure region.')
param location string

@description('Log Analytics workspace name used for diagnostic settings.')
param logAnalyticsWorkspaceName string

@description('Storage Account resource name.')
param storageAccountName string

@description('Resource tags.')
param tags object

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

module storageAccount 'br/public:avm/res/storage/storage-account:0.32.0' = {
  params: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    blobServices: {
      containers: [
        {
          name: 'assets'
          publicAccess: 'None'
        }
      ]
    }
    diagnosticSettings: [
      {
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
        workspaceResourceId: workspace.id
      }
    ]
    kind: 'StorageV2'
    location: location
    minimumTlsVersion: 'TLS1_2'
    name: storageAccountName
    // B1 App Service has no VNet integration; bypass for Azure services
    networkAcls: {
      bypass: 'AzureServices, Logging, Metrics'
      defaultAction: 'Deny'
    }
    publicNetworkAccess: 'Enabled'
    skuName: 'Standard_LRS'
    supportsHttpsTrafficOnly: true
    tags: tags
  }
}

@description('Storage Account resource ID.')
output resourceId string = storageAccount.outputs.resourceId

@description('Storage Account resource name.')
output resourceName string = storageAccount.outputs.name
