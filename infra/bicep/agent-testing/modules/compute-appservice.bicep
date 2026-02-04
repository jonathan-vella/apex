// ============================================================================
// Compute App Service Module - App Service Plan & App Service
// ============================================================================
// Purpose: Web application hosting with App Service
// AVM Modules:
//   - web/serverfarm v0.6.0
//   - web/site v0.21.0
// ============================================================================

// =============================================================================
// PARAMETERS
// =============================================================================

@description('Azure region for resource deployment')
param location string

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

@description('Log Analytics Workspace ID for diagnostics')
param logAnalyticsWorkspaceId string

@description('Application Insights Connection String')
param applicationInsightsConnectionString string

// =============================================================================
// VARIABLES
// =============================================================================

// Resource naming following CAF pattern
var appServicePlanName = 'asp-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'
var appServiceName = 'app-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// App Service Plan
// AVM: avm/res/web/serverfarm v0.6.0
// SKU: B1 for dev (Basic tier - cost-effective for testing)
// -----------------------------------------------------------------------------

module appServicePlan 'br/public:avm/res/web/serverfarm:0.6.0' = {
  name: 'app-service-plan'
  params: {
    name: appServicePlanName
    location: location
    tags: tags

    // SKU configuration (B1 for dev - Basic tier)
    skuName: 'B1'
    skuCapacity: 1

    // Linux-based for modern workloads
    reserved: true // true = Linux, false = Windows

    // Zone redundancy (not available on B1, requires P1v3+)
    zoneRedundant: false

    // Diagnostic settings
    diagnosticSettings: [
      {
        name: 'diag-asp'
        workspaceResourceId: logAnalyticsWorkspaceId
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]
  }
}

// -----------------------------------------------------------------------------
// App Service
// AVM: avm/res/web/site v0.21.0
// Configuration: .NET 8 LTS runtime
// -----------------------------------------------------------------------------

module appService 'br/public:avm/res/web/site:0.21.0' = {
  name: 'app-service'
  params: {
    name: appServiceName
    location: location
    tags: tags

    // App type
    kind: 'app,linux'

    // Link to App Service Plan
    serverFarmResourceId: appServicePlan.outputs.resourceId

    // Managed identity
    managedIdentities: {
      systemAssigned: true
    }

    // Site configuration with app settings embedded
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: false // B1 tier doesn't support always on
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }

    // HTTPS only
    httpsOnly: true

    // Client certificate mode
    clientCertEnabled: false

    // Diagnostic settings
    diagnosticSettings: [
      {
        name: 'diag-app'
        workspaceResourceId: logAnalyticsWorkspaceId
        logCategoriesAndGroups: [
          {
            category: 'AppServiceHTTPLogs'
            enabled: true
          }
          {
            category: 'AppServiceConsoleLogs'
            enabled: true
          }
          {
            category: 'AppServiceAppLogs'
            enabled: true
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
      }
    ]
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('App Service Plan Resource ID')
output appServicePlanId string = appServicePlan.outputs.resourceId

@description('App Service Plan Name')
output appServicePlanName string = appServicePlan.outputs.name

@description('App Service Resource ID')
output appServiceId string = appService.outputs.resourceId

@description('App Service Name')
output appServiceName string = appService.outputs.name

@description('App Service Default Hostname')
output appServiceHostname string = appService.outputs.defaultHostname

@description('App Service System Assigned Identity Principal ID')
output appServicePrincipalId string = appService.outputs.systemAssignedMIPrincipalId ?? ''
