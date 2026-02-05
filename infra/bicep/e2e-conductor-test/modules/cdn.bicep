// ============================================================================
// CDN Module - e2e-conductor-test
// ============================================================================
// Purpose: Deploy CDN Profile and Endpoint
// AVM Module: avm/res/cdn/profile:0.17.1
// ============================================================================

// ============================================================================
// Parameters
// ============================================================================

@description('CDN Profile name')
param cdnProfileName string

@description('CDN Endpoint name (must be globally unique)')
param cdnEndpointName string

@description('Static Web App hostname to use as origin')
param staticWebAppHostname string

@description('Required tags for governance compliance')
param tags object

// ============================================================================
// CDN Profile Deployment (AVM)
// ============================================================================

module cdnProfile 'br/public:avm/res/cdn/profile:0.17.1' = {
  name: 'cdn-deployment'
  params: {
    name: cdnProfileName
    location: 'global'
    sku: 'Standard_Microsoft'
    endpoint: {
      name: cdnEndpointName
      properties: {
        originHostHeader: staticWebAppHostname
        contentTypesToCompress: [
          'text/html'
          'text/css'
          'application/javascript'
          'application/json'
          'image/svg+xml'
        ]
        isCompressionEnabled: true
        isHttpAllowed: false
        isHttpsAllowed: true
        queryStringCachingBehavior: 'IgnoreQueryString'
        optimizationType: 'GeneralWebDelivery'
        origins: [
          {
            name: 'stapp-origin'
            properties: {
              hostName: staticWebAppHostname
              httpsPort: 443
              originHostHeader: staticWebAppHostname
              priority: 1
              weight: 1000
              enabled: true
            }
          }
        ]
      }
    }
    tags: tags
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('CDN Profile name')
output cdnProfileName string = cdnProfile.outputs.name

@description('CDN Profile resource ID')
output cdnProfileId string = cdnProfile.outputs.resourceId

@description('CDN endpoint hostname')
output cdnEndpointHostname string = '${cdnEndpointName}.azureedge.net'
