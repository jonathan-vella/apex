// ============================================================================
// Storage Module - Storage Account
// ============================================================================
// Purpose: General-purpose storage for application data
// AVM Module: storage/storage-account v0.31.0
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for resource deployment')
param location string

@description('Environment name')
param environment string

@description('Project name')
param projectName string

@description('Unique suffix for resource naming')
param uniqueSuffix string

@description('Tags for all resources')
param tags object

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

// =============================================================================
// VARIABLES
// =============================================================================

// Storage account name (max 24 chars, lowercase, no hyphens)
// Pattern: st{project11}{env3}{suffix6}
var cleanProjectName = replace(toLower(projectName), '-', '')
var storageAccountName = 'st${take(cleanProjectName, 11)}${take(environment, 3)}${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Storage Account
// AVM: avm/res/storage/storage-account v0.31.0
// Security: HTTPS only, TLS 1.2, no public blob access
// -----------------------------------------------------------------------------

module storageAccount 'br/public:avm/res/storage/storage-account:0.31.0' = {
  name: 'storage-account'
  params: {
    name: storageAccountName
    location: location
    tags: tags

    // SKU and kind
    skuName: 'Standard_LRS' // Locally redundant for dev
    kind: 'StorageV2'

    // Security settings (WAF compliant)
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true // Enabled for dev simplicity

    // Network settings (public access for dev)
    publicNetworkAccess: 'Enabled'

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }

    // Blob services configuration
    blobServices: {
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 7 // Short retention for dev
      containerDeleteRetentionPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 7
    }

    // Diagnostic settings
    diagnosticSettings: [
      {
        name: 'diag-storage'
        workspaceResourceId: logAnalyticsWorkspaceId
        metricCategories: [
          {
            category: 'Transaction'
            enabled: true
          }
        ]
      }
    ]
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('Storage Account Resource ID')
output storageAccountId string = storageAccount.outputs.resourceId

@description('Storage Account Name')
output storageAccountName string = storageAccount.outputs.name

@description('Storage Account Primary Blob Endpoint')
output storageAccountBlobEndpoint string = storageAccount.outputs.primaryBlobEndpoint

@description('Storage Account System Assigned Identity Principal ID')
output storageAccountPrincipalId string = storageAccount.outputs.systemAssignedMIPrincipalId ?? ''
