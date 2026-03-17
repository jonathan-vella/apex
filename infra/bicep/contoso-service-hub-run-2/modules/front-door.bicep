targetScope = 'resourceGroup'

param location string
param resourceLocation string // Actual Azure region for Private Link targets (e.g., swedencentral)
param tags object
param profileName string
param endpointName string
param originGroupName string
param originName string
param routeName string
param securityPolicyName string
param wafPolicyName string
param apiHostname string
param apiManagementResourceId string
param healthProbePath string
param customDomainHostName string
param logAnalyticsWorkspaceResourceId string

var enableCustomDomain = !empty(customDomainHostName)
var customDomainName = enableCustomDomain ? replace(replace(customDomainHostName, '.', '-'), '*', 'wildcard') : ''
var endpointId = resourceId('Microsoft.Cdn/profiles/afdEndpoints', profileName, endpointName)
var customDomainId = enableCustomDomain ? resourceId('Microsoft.Cdn/profiles/customDomains', profileName, customDomainName) : ''

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
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.1'
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
            customDomainNames: enableCustomDomain ? [
              customDomainName
            ] : []
            enabledState: 'Enabled'
            forwardingProtocol: 'HttpsOnly'
            httpsRedirect: 'Enabled'
            linkToDefaultDomain: 'Enabled'
            name: routeName
            originGroupName: originGroupName
            patternsToMatch: [
              '/api/*'
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
              requestMessage: 'Approve Azure Front Door Premium as a private origin.'
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
        name: securityPolicyName
        wafPolicyResourceId: wafPolicy.id
      }
    ]
    sku: 'Premium_AzureFrontDoor'
    tags: tags
  }
}

output frontDoorId string = frontDoor.outputs.resourceId
output frontDoorProfileName string = frontDoor.outputs.name
output frontDoorEndpointHostName string = !empty(frontDoor.outputs.frontDoorEndpointHostNames) ? frontDoor.outputs.frontDoorEndpointHostNames[0] : ''
