// ============================================================================
// Static Web App Module (Scenario 1: Smoke Tests)
// ============================================================================
// Purpose: Deploy Azure Static Web Apps for fast smoke testing
// AVM Reference: br/public:avm/res/web/static-site
// ============================================================================

@description('Name of the Static Web App')
param name string

@description('Azure region for deployment')
param location string

@description('Resource tags')
param tags object

@description('SKU tier for Static Web App')
@allowed(['Free', 'Standard'])
param sku string = 'Free'

@description('Allow config file to override default settings')
param allowConfigFileUpdates bool = true

// ============================================================================
// Static Web App Resource
// ============================================================================

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    allowConfigFileUpdates: allowConfigFileUpdates
    stagingEnvironmentPolicy: 'Enabled'
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Static Web App default hostname')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('Static Web App resource ID')
output resourceId string = staticWebApp.id

@description('Static Web App name')
output name string = staticWebApp.name
