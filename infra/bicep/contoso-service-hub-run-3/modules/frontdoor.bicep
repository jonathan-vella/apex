@description('Resource tags applied to the Azure Front Door profile and WAF policy.')
param tags object

@description('Azure Front Door profile name.')
param profileName string

@description('Azure Front Door endpoint name.')
param endpointName string

@description('Origin group name used for API Management.')
param originGroupName string

@description('Origin name used for API Management.')
param originName string

@description('Route name for the API path.')
param routeName string

@description('API Management gateway host name used as the Front Door origin.')
param apiHostname string

@description('Health probe path used by the Front Door origin group.')
param healthProbePath string

@description('Log Analytics workspace resource ID used for Front Door diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

module frontDoor 'br/public:avm/res/cdn/profile:0.19.0' = {
  params: {
    afdEndpoints: [
      {
        enabledState: 'Enabled'
        name: endpointName
        routes: [
          {
            enabledState: 'Enabled'
            forwardingProtocol: 'HttpsOnly'
            httpsRedirect: 'Enabled'
            linkToDefaultDomain: 'Enabled'
            name: routeName
            originGroupName: originGroupName
            patternsToMatch: [
              '/*'
            ]
            supportedProtocols: [
              'Http'
              'Https'
            ]
          }
        ]
      }
    ]
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
    location: 'global'
    name: profileName
    originGroups: [
      {
        healthProbeSettings: {
          probeIntervalInSeconds: 30
          probePath: healthProbePath
          probeProtocol: 'Https'
          probeRequestType: 'GET'
        }
        loadBalancingSettings: {
          additionalLatencyInMilliseconds: 0
          sampleSize: 4
          successfulSamplesRequired: 3
        }
        name: originGroupName
        origins: [
          {
            enabledState: 'Enabled'
            enforceCertificateNameCheck: true
            hostName: apiHostname
            httpPort: 80
            httpsPort: 443
            name: originName
            originHostHeader: apiHostname
            priority: 1
            weight: 1000
          }
        ]
        sessionAffinityState: 'Disabled'
      }
    ]
    originResponseTimeoutSeconds: 60
    sku: 'Premium_AzureFrontDoor'
    tags: tags
  }
}

@description('Azure Front Door profile resource ID.')
output frontDoorId string = frontDoor.outputs.resourceId

@description('Azure Front Door profile name.')
output frontDoorProfileName string = frontDoor.outputs.name

@description('Azure Front Door endpoint host name.')
output frontDoorEndpointHostName string = !empty(frontDoor.outputs.frontDoorEndpointHostNames) ? frontDoor.outputs.frontDoorEndpointHostNames[0] : ''
