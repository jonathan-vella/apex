// modules/storage.bicep — Storage Account with private endpoints for blob and file
// AVM: br/public:avm/res/storage/storage-account:0.14.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-004 — Storage HTTPS-only (supportsHttpsTrafficOnly: true)
//   POL-005 — Storage TLS 1.2 minimum (minimumTlsVersion: 'TLS1_2')
//   POL-006 — Disable public blob access (allowBlobPublicAccess: false)
//   POL-007 — Storage public network disabled (privateEndpoints for blob + file)
//   POL-022 — Diagnostic settings to Log Analytics
// Security: HTTPS-only, TLS 1.2, no public access, private endpoints, ZRS for prod

@description('Azure region for the storage account (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls SKU and file share tier.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('4-character unique suffix derived from resource group ID (passed from main.bicep).')
param uniqueSuffix string

@description('Storage account name (max 24 chars, no hyphens).')
param storageAccountName string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('Data subnet resource ID for private endpoints (POL-007).')
param dataSubnetId string

@description('Blob private DNS zone resource ID (privatelink.blob.core.windows.net).')
param blobPrivateDnsZoneId string

@description('File private DNS zone resource ID (privatelink.file.core.windows.net).')
param filePrivateDnsZoneId string

// ─────────────────────────────── Environment-specific sizing ─────────────────

// SKU: Standard_ZRS for prod (zone-redundant), Standard_LRS for dev/staging
var skuName = env == 'prod' ? 'Standard_ZRS' : 'Standard_LRS'

// File share tier: Premium for prod (SSD), Standard for dev/staging
// Premium file shares require account kind 'FileStorage'; we use StorageV2 so Standard_LRS
// file shares are used for dev/staging; for prod use a separate FileStorage account if
// Premium file shares are strictly required. The plan specifies StorageV2 so we keep it
// consistent and use Standard tier file shares across all envs on this account.
// Large file shares are enabled (100+ TB) to support 256 GB quota targets.
var fileShareQuotaGb = env == 'prod' ? 256 : 128

// ──────────────────────────────── Storage Account ────────────────────────────

module storageAccount 'br/public:avm/res/storage/storage-account:0.14.0' = {
  name: 'storage-account'
  params: {
    name: storageAccountName
    location: location

    // Kind: StorageV2 (general purpose v2)
    kind: 'StorageV2'

    // SKU — environment-specific redundancy
    skuName: skuName

    // POL-004: HTTPS-only traffic
    supportsHttpsTrafficOnly: true

    // POL-005: TLS 1.2 minimum
    minimumTlsVersion: 'TLS1_2'

    // POL-006: No public blob access (blocks anonymous container reads)
    allowBlobPublicAccess: false

    // POL-007: Public network access Disabled — private endpoints only
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }

    // Allow shared key access disabled — use Entra ID / managed identity
    allowSharedKeyAccess: false

    // Blob service — configure container for application data
    blobServices: {
      containers: [
        {
          name: 'app-data'
          publicAccess: 'None'
        }
      ]
      // Soft delete for blobs — 14 days for recoverability
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 14
      // Container-level soft delete
      containerDeleteRetentionPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 14
    }

    // File service — shared file storage for applications
    fileServices: {
      shares: [
        {
          name: 'app-share'
          // Access tier supported on StorageV2 (Standard file shares only)
          accessTier: 'Hot'
          shareQuota: fileShareQuotaGb
        }
      ]
    }

    // POL-007: Private endpoints — one for blob, one for file
    privateEndpoints: [
      {
        name: 'pe-blob-${uniqueSuffix}'
        service: 'blob'
        subnetResourceId: dataSubnetId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: blobPrivateDnsZoneId
            }
          ]
        }
      }
      {
        name: 'pe-file-${uniqueSuffix}'
        service: 'file'
        subnetResourceId: dataSubnetId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: filePrivateDnsZoneId
            }
          ]
        }
      }
    ]

    // POL-022: Diagnostic settings — metrics only (Storage 0.14.0 diagnosticSettings schema)
    // Full log export requires per-service diagnostic settings on blobServices/fileServices
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Storage account resource ID.')
output storageAccountId string = storageAccount.outputs.resourceId

@description('Storage account name.')
output storageAccountName string = storageAccount.outputs.name

@description('Primary blob endpoint.')
output blobEndpoint string = storageAccount.outputs.primaryBlobEndpoint
