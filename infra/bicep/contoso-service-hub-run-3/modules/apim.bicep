@description('Azure region for the API Management deployment.')
param location string

@description('Common resource tags applied to API Management resources.')
param tags object

@description('API Management service name.')
param apimName string

@description('Publisher name required by API Management.')
param publisherName string

@description('Publisher email required by API Management.')
param publisherEmail string

@description('Key Vault resource ID used for APIM secret access role assignment.')
param keyVaultResourceId string

@description('Log Analytics workspace resource ID used for APIM diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Application Insights resource ID used for APIM logger integration.')
param applicationInsightsResourceId string

@description('Subnet resource ID used for API Management internal VNet deployment.')
param apimSubnetResourceId string

var lockDownPolicyXml = '''
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

module apim 'br/public:avm/res/api-management/service:0.14.1' = {
  params: {
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
    }
    diagnosticSettings: [
      {
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
        workspaceResourceId: logAnalyticsWorkspaceResourceId
      }
    ]
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    minApiVersion: '2021-08-01'
    name: apimName
    publicNetworkAccess: 'Disabled'
    publisherEmail: publisherEmail
    publisherName: publisherName
    sku: 'Standard'
    skuCapacity: 1
    subnetResourceId: apimSubnetResourceId
    tags: tags
    virtualNetworkType: 'Internal'
  }
}

resource apimService 'Microsoft.ApiManagement/service@2024-05-01' existing = {
  name: apimName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: last(split(keyVaultResourceId, '/'))
}

resource appInsightsLogger 'Microsoft.ApiManagement/service/loggers@2024-05-01' = {
  parent: apimService
  name: 'appinsights'
  dependsOn: [
    apim
  ]
  properties: {
    description: 'Application Insights logger for APIM gateway telemetry.'
    isBuffered: true
    loggerType: 'applicationInsights'
    resourceId: applicationInsightsResourceId
  }
}

resource gatewayPolicy 'Microsoft.ApiManagement/service/policies@2024-05-01' = {
  parent: apimService
  name: 'policy'
  dependsOn: [
    apim
  ]
  properties: {
    format: 'rawxml'
    value: lockDownPolicyXml
  }
}

resource apimKeyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apimName, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    principalId: apim.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
  }
}

@description('API Management service resource ID.')
output apimId string = apim.outputs.resourceId

@description('API Management service name.')
output apimNameOut string = apim.outputs.name

@description('API Management gateway URL.')
output apimGatewayUrl string = apimService.properties.gatewayUrl

@description('API Management gateway host name.')
output apimGatewayHostName string = split(replace(apimService.properties.gatewayUrl, 'https://', ''), '/')[0]

@description('API Management private IP address when internal mode is enabled.')
output apimPrivateIpAddress string = !empty(apimService.properties.privateIPAddresses) ? apimService.properties.privateIPAddresses[0] : ''

@description('API Management system-assigned managed identity principal ID.')
output apimPrincipalId string = apim.outputs.?systemAssignedMIPrincipalId ?? ''
