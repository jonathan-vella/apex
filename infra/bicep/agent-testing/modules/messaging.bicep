// ============================================================================
// Messaging Module - Service Bus Namespace
// ============================================================================
// Purpose: Message queuing for asynchronous communication
// AVM Module: service-bus/namespace v0.16.1
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for resource deployment')
param location string

@description('Location abbreviation for naming')
param locationAbbr string

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

// Service Bus namespace name (max 50 chars)
var serviceBusName = 'sb-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Service Bus Namespace
// AVM: avm/res/service-bus/namespace v0.16.1
// SKU: Basic tier for dev (cost-effective)
// PITFALL: Use skuObject, not flat skuName
// -----------------------------------------------------------------------------

module serviceBusNamespace 'br/public:avm/res/service-bus/namespace:0.16.1' = {
  name: 'service-bus-namespace'
  params: {
    name: serviceBusName
    location: location
    tags: tags

    // SKU configuration (CORRECT: use skuObject)
    skuObject: {
      name: 'Basic'
    }

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }

    // Public network access (enabled for dev)
    publicNetworkAccess: 'Enabled'

    // Minimum TLS version
    minimumTlsVersion: '1.2'

    // Disable local auth (use Azure AD/Managed Identity)
    disableLocalAuth: false // Enable for dev simplicity

    // Queues for testing
    queues: [
      {
        name: 'test-queue'
        maxSizeInMegabytes: 1024 // 1 GB
        lockDuration: 'PT1M' // 1 minute lock
        maxDeliveryCount: 10
        deadLetteringOnMessageExpiration: true
        enablePartitioning: false // Not available on Basic
      }
    ]

    // Diagnostic settings
    diagnosticSettings: [
      {
        name: 'diag-sb'
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          {
            category: 'OperationalLogs'
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

@description('Service Bus Namespace Resource ID')
output serviceBusNamespaceId string = serviceBusNamespace.outputs.resourceId

@description('Service Bus Namespace Name')
output serviceBusNamespaceName string = serviceBusNamespace.outputs.name

@description('Service Bus Namespace Service Bus Endpoint')
output serviceBusEndpoint string = 'https://${serviceBusName}.servicebus.windows.net'

@description('Service Bus Namespace System Assigned Identity Principal ID')
output serviceBusNamespacePrincipalId string = serviceBusNamespace.outputs.systemAssignedMIPrincipalId ?? ''
