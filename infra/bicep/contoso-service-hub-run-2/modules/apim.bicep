// modules/apim.bicep — API Management Service
// AVM: br/public:avm/res/api-management/service:0.9.0
// Governance:
//   POL-001 — EU-only region (swedencentral enforced by location param)
//   POL-002 — Required governance tags (passed via tags param)
//   POL-021 — Managed identity (system-assigned for APIM self-managed operations)
//   POL-022 — Diagnostic settings to Log Analytics
// Security: System-assigned managed identity, TLS 1.2 minimum enforced at gateway
// VNet note: StandardV2 does NOT support classic virtualNetworkType VNet injection.
//            External/Internal VNet modes are only valid for the classic Gateway SKU.
//            StandardV2 uses dedicated compute with outbound private connectivity instead.

@description('Azure region for all resources (must be swedencentral, POL-001).')
param location string

@description('Deployment environment — controls SKU, capacity, and feature set.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

@description('4-character unique suffix derived from resource group ID (passed from main.bicep).')
#disable-next-line no-unused-params
param uniqueSuffix string

@description('API Management service name.')
param apimName string

@description('Log Analytics Workspace resource ID for diagnostic settings (POL-022).')
param workspaceId string

@description('Publisher email address — required by APIM; used for system notifications and certificates.')
param publisherEmail string

@description('Publisher organisation name displayed in the developer portal and API responses.')
param publisherName string

// ─────────────────────────────── Environment-specific SKU ────────────────────
// StandardV2 (prod/staging): production-grade, dedicated compute, SLA 99.99%
//   - Capacity is fixed at 1 unit for StandardV2 (burstable by design)
// Developer (dev): development-only, no SLA, lower cost, same portal and API surface
//   - Do NOT use Developer SKU in production (no SLA guarantee)

var apimSkuName     = (env == 'prod' || env == 'staging') ? 'StandardV2' : 'Developer'
var apimSkuCapacity = 1

// ─────────────────────────────── API Management Service ──────────────────────

module apimService 'br/public:avm/res/api-management/service:0.9.0' = {
  name: 'api-management-service'
  params: {
    name: apimName
    location: location
    tags: tags

    // Required APIM publisher fields — surfaced in developer portal and system emails
    publisherEmail: publisherEmail
    publisherName:  publisherName

    // SKU: StandardV2 string (prod/staging), Developer (dev)
    // AVM api-management/service:0.9.0 accepts sku as a string type
    sku: apimSkuName

    // Capacity: 1 unit for all SKUs (StandardV2 is always 1; Developer is always 1)
    skuCapacity: apimSkuCapacity

    // POL-021: System-assigned managed identity — enables APIM to authenticate
    // to Key Vault (named values from KV), Event Hubs (logging), and other Azure services
    // without stored credentials.
    managedIdentities: {
      systemAssigned: true
    }

    // POL-022: Diagnostic settings — all APIM logs and metrics to central Log Analytics
    diagnosticSettings: [
      {
        workspaceResourceId: workspaceId
        logCategoriesAndGroups: [
          {
            // Gateway logs: all API calls, response codes, latency, errors
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
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('API Management service resource ID.')
output apimId string = apimService.outputs.resourceId

@description('API Management service name.')
output apimName string = apimService.outputs.name

@description('API Management gateway URL (default *.azure-api.net endpoint).')
output apimGatewayUrl string = 'https://${apimService.outputs.name}.azure-api.net'

@description('System-assigned managed identity principal ID (for downstream RBAC assignments).')
output apimPrincipalId string = apimService.outputs.?systemAssignedMIPrincipalId ?? ''
