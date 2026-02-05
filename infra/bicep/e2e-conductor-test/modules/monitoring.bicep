// ============================================================================
// Monitoring Module - e2e-conductor-test
// ============================================================================
// Purpose: Deploy Log Analytics, Action Group, and Metric Alert
// AVM Modules: 
//   - avm/res/operational-insights/workspace:0.15.0
//   - avm/res/insights/action-group:0.8.0
//   - avm/res/insights/metric-alert:0.4.1
// ============================================================================

// ============================================================================
// Parameters
// ============================================================================

@description('Log Analytics Workspace name')
param logAnalyticsName string

@description('Action Group name')
param actionGroupName string

@description('Metric Alert name')
param metricAlertName string

@description('Technical contact email for alerts')
param technicalContact string

@description('CDN Profile resource ID for metric alert scope')
param cdnProfileId string

@description('Enable CDN-specific alerts (set to false if CDN is disabled)')
param enableCdnAlerts bool = true

@description('Required tags for governance compliance')
param tags object

// ============================================================================
// Log Analytics Workspace Deployment (AVM)
// ============================================================================

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  name: 'log-deployment'
  params: {
    name: logAnalyticsName
    location: resourceGroup().location
    skuName: 'PerGB2018'
    dataRetention: 30
    dailyQuotaGb: '-1'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    tags: tags
  }
}

// ============================================================================
// Action Group Deployment (AVM)
// ============================================================================

module actionGroup 'br/public:avm/res/insights/action-group:0.8.0' = {
  name: 'ag-deployment'
  params: {
    name: actionGroupName
    groupShortName: take(actionGroupName, 12)
    enabled: true
    emailReceivers: [
      {
        name: 'TechContact'
        emailAddress: technicalContact
        useCommonAlertSchema: true
      }
    ]
    tags: tags
  }
}

// ============================================================================
// Metric Alert Deployment (AVM) - Conditional on CDN being enabled
// ============================================================================

module metricAlert 'br/public:avm/res/insights/metric-alert:0.4.1' = if (enableCdnAlerts) {
  name: 'alert-deployment'
  params: {
    name: metricAlertName
    alertDescription: 'Alert when CDN endpoint is unhealthy'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    autoMitigate: true
    scopes: [
      cdnProfileId
    ]
    targetResourceType: 'Microsoft.Cdn/profiles'
    targetResourceRegion: 'global'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allof: [
        {
          name: 'CDN Availability'
          metricName: 'Percentage4XX'
          metricNamespace: 'Microsoft.Cdn/profiles'
          operator: 'GreaterThan'
          threshold: 50
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.outputs.resourceId
      }
    ]
    tags: tags
  }
}

// ============================================================================
// Outputs
// ============================================================================

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.outputs.resourceId

@description('Log Analytics Workspace name')
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name

@description('Action Group resource ID')
output actionGroupId string = actionGroup.outputs.resourceId

@description('Metric Alert resource ID (empty if CDN alerts disabled)')
output metricAlertId string = enableCdnAlerts ? metricAlert.outputs.resourceId : ''
