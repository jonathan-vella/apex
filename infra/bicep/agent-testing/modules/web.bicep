// ============================================================================
// Web Module - Static Web App
// ============================================================================
// Purpose: Static website hosting for frontend applications
// AVM Module: web/static-site v0.9.3
// IMPORTANT: Region-limited - hardcoded to westeurope for EU compliance
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for Static Web App (limited regions)')
@allowed([
  'westus2'
  'centralus'
  'eastus2'
  'westeurope'
  'eastasia'
])
param location string = 'westeurope'

@description('Location abbreviation for naming')
param locationAbbr string

@description('Environment name')
param environment string

@description('Project name')
param projectName string

@description('Unique suffix for resource naming')
param uniqueSuffix string

@description('Tags for all resources')
param tags object

// =============================================================================
// VARIABLES
// =============================================================================

// Static Web App name
var staticWebAppName = 'stapp-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Static Web App
// AVM: avm/res/web/static-site v0.9.3
// SKU: Free tier for dev
// PITFALL: Only available in limited regions (westeurope for EU)
// -----------------------------------------------------------------------------

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  name: 'static-web-app'
  params: {
    name: staticWebAppName
    location: location // MUST be in allowed regions
    tags: tags

    // SKU (Standard - Free SKU not available via ARM)
    sku: 'Standard'

    // Staging environment policy
    stagingEnvironmentPolicy: 'Enabled'

    // Allow config file overrides
    allowConfigFileUpdates: true

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('Static Web App Resource ID')
output staticWebAppId string = staticWebApp.outputs.resourceId

@description('Static Web App Name')
output staticWebAppName string = staticWebApp.outputs.name

@description('Static Web App Default Hostname')
output staticWebAppHostname string = staticWebApp.outputs.defaultHostname

@description('Static Web App System Assigned Identity Principal ID')
output staticWebAppPrincipalId string = staticWebApp.outputs.systemAssignedMIPrincipalId ?? ''
