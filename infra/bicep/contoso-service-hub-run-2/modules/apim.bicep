targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param apiManagementName string
param skuName string
param publisherName string
param publisherEmail string
param logAnalyticsWorkspaceResourceId string
param applicationInsightsResourceId string
param managedIdentityResourceId string
param privateEndpointSubnetResourceId string
param apimPrivateEndpointName string

var publicNetworkAccess = environment == 'dev' ? 'Enabled' : 'Disabled'

resource apiManagement 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: apiManagementName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
    }
    publicNetworkAccess: publicNetworkAccess
    publisherEmail: publisherEmail
    publisherName: publisherName
    // Standard v2 uses virtualNetworkIntegration (not classic virtualNetworkConfiguration)
    virtualNetworkType: 'None'
  }
  sku: {
    capacity: 1
    name: skuName
  }
  tags: tags
}

resource apiManagementDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${apiManagementName}-diagnostics'
  scope: apiManagement
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: logAnalyticsWorkspaceResourceId
  }
}

resource appInsightsLogger 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
  parent: apiManagement
  name: 'appinsights'
  properties: {
    description: 'Application Insights logger for gateway diagnostics.'
    isBuffered: true
    loggerType: 'applicationInsights'
    resourceId: applicationInsightsResourceId
  }
}

resource gatewayPolicy 'Microsoft.ApiManagement/service/policies@2024-05-01' = {
  parent: apiManagement
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: '''
<policies>
  <inbound>
    <base />
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
'''
  }
}

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = if (environment != 'dev') {
  name: apimPrivateEndpointName
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: 'plsc-${apiManagementName}-gateway'
        properties: {
          groupIds: [
            'gateway'
          ]
          privateLinkServiceId: apiManagement.id
          requestMessage: 'Azure Front Door private origin access.'
        }
      }
    ]
    subnet: {
      id: privateEndpointSubnetResourceId
    }
  }
}

output apimId string = apiManagement.id
output apimName string = apiManagement.name
output apimGatewayUrl string = 'https://${apiManagement.name}.azure-api.net'
output apimGatewayHostName string = '${apiManagement.name}.azure-api.net'
output apimPrivateEndpointId string = environment != 'dev' ? privateEndpoint.id : ''
