// modules/monitoring.bicep — Centralised observability stack
// AVM: br/public:avm/res/operational-insights/workspace:0.9.1
//      br/public:avm/res/insights/component:0.4.1
// Resources: Log Analytics Workspace + 3× Application Insights (frontend, backend, platform)
// Governance: POL-022 (diagnostic settings), POL-023 (workspace-based App Insights),
//             POL-024 (retention baseline — 90d min for prod, 60d staging, 30d dev)

@description('Azure region for all resources (must be swedencentral, POL-001).')
param location string

@description('Deployment environment controlling retention and sizing.')
@allowed(['dev', 'staging', 'prod'])
param env string

@description('Log Analytics Workspace name.')
param workspaceName string

@description('Application Insights name for the frontend tier.')
param appInsightsFrontendName string

@description('Application Insights name for the backend tier.')
param appInsightsBackendName string

@description('Application Insights name for the platform/infrastructure tier.')
param appInsightsPlatformName string

@description('Resource tags applied to all resources in this module (POL-002).')
param tags object

// ─────────────────────────── Environment-specific settings ───────────────────
// POL-024: Monitoring retention baseline.
// prod/staging minimum 90d recommended; dev uses 30d as acceptable for non-regulated environments.
// Values below 90d will be flagged by POL-024 (Audit effect — does not block deployment).

var retentionDays = env == 'prod' ? 90 : env == 'staging' ? 60 : 30

// ─────────────────────────── Log Analytics Workspace ─────────────────────────
// PerGB2018 pricing tier — pay per GB ingested; no commitment tier required at this scale.
// All Application Insights instances connect here (POL-023: workspace-based App Insights).

module logAnalyticsWorkspace 'br/public:avm/res/operational-insights/workspace:0.9.1' = {
  name: 'log-analytics-workspace'
  params: {
    name: workspaceName
    location: location
    skuName: 'PerGB2018'
    dataRetention: retentionDays
    tags: tags
  }
}

// ─────────────────────── Application Insights — Frontend ─────────────────────
// Workspace-based (required by POL-023). Connection string used — not instrumentation key
// per security baseline (APPINSIGHTS_INSTRUMENTATIONKEY is deprecated).

module appInsightsFrontend 'br/public:avm/res/insights/component:0.4.1' = {
  name: 'app-insights-frontend'
  params: {
    name: appInsightsFrontendName
    location: location
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
    kind: 'web'
    applicationType: 'web'
    tags: tags
  }
}

// ─────────────────────── Application Insights — Backend ──────────────────────

module appInsightsBackend 'br/public:avm/res/insights/component:0.4.1' = {
  name: 'app-insights-backend'
  params: {
    name: appInsightsBackendName
    location: location
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
    kind: 'web'
    applicationType: 'web'
    tags: tags
  }
}

// ─────────────────────── Application Insights — Platform ─────────────────────
// Used by infrastructure-level services: AKS, APIM, App Gateway, Budget alerts.

module appInsightsPlatform 'br/public:avm/res/insights/component:0.4.1' = {
  name: 'app-insights-platform'
  params: {
    name: appInsightsPlatformName
    location: location
    workspaceResourceId: logAnalyticsWorkspace.outputs.resourceId
    kind: 'web'
    applicationType: 'web'
    tags: tags
  }
}

// ─────────────────────────────────── Outputs ─────────────────────────────────

@description('Log Analytics Workspace resource ID.')
output workspaceId string = logAnalyticsWorkspace.outputs.resourceId

@description('Log Analytics Workspace name.')
output workspaceName string = logAnalyticsWorkspace.outputs.name

@description('Application Insights — Frontend — resource ID.')
output appInsightsFrontendId string = appInsightsFrontend.outputs.resourceId

@description('Application Insights — Frontend — connection string (use CONNECTION_STRING env var).')
output appInsightsFrontendConnectionString string = appInsightsFrontend.outputs.connectionString

@description('Application Insights — Backend — resource ID.')
output appInsightsBackendId string = appInsightsBackend.outputs.resourceId

@description('Application Insights — Backend — connection string.')
output appInsightsBackendConnectionString string = appInsightsBackend.outputs.connectionString

@description('Application Insights — Platform — resource ID.')
output appInsightsPlatformId string = appInsightsPlatform.outputs.resourceId

@description('Application Insights — Platform — connection string.')
output appInsightsPlatformConnectionString string = appInsightsPlatform.outputs.connectionString
