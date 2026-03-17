@description('Resource tags applied to the Azure Front Door profile and WAF policy.')
param tags object

@description('Azure region of the private origin resources.')
param resourceLocation string

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

@description('Security policy name associated with the endpoint.')
param securityPolicyName string

@description('WAF policy name for the Azure Front Door profile.')
param wafPolicyName string

@description('API Management gateway host name used as the Front Door origin.')
param apiHostname string

@description('API Management resource ID used for shared private link origin access.')
param apiManagementResourceId string

@description('Health probe path used by the Front Door origin group.')
param healthProbePath string

@description('Log Analytics workspace resource ID used for Front Door diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

var endpointId = resourceId('Microsoft.Cdn/profiles/afdEndpoints', profileName, endpointName)

resource wafPolicy 'Microsoft.Network/frontDoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: wafPolicyName
  location: 'global'
  tags: tags
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
        }
      ]
    }
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
    }
  }
}

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
            sharedPrivateLinkResource: {
              groupId: 'gateway'
              privateLink: {
                id: apiManagementResourceId
              }
              privateLinkLocation: resourceLocation
              requestMessage: 'Approve Azure Front Door Premium as the only public ingress for API Management.'
            }
            weight: 1000
          }
        ]
        sessionAffinityState: 'Disabled'
      }
    ]
    originResponseTimeoutSeconds: 60
    securityPolicies: [
      {
        associations: [
          {
            domains: [
              {
                id: endpointId
              }
            ]
            patternsToMatch: [
              '/*'
            ]
          }
        ]
        name: securityPolicyName
        wafPolicyResourceId: wafPolicy.id
      }
    ]
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
