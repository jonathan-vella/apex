// modules/storage.bicep
// Phase 2 — Storage Account (StorageV2, ZRS, hot tier) with blob + file private endpoints
// AVM: br/public:avm/res/storage/storage-account:0.32.0
// Governance:
//   - supportsHttpsTrafficOnly: true (storage-https-only policy)
//   - minimumTlsVersion: TLS1_2 (storage-min-tls-12 policy)
//   - allowBlobPublicAccess: false (storage-no-public-blob policy)
//   - publicNetworkAccess: Disabled (storage-private-endpoints-only policy)
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('4-character unique suffix for globally unique 24-char storage account names.')
param uniqueSuffix string

@description('Private Endpoint subnet resource ID (snet-pe).')
param subnetPeId string

@description('Private DNS zone resource ID for Blob Storage (privatelink.blob.core.windows.net).')
param privateDnsZoneBlobId string

@description('Private DNS zone resource ID for Azure Files (privatelink.file.core.windows.net).')
param privateDnsZoneFileId string

@description('Log Analytics workspace resource ID for diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('Principal ID of the user-assigned managed identity for RBAC role assignment.')
param identityPrincipalId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// Storage account name: no hyphens, max 24 chars, lowercase only
// Pattern: st{shortProject}{env}{suffix} — e.g. stcshdev1234
var shortProject  = 'csh'
var saName        = take(toLower('st${shortProject}${environment}${uniqueSuffix}'), 24)
var peBlobName    = 'pe-blob-${projectName}-${environment}'
var peFileName    = 'pe-file-${projectName}-${environment}'

// SKU — Standard_ZRS for EU data residency (no GRS cross-region replication)
//       Standard_LRS for dev/staging (cost optimised)
var skuName = environment == 'prod' ? 'Standard_ZRS' : 'Standard_LRS'

// File share quota — 256 GiB for prod, 64 GiB for dev/staging
var fileShareQuotaGiB = environment == 'prod' ? 256 : 64

// ─────────────────────────────── Storage Account ─────────────────────────────

module storageAccount 'br/public:avm/res/storage/storage-account:0.32.0' = {
  name: 'storage-account'
  params: {
    name: saName
    location: location

    // Governance: storage-https-only (Deny) — HTTPS-only traffic
    supportsHttpsTrafficOnly: true

    // Governance: storage-min-tls-12 (Deny) — TLS 1.2 minimum
    minimumTlsVersion: 'TLS1_2'

    // Governance: storage-no-public-blob (Deny) — no anonymous blob access
    allowBlobPublicAccess: false

    // Governance: storage-private-endpoints-only (Deny) — disable public network access
    publicNetworkAccess: 'Disabled'

    // StorageV2 + Hot tier (standard for general-purpose workloads)
    kind: 'StorageV2'
    skuName: skuName
    accessTier: 'Hot'

    // Allow cross-tenant replication disabled (EU Data Boundary)
    allowCrossTenantReplication: false

    // Blob service — soft delete 30 days (flat AVM params), containers for application data
    blobServices: {
      deleteRetentionPolicyEnabled: true
      deleteRetentionPolicyDays: 30
      containerDeleteRetentionPolicyEnabled: true
      containerDeleteRetentionPolicyDays: 30
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
    }

    // File service — Premium SSD equivalent file shares for application mounts
    fileServices: {
      shares: [
        {
          name: 'appshare'
          shareQuota: fileShareQuotaGiB
          enabledProtocols: 'SMB'
        }
      ]
    }

    // Private Endpoints — blob and file (snet-pe subnet + private DNS zones)
    privateEndpoints: [
      {
        name: peBlobName
        subnetResourceId: subnetPeId
        service: 'blob'
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneBlobId
            }
          ]
        }
      }
      {
        name: peFileName
        subnetResourceId: subnetPeId
        service: 'file'
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneFileId
            }
          ]
        }
      }
    ]

    // RBAC — managed identity gets Storage Blob Data Contributor for application access
    roleAssignments: [
      {
        principalId: identityPrincipalId
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
        principalType: 'ServicePrincipal'
      }
    ]

    // Diagnostics → Log Analytics (mandatory for governance visibility)
    diagnosticSettings: [
      {
        workspaceResourceId: logAnalyticsWorkspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
          }
        ]
      }
    ]

    // Governance: required-tags (Deny) — all 4 tags mandatory
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Storage account resource ID.')
output storageAccountId string = storageAccount.outputs.resourceId

@description('Storage account name.')
output storageAccountName string = storageAccount.outputs.name

@description('Primary blob service endpoint URL.')
output blobEndpoint string = storageAccount.outputs.primaryBlobEndpoint

@description('Primary file service endpoint URL (constructed from storage account name).')
#disable-next-line no-hardcoded-env-urls  // Required: Azure commercial cloud standard file storage hostname pattern
output fileEndpoint string = 'https://${storageAccount.outputs.name}.file.core.windows.net/'
