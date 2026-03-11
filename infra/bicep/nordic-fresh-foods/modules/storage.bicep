targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Storage Module — Storage Account + Private Endpoint (prod)
// ──────────────────────────────────────────────

@description('Short project name for storage naming (no hyphens, max 24)')
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

@description('Blob DNS zone resource ID')
param blobDnsZoneResourceId string

@description('Log Analytics workspace name for diagnostics')
param logAnalyticsWorkspaceName string

// ──────────────────────────────────────────────
// Variables
// ──────────────────────────────────────────────

var storageAccountName = take('st${shortProjectName}${environment}${uniqueSuffix}', 24)

// ──────────────────────────────────────────────
// Log Analytics (existing)
// ──────────────────────────────────────────────

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

// ──────────────────────────────────────────────
// Storage Account (AVM)
// ──────────────────────────────────────────────

module storageAccount 'br/public:avm/res/storage/storage-account:0.32.0' = {
  name: storageAccountName
  params: {
    name: storageAccountName
    location: location
    tags: tags
    kind: 'StorageV2'
    skuName: 'Standard_LRS'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: enablePrivateEndpoints ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: enablePrivateEndpoints ? 'Deny' : 'Allow'
      bypass: 'AzureServices'
    }
    blobServices: {
      containers: [
        {
          name: 'product-images'
          publicAccess: 'None'
        }
        {
          name: 'assets'
          publicAccess: 'None'
        }
      ]
    }
    diagnosticSettings: [
      {
        workspaceResourceId: workspace.id
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
        service: 'blob'
        privateDnsZoneResourceIds: [
          blobDnsZoneResourceId
        ]
      }
    ] : []
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Storage Account resource ID')
output storageAccountResourceId string = storageAccount.outputs.resourceId

@description('Storage Account name')
output storageAccountName string = storageAccount.outputs.name
