// ============================================================================
// Service Bus Module (Scenario 3: Microservices)
// ============================================================================
// Purpose: Message queue for microservices testing
// AVM Reference: br/public:avm/res/service-bus/namespace
// ============================================================================

@description('Name of the Service Bus Namespace')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('SKU for Service Bus')
@allowed(['Basic', 'Standard', 'Premium'])
param skuName string = 'Basic'

@description('Queue names to create')
param queueNames array = ['test-queue']

// ============================================================================
// Service Bus Namespace Resource
// ============================================================================

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    minimumTlsVersion: '1.2' // Security requirement
    publicNetworkAccess: 'Enabled' // Test resources use public access
    disableLocalAuth: false // Allow connection string auth for testing
  }
}

// ============================================================================
// Queues
// ============================================================================

resource queues 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = [for queueName in queueNames: {
  parent: serviceBusNamespace
  name: queueName
  properties: {
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P1D' // 1 day TTL for test messages
    lockDuration: 'PT1M' // 1 minute lock
    enablePartitioning: false
    enableBatchedOperations: true
  }
}]

// ============================================================================
// Outputs
// ============================================================================

@description('Service Bus endpoint')
output serviceBusEndpoint string = serviceBusNamespace.properties.serviceBusEndpoint

@description('Service Bus resource ID')
output resourceId string = serviceBusNamespace.id

@description('Service Bus Namespace name')
output name string = serviceBusNamespace.name

// Note: Connection string should be retrieved via Key Vault reference or managed identity
// Outputting connection strings is not recommended for security reasons
