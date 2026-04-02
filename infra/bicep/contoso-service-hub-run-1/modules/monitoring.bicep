// modules/monitoring.bicep
// Phase 1 — Centralised observability: Log Analytics Workspace + Application Insights
// AVM: br/public:avm/res/operational-insights/workspace:0.15.0
//      br/public:avm/res/insights/component:0.7.1
// Governance: EU location, mandatory tags

@description('Azure region for all resources.')
param location string

@description('Environment name (dev | staging | prod).')
param environment string

@description('Project short name for CAF naming.')
param projectName string

@description('Resource tags applied to all resources in this module.')
param tags object

// ─────────────────────────────── Derived names ───────────────────────────────

var workspaceName     = 'log-${projectName}-${environment}'
var appInsightsName   = 'appi-${projectName}-${environment}'

// ──────────────────────────── Log Analytics Workspace ────────────────────────
// Daily quota cap is not set here — AVM 0.15.0 uses string type which conflicts
// with int literals. Cost control is enforced by the budget module alerts.

module logAnalyticsWorkspace 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  name: 'log-analytics-workspace'
  params: {
    name: workspaceName
    location: location
    skuName: 'PerGB2018'
    dataRetention: 90
    tags: tags
  }
}

// ─────────────────────────────── Application Insights ────────────────────────

module applicationInsights 'br/public:avm/res/insights/component:0.7.1' = {
  name: 'application-insights'
  params: {
    name: appInsightsName
    location: location
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
    kind: 'web'
    applicationType: 'web'
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Log Analytics workspace resource ID.')
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.outputs.resourceId

@description('Log Analytics workspace name.')
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.outputs.name

@description('Application Insights resource ID.')
output applicationInsightsId string = applicationInsights.outputs.resourceId

@description('Application Insights connection string (preferred over instrumentation key).')
output applicationInsightsConnectionString string = applicationInsights.outputs.connectionString
