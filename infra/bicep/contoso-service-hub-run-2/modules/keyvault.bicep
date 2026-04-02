// modules/keyvault.bicep — Key Vault with RBAC, purge protection, private endpoint
// AVM: br/public:avm/res/key-vault/vault:0.11.0
// Governance: POL-008 (purge protection + 90-day soft delete required),
//             POL-009 (private-only access — public network Disabled),
//             POL-021 (managed identity preference — RBAC, no access policies),
//             POL-022 (diagnostic settings to Log Analytics)
// Security: networkAcls bypass=AzureServices, RBAC authorization, standard SKU

@description('Azure region for the Key Vault (must be swedencentral, POL-001).')
param location string

@description('Key Vault name (max 24 chars, alphanumeric and hyphens, must start with letter).')
param keyVaultName string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('Data subnet resource ID for the Key Vault private endpoint (POL-009).')
param dataSubnetId string

@description('Key Vault private DNS zone resource ID (privatelink.vaultcore.azure.net).')
param kvPrivateDnsZoneId string

@description('Principal ID of the shared managed identity — granted Key Vault Secrets User (POL-021).')
param identityPrincipalId string

@description('Enable private endpoint for Key Vault. Required by POL-009 (Deny).')
param enablePrivateEndpoint bool = true

@description('Certificate name used for the Application Gateway frontend listener.')
param appGatewayCertificateName string = 'appgateway-tls'

@description('Certificate subject used for the bootstrap Application Gateway TLS certificate.')
param appGatewayCertificateSubject string = 'CN=contoso-service-hub.internal'

// ─────────────────────────────────── Key Vault ───────────────────────────────

module keyVault 'br/public:avm/res/key-vault/vault:0.11.0' = {
  name: 'key-vault'
  params: {
    name: keyVaultName
    location: location

    // SKU — Standard meets all requirements; Premium needed only for HSM keys
    sku: 'standard'

    // Security baseline: RBAC authorization (no legacy access policies, POL-021)
    enableRbacAuthorization: true

    // POL-008: Purge protection and 90-day soft delete are mandatory (Deny effect)
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90

    // Deployment flags: disabled — no ARM deployment references needed at this stage.
    // NOTE: if Bicep templateDeployment references to KV are added, set bypass=AzureServices
    //       and enableVaultForTemplateDeployment=true (AVM will auto-set bypass).
    enableVaultForDeployment: false
    enableVaultForDiskEncryption: false
    enableVaultForTemplateDeployment: false

    // POL-009: Public network access Disabled — only private endpoint traffic allowed.
    // networkAcls.bypass=AzureServices allows trusted Azure services (Monitor, Backup, etc.)
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      ipRules: []
      virtualNetworkRules: []
    }

    // POL-009: Private endpoint in data subnet with DNS zone group for name resolution.
    privateEndpoints: enablePrivateEndpoint ? [
      {
        name: 'pe-kv-${keyVaultName}'
        subnetResourceId: dataSubnetId
        privateDnsZoneGroup: {
          privateDnsZoneGroupConfigs: [
            {
              privateDnsZoneResourceId: kvPrivateDnsZoneId
            }
          ]
        }
      }
    ] : []

    // RBAC: grant shared managed identity Key Vault Secrets User role (read-only on secrets)
    // Additional service-specific roles (Secrets Officer, Crypto Officer) added per module.
    roleAssignments: [
      {
        principalId: identityPrincipalId
        roleDefinitionIdOrName: 'Key Vault Secrets User'
        principalType: 'ServicePrincipal'
      }
    ]

    // POL-022: Diagnostic settings — all logs and metrics to central Log Analytics workspace
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
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
      }
    ]

    tags: tags
  }
}

resource appGatewayCertificate 'Microsoft.KeyVault/vaults/certificates@2023-07-01' = {
  name: '${keyVaultName}/${appGatewayCertificateName}'
  tags: tags
  properties: {
    attributes: {
      enabled: true
    }
    certificatePolicy: {
      issuerParameters: {
        name: 'Self'
      }
      keyProperties: {
        exportable: true
        keySize: 2048
        keyType: 'RSA'
        reuseKey: true
      }
      secretProperties: {
        contentType: 'application/x-pkcs12'
      }
      x509CertificateProperties: {
        subject: appGatewayCertificateSubject
        validityInMonths: 12
        ekus: [
          '1.3.6.1.5.5.7.3.1'
        ]
        keyUsage: [
          'digitalSignature'
          'keyEncipherment'
        ]
      }
      lifetimeActions: [
        {
          trigger: {
            lifetimePercentage: 80
          }
          action: {
            actionType: 'AutoRenew'
          }
        }
      ]
    }
  }
  dependsOn: [
    keyVault
  ]
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Key Vault resource ID.')
output keyVaultId string = keyVault.outputs.resourceId

@description('Key Vault name.')
output keyVaultName string = keyVault.outputs.name

@description('Key Vault URI for secret references (e.g. @Microsoft.KeyVault(SecretUri=...)).')
output keyVaultUri string = keyVault.outputs.uri

@description('Versionless Key Vault secret identifier for the bootstrap Application Gateway certificate.')
output appGatewayCertificateSecretId string = '${keyVault.outputs.uri}secrets/${appGatewayCertificateName}/'
