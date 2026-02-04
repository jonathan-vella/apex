// ============================================================================
// Storage Account Module (Scenario 3: Microservices)
// ============================================================================
// Purpose: Blob storage for microservices testing
// AVM Reference: br/public:avm/res/storage/storage-account
// Security: HTTPS-only, TLS 1.2, No public blob access
// ============================================================================

@description('Name of the Storage Account (lowercase, no hyphens, max 24 chars)')
@maxLength(24)
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('SKU for Storage Account')
@allowed(['Standard_LRS', 'Standard_GRS', 'Standard_ZRS', 'Premium_LRS'])
param skuName string = 'Standard_LRS'

@description('Storage account kind')
@allowed(['StorageV2', 'BlobStorage', 'BlockBlobStorage'])
param kind string = 'StorageV2'

// ============================================================================
// Storage Account Resource
// ============================================================================

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  kind: kind
  properties: {
    // Security settings (PCI DSS compliance)
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // Required for some test scenarios
    
    // Access tier
    accessTier: 'Hot'
    
    // Network settings (public for test resources)
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    
    // Encryption
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
        file: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// Blob service configuration
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: false // No retention for test resources
    }
  }
}

// Test container
resource testContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'test-data'
  properties: {
    publicAccess: 'None'
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Storage Account primary blob endpoint')
output primaryBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob

@description('Storage Account resource ID')
output resourceId string = storageAccount.id

@description('Storage Account name')
output name string = storageAccount.name
