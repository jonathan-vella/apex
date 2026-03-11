targetScope = 'resourceGroup'

// ──────────────────────────────────────────────
// Monitoring Module — Log Analytics + Application Insights
// ──────────────────────────────────────────────

@description('Project name for resource naming')
param projectName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Deployment environment')
@allowed(['dev', 'prod'])
param environment string

// ──────────────────────────────────────────────
// Log Analytics Workspace (AVM)
// ──────────────────────────────────────────────

var dailyQuotaGb = environment == 'prod' ? '2' : '1'

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  name: 'log-${projectName}-${environment}'
  params: {
    name: 'log-${projectName}-${environment}'
    location: location
    tags: tags
    skuName: 'PerGB2018'
    dataRetention: 30
    dailyQuotaGb: dailyQuotaGb
  }
}

// ──────────────────────────────────────────────
// Application Insights (AVM)
// ──────────────────────────────────────────────

module appInsights 'br/public:avm/res/insights/component:0.7.1' = {
  name: 'appi-${projectName}-${environment}'
  params: {
    name: 'appi-${projectName}-${environment}'
    location: location
    tags: tags
    workspaceResourceId: logAnalytics.outputs.resourceId
    kind: 'web'
    applicationType: 'web'
    samplingPercentage: environment == 'prod' ? 50 : 100
  }
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────

@description('Log Analytics workspace resource ID')
output logAnalyticsWorkspaceResourceId string = logAnalytics.outputs.resourceId

@description('Log Analytics workspace name')
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.outputs.connectionString

@description('Application Insights resource ID')
output appInsightsResourceId string = appInsights.outputs.resourceId
