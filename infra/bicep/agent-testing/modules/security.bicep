// ============================================================================
// Security Module - Key Vault
// ============================================================================
// Purpose: Secure secrets management with RBAC-enabled Key Vault
// AVM Module: key-vault/vault v0.13.3
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

// Key Vault name (max 24 chars): kv-{project8}-{env}-{suffix6}
var keyVaultName = 'kv-${take(projectName, 8)}-${environment}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Key Vault
// AVM: avm/res/key-vault/vault v0.13.3
// Security: RBAC-enabled, soft delete, purge protection (dev: disabled)
// -----------------------------------------------------------------------------

module keyVault 'br/public:avm/res/key-vault/vault:0.13.3' = {
  name: 'key-vault'
  params: {
    name: keyVaultName
    location: location
    tags: tags

    // SKU
    sku: 'standard' // string type, not object

    // RBAC-based access (recommended over access policies)
    enableRbacAuthorization: true

    // Soft delete settings (note: retention days cannot be changed on existing vault)
    enableSoftDelete: true

    // Purge protection (disabled for dev to allow cleanup)
    enablePurgeProtection: false

    // Network settings (public access for dev simplicity)
    publicNetworkAccess: 'Enabled'

    // Diagnostic settings
    diagnosticSettings: [
      {
        name: 'diag-keyvault'
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          {
            category: 'AuditEvent'
            enabled: true
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
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

@description('Key Vault Resource ID')
output keyVaultId string = keyVault.outputs.resourceId

@description('Key Vault Name')
output keyVaultName string = keyVault.outputs.name

@description('Key Vault URI')
output keyVaultUri string = keyVault.outputs.uri
