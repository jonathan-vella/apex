// modules/key-vault.bicep
// Phase 1 — Key Vault with RBAC, purge protection, soft delete, private endpoint
// AVM: br/public:avm/res/key-vault/vault:0.13.3
// Governance: purge protection required, soft delete 90 days, public access Disabled,
//             Key Vault private-only policy, mandatory tags, EU location enforced

@description('Azure region for the Key Vault.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('4-character unique suffix for globally unique names (KV max 24 chars).')
param uniqueSuffix string

@description('Principal ID of the managed identity to assign Key Vault Secrets User role.')
param identityPrincipalId string

@description('Private Endpoint subnet resource ID.')
param subnetPeId string

@description('Private DNS zone resource ID for Key Vault (privatelink.vaultcore.azure.net).')
param privateDnsZoneKeyVaultId string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived names ───────────────────────────────
// Key Vault name: kv-{short}-{env}-{suffix} — max 24 chars, no consecutive hyphens
// Example: kv-csh-dev-a1b2 (16 chars) ✓

var shortProject = 'csh'
var kvName       = take('kv-${shortProject}-${environment}-${uniqueSuffix}', 24)
var peName       = 'pe-kv-${shortProject}-${environment}'

// ──────────────────────────────────── Key Vault ───────────────────────────────

module keyVault 'br/public:avm/res/key-vault/vault:0.13.3' = {
  name: 'key-vault'
  params: {
    name: kvName
    location: location

    // Security baseline — governance policies 8, 9, 10
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }

    // Key Vault SKU — Standard tier meets all requirements
    sku: 'standard'

    // Not using KV references in ARM deployments — no deployment flags needed
    enableVaultForDeployment: false
    enableVaultForDiskEncryption: false
    enableVaultForTemplateDeployment: false

    // Private Endpoint wired to PE subnet + private DNS zone for resolution
    privateEndpoints: [
      {
        name: peName
        subnetResourceId: subnetPeId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: privateDnsZoneKeyVaultId
            }
          ]
        }
      }
    ]

    // RBAC: grant managed identity Key Vault Secrets User (read secrets/keys/certs)
    roleAssignments: [
      {
        principalId: identityPrincipalId
        roleDefinitionIdOrName: 'Key Vault Secrets User'
        principalType: 'ServicePrincipal'
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Key Vault resource ID.')
output keyVaultId string = keyVault.outputs.resourceId

@description('Key Vault name.')
output keyVaultName string = keyVault.outputs.name

@description('Key Vault URI.')
output keyVaultUri string = keyVault.outputs.uri
