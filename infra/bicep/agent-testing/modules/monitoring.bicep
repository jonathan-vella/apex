// ============================================================================
// Monitoring Module - Log Analytics & Application Insights
// ============================================================================
// Purpose: Centralized monitoring infrastructure
// AVM Modules:
//   - operational-insights/workspace v0.15.0
//   - insights/component v0.7.1
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

// =============================================================================
// VARIABLES
// =============================================================================

// Resource naming following CAF pattern
var logAnalyticsName = 'log-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'
var appInsightsName = 'appi-${projectName}-${environment}-${locationAbbr}-${take(uniqueSuffix, 6)}'

// =============================================================================
// RESOURCES
// =============================================================================

// -----------------------------------------------------------------------------
// Log Analytics Workspace
// AVM: avm/res/operational-insights/workspace v0.15.0
// -----------------------------------------------------------------------------

module logAnalyticsWorkspace 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  name: 'log-analytics-workspace'
  params: {
    name: logAnalyticsName
    location: location
    tags: tags

    // Retention and quota settings
    skuName: 'PerGB2018'
    dataRetention: 30 // 30 days for dev environment
    dailyQuotaGb: '1' // string type (1 GB daily limit for dev)

    // Managed identity for secure access
    managedIdentities: {
      systemAssigned: true
    }
  }
}

// -----------------------------------------------------------------------------
// Application Insights
// AVM: avm/res/insights/component v0.7.1
// Requires: Log Analytics Workspace
// -----------------------------------------------------------------------------

module applicationInsights 'br/public:avm/res/insights/component:0.7.1' = {
  name: 'application-insights'
  params: {
    name: appInsightsName
    location: location
    tags: tags

    // Link to Log Analytics workspace (required)
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId

    // Application type
    applicationType: 'web'

    // Retention settings
    retentionInDays: 30 // 30 days for dev environment
  }
}

// =============================================================================
// OUTPUTS
// =============================================================================

@description('Log Analytics Workspace Resource ID')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.outputs.resourceId

@description('Log Analytics Workspace Name')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.outputs.name

@description('Log Analytics Workspace Customer ID (for diagnostics)')
output logAnalyticsWorkspaceCustomerId string = logAnalyticsWorkspace.outputs.logAnalyticsWorkspaceId

@description('Application Insights Resource ID')
output applicationInsightsId string = applicationInsights.outputs.resourceId

@description('Application Insights Name')
output applicationInsightsName string = applicationInsights.outputs.name

@description('Application Insights Connection String')
output applicationInsightsConnectionString string = applicationInsights.outputs.connectionString

@description('Application Insights Instrumentation Key')
output applicationInsightsInstrumentationKey string = applicationInsights.outputs.instrumentationKey
