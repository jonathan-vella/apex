// ============================================================================
// Static Web App Module - e2e-conductor-test
// ============================================================================
// Purpose: Deploy Azure Static Web App (Free tier)
// AVM Module: avm/res/web/static-site:0.9.3
// ============================================================================

// ============================================================================
// Parameters
// ============================================================================

@description('Static Web App name')
param staticWebAppName string

@description('Azure region for deployment')
param location string

@description('Required tags for governance compliance')
param tags object

// ============================================================================
// Static Web App Deployment (AVM)
// ============================================================================

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  name: 'stapp-deployment'
  params: {
    name: staticWebAppName
    location: location
    sku: 'Free'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    tags: tags
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Static Web App name')
output staticWebAppName string = staticWebApp.outputs.name

@description('Static Web App default hostname')
output defaultHostname string = staticWebApp.outputs.defaultHostname

@description('Static Web App resource ID')
output resourceId string = staticWebApp.outputs.resourceId
