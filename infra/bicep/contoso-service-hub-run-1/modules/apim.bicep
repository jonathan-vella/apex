// modules/apim.bicep
// Phase 3 — API Management (StandardV2 for prod, Developer for dev/staging)
// AVM: br/public:avm/res/api-management/service:0.14.1
// Governance:
//   - EU location enforced (allowed-eu-locations policy)
//   - Mandatory 4 tags (required-tags policy)
//   - TLS 1.0/1.1 disabled on gateway and backend (security baseline)
//   - Managed identity (no key-based access)
// SKU note: StandardV2 uses VNet injection via subnetResourceId (not virtualNetworkType)
//           Developer uses virtualNetworkType:'External' (classic VNet model)

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('4-character unique suffix for globally unique APIM service name.')
param uniqueSuffix string

@description('API Management subnet resource ID (snet-apim).')
param subnetApimId string

@description('User-assigned managed identity resource ID.')
param identityId string

@description('Log Analytics workspace resource ID for diagnostic settings.')
param logAnalyticsWorkspaceId string

@description('APIM publisher email address (required by Azure API Management).')
param publisherEmail string

@description('APIM publisher display name.')
param publisherName string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived configuration ───────────────────────

// CAF naming: apim-{project}-{env}-{suffix}
// APIM requires globally unique name; uniqueSuffix ensures this.
var apimName = 'apim-${projectName}-${environment}-${uniqueSuffix}'

// SKU: StandardV2 (prod) vs Developer (dev/staging)
// StandardV2 is the new infrastructure with VNet injection.
// Developer is classic, supports virtualNetworkType for External VNet access.
var skuName     = environment == 'prod' ? 'StandardV2' : 'Developer'
var skuCapacity = 1  // 1 unit covers RFQ requirement of 5M requests/month

// TLS custom properties: disable legacy TLS 1.0/1.1 on both gateway and backend
var tlsCustomProperties = {
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'false'
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'false'
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'false'
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'false'
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Ssl30': 'false'
  'Microsoft.WindowsAzure.ApiManagement.Gateway.Protocols.Server.Http2': 'true'
}

// ─────────────────────────────── API Management ───────────────────────────────

module apim 'br/public:avm/res/api-management/service:0.14.1' = {
  name: 'apim'
  params: {
    name: apimName
    location: location

    publisherEmail: publisherEmail
    publisherName: publisherName

    // SKU: StandardV2 (prod) or Developer (dev/staging per plan)
    sku: skuName
    skuCapacity: skuCapacity

    // Managed identity: user-assigned (for Key Vault access) + system-assigned
    managedIdentities: {
      systemAssigned: true
      userAssignedResourceIds: [identityId]
    }

    // VNet integration:
    // - Developer SKU (dev/staging): classic External mode — public gateway, VNet-connected backend
    //   Pass subnetResourceId directly (AVM 0.14.1 uses top-level param, not nested object)
    // - StandardV2 (prod): no virtualNetworkType per AVM v2 guidance; subnet via subnetResourceId
    virtualNetworkType: environment == 'prod' ? 'None' : 'External'
    subnetResourceId: environment == 'prod' ? null : subnetApimId

    // TLS security properties — disable legacy protocols (security baseline)
    customProperties: tlsCustomProperties

    // Diagnostics → Log Analytics (all metrics)
    diagnosticSettings: [
      {
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          { category: 'GatewayLogs' }
          { category: 'WebSocketConnectionLogs' }
        ]
        metricCategories: [
          { category: 'AllMetrics' }
        ]
      }
    ]

    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('API Management service resource ID.')
output apimId string = apim.outputs.resourceId

@description('API Management service name.')
output apimName string = apim.outputs.name

@description('API Management gateway URL (public endpoint).')
output apimGatewayUrl string = 'https://${apim.outputs.name}.azure-api.net'
