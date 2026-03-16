targetScope = 'resourceGroup'

@description('Application Insights resource name.')
param appInsightsName string

@allowed([
  'dev'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Azure region.')
param location string

@description('Log Analytics workspace resource name.')
param logAnalyticsWorkspaceName string

@description('Resource tags.')
param tags object

var dailyQuotaGb = environment == 'prod' ? '2' : '1'

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.15.0' = {
  params: {
    dailyQuotaGb: dailyQuotaGb
    dataRetention: 30
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
    samplingPercentage: environment == 'prod' ? 50 : 100
    tags: tags
    workspaceResourceId: logAnalytics.outputs.resourceId
  }
}

@description('Log Analytics workspace resource ID.')
output resourceId string = logAnalytics.outputs.resourceId

@description('Log Analytics workspace name.')
output resourceName string = logAnalytics.outputs.name

@description('Application Insights connection string.')
output appInsightsConnectionString string = appInsights.outputs.connectionString

@description('Application Insights resource ID.')
output appInsightsResourceId string = appInsights.outputs.resourceId
