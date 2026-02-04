// ============================================================================
// Key Vault Module (Scenario 2 & 3: Secrets Management)
// ============================================================================
// Purpose: Secure secrets storage for test scenarios
// AVM Reference: br/public:avm/res/key-vault/vault
// Note: Soft delete disabled for easy test cleanup
// ============================================================================

@description('Name of the Key Vault (max 24 characters)')
@maxLength(24)
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('SKU for Key Vault')
@allowed(['standard', 'premium'])
param sku string = 'standard'

@description('Enable soft delete (disabled for test cleanup)')
param enableSoftDelete bool = false

@description('Enable purge protection (disabled for test cleanup)')
param enablePurgeProtection bool = false

@description('Enable RBAC authorization')
param enableRbacAuthorization bool = true

// ============================================================================
// Key Vault Resource
// ============================================================================

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: sku
    }
    tenantId: subscription().tenantId
    enableSoftDelete: enableSoftDelete
    enablePurgeProtection: enablePurgeProtection ? true : null
    enableRbacAuthorization: enableRbacAuthorization
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    publicNetworkAccess: 'Enabled' // Test resources use public access
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Key Vault URI')
output uri string = keyVault.properties.vaultUri

@description('Key Vault resource ID')
output resourceId string = keyVault.id

@description('Key Vault name')
output name string = keyVault.name
