targetScope = 'resourceGroup'

@description('Azure Front Door profile name.')
param frontDoorProfileName string

@description('Azure Front Door endpoint name.')
param frontDoorEndpointName string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace resource ID used for diagnostic settings.')
param logAnalyticsWorkspaceResourceId string

@description('APIM gateway host name used as the Front Door origin.')
param apimGatewayHostName string

@description('Optional custom domain host name for Front Door.')
param customDomainHostName string = ''

var enableCustomDomain = !empty(customDomainHostName)
var customDomainName = enableCustomDomain ? replace(replace(customDomainHostName, '.', '-'), '*', 'wildcard') : ''
var endpointId = resourceId('Microsoft.Cdn/profiles/afdEndpoints', frontDoorProfileName, frontDoorEndpointName)
var customDomainId = enableCustomDomain ? resourceId('Microsoft.Cdn/profiles/customDomains', frontDoorProfileName, customDomainName) : ''

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2025-10-01' = {
  name: 'waf-${frontDoorProfileName}'
  location: 'global'
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  tags: tags
  properties: {
    customRules: {
      rules: [
        {
          action: 'Block'
          enabledState: 'Enabled'
          groupBy: [
            {
              variableName: 'SocketAddr'
            }
          ]
          matchConditions: [
            {
              matchValue: [
                '*'
              ]
              matchVariable: 'RequestUri'
              operator: 'Any'
            }
          ]
          name: 'RateLimitAllRequests'
          priority: 100
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 1200
          ruleType: 'RateLimitRule'
        }
      ]
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetAction: 'Block'
          ruleSetType: 'OWASP'
          ruleSetVersion: '3.2'
        }
      ]
    }
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
  }
}

module frontDoor 'br/public:avm/res/cdn/profile:0.19.0' = {
  params: {
    afdEndpoints: [
      {
        enabledState: 'Enabled'
        name: frontDoorEndpointName
        routes: [
          {
            customDomainNames: enableCustomDomain ? [
              customDomainName
            ] : []
            enabledState: 'Enabled'
            forwardingProtocol: 'HttpsOnly'
            httpsRedirect: 'Enabled'
            linkToDefaultDomain: 'Enabled'
            name: 'route-all'
            originGroupName: 'apim-origin-group'
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
    customDomains: enableCustomDomain ? [
      {
        certificateType: 'ManagedCertificate'
        hostName: customDomainHostName
        minimumTlsVersion: 'TLS12'
        name: customDomainName
      }
    ] : []
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
    name: frontDoorProfileName
    originGroups: [
      {
        healthProbeSettings: {
          probeIntervalInSeconds: 120
          probePath: '/status-0123456789abcdef'
          probeProtocol: 'Https'
          probeRequestType: 'HEAD'
        }
        loadBalancingSettings: {
          additionalLatencyInMilliseconds: 0
          sampleSize: 4
          successfulSamplesRequired: 3
        }
        name: 'apim-origin-group'
        origins: [
          {
            enabledState: 'Enabled'
            enforceCertificateNameCheck: true
            hostName: apimGatewayHostName
            httpPort: 80
            httpsPort: 443
            name: 'apim-origin'
            originHostHeader: apimGatewayHostName
            priority: 1
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
            domains: concat([
              {
                id: endpointId
              }
            ], enableCustomDomain ? [
              {
                id: customDomainId
              }
            ] : [])
            patternsToMatch: [
              '/*'
            ]
          }
        ]
        name: 'default-security-policy'
        wafPolicyResourceId: wafPolicy.id
      }
    ]
    sku: 'Premium_AzureFrontDoor'
    tags: tags
  }
}

@description('Front Door profile resource ID.')
output frontDoorId string = frontDoor.outputs.resourceId

@description('Front Door profile name.')
output frontDoorProfileNameOut string = frontDoor.outputs.name

@description('Front Door endpoint host name.')
output frontDoorEndpointHostName string = !empty(frontDoor.outputs.frontDoorEndpointHostNames) ? frontDoor.outputs.frontDoorEndpointHostNames[0] : ''

@description('Front Door endpoint URL.')
output frontDoorEndpoint string = !empty(frontDoor.outputs.frontDoorEndpointHostNames) ? 'https://${frontDoor.outputs.frontDoorEndpointHostNames[0]}' : ''

@description('Front Door WAF policy resource ID.')
output wafPolicyId string = wafPolicy.id
