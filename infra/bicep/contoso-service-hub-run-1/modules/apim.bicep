targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('API Management service name.')
param apimName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Publisher name for API Management.')
param publisherName string

@description('Publisher email for API Management.')
param publisherEmail string

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('Application Insights resource ID used for APIM logger integration.')
param applicationInsightsResourceId string

@description('Subnet resource ID used for APIM VNet injection.')
param apimSubnetResourceId string

@description('Subnet resource ID used for APIM private endpoint deployment.')
param privateEndpointSubnetResourceId string

@description('Expected X-Azure-FDID value for origin lockdown. When empty, the policy enforces header presence only.')
param expectedFrontDoorId string = ''

var apimSku = environment == 'prod' ? 'PremiumV2' : environment == 'staging' ? 'StandardV2' : 'Developer'
var apimSkuCapacity = 1
var useInternalVnet = environment != 'dev'
var useZoneRedundancy = environment == 'prod'
var publicNetworkAccess = environment == 'dev' ? 'Enabled' : 'Disabled'
var availabilityZones = useZoneRedundancy ? [1, 2, 3] : []
var lockDownPolicyXml = empty(expectedFrontDoorId)
  ? '''
<policies>
  <inbound>
    <base />
    <choose>
      <when condition="@(context.Request.Headers.ContainsKey(&quot;X-Azure-FDID&quot;) &amp;&amp; !string.IsNullOrEmpty(context.Request.Headers.GetValueOrDefault(&quot;X-Azure-FDID&quot;, &quot;&quot;)))">
        <base />
      </when>
      <otherwise>
        <return-response>
          <set-status code="403" reason="Forbidden" />
          <set-body>Direct access denied. Requests must arrive through Azure Front Door.</set-body>
        </return-response>
      </otherwise>
    </choose>
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
  : '''
<policies>
  <inbound>
    <base />
    <check-header name="X-Azure-FDID" failed-check-httpcode="403" failed-check-error-message="Direct access denied. Requests must arrive through Azure Front Door." ignore-case="false">
      <value>${expectedFrontDoorId}</value>
    </check-header>
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
    availabilityZones: availabilityZones
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
    privateEndpoints: [
      {
        name: 'pep-${apimName}-management'
        privateLinkServiceConnectionName: 'plsc-${apimName}-management'
        service: 'management'
        subnetResourceId: privateEndpointSubnetResourceId
        tags: tags
      }
    ]
    publicNetworkAccess: publicNetworkAccess
    publisherEmail: publisherEmail
    publisherName: publisherName
    sku: apimSku
    skuCapacity: apimSkuCapacity
    subnetResourceId: useInternalVnet ? apimSubnetResourceId : null
    tags: tags
    virtualNetworkType: useInternalVnet ? 'Internal' : 'None'
  }
}

resource apimService 'Microsoft.ApiManagement/service@2024-05-01' existing = {
  name: apimName
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
