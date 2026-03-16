targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Azure region.')
param location string

@description('Resource tags.')
param tags object

@description('Log Analytics workspace name.')
param logAnalyticsWorkspaceName string

@description('Application Insights component name.')
param applicationInsightsName string

var dailyQuotaGb = environment == 'prod' ? '50' : environment == 'staging' ? '10' : '5'
var retentionInDays = environment == 'prod' ? 90 : 30

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

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true
    Flow_Type: 'Bluefield'
    IngestionMode: 'LogAnalytics'
    WorkspaceResourceId: logAnalytics.outputs.resourceId
  }
}

@description('Log Analytics workspace resource ID.')
output logAnalyticsWorkspaceId string = logAnalytics.outputs.resourceId

@description('Log Analytics workspace name.')
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name

@description('Application Insights resource ID.')
output applicationInsightsId string = appInsights.id

@description('Application Insights connection string.')
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString
