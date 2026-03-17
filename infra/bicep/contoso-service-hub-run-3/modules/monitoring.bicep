@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment used to size monitoring defaults.')
param environmentName string

@description('Azure region for the monitoring resources.')
param location string

@description('Common resource tags for monitoring resources.')
param tags object

@description('Log Analytics workspace name.')
param logAnalyticsWorkspaceName string

@description('Application Insights component name.')
param appInsightsName string

var dailyQuotaGb = environmentName == 'prod' ? '5' : environmentName == 'staging' ? '2' : '1'
var retentionInDays = 30
var samplingPercentage = environmentName == 'prod' ? 50 : environmentName == 'staging' ? 75 : 100

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  params: {
    dataRetention: retentionInDays
    dailyQuotaGb: dailyQuotaGb
    location: location
    name: logAnalyticsWorkspaceName
    skuName: 'PerGB2018'
    tags: tags
  }
}

module appInsights 'br/public:avm/res/insights/component:0.7.1' = {
  params: {
    applicationType: 'web'
    kind: 'web'
    location: location
    name: appInsightsName
    samplingPercentage: samplingPercentage
    tags: tags
    workspaceResourceId: logAnalytics.outputs.resourceId
  }
}

@description('Log Analytics workspace resource ID.')
output logAnalyticsWorkspaceId string = logAnalytics.outputs.resourceId

@description('Log Analytics workspace name.')
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name

@description('Application Insights resource ID.')
output appInsightsId string = appInsights.outputs.resourceId

@description('Application Insights connection string.')
output appInsightsConnectionString string = appInsights.outputs.connectionString
