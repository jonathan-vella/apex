targetScope = 'resourceGroup'

@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string
param location string
param tags object
param logAnalyticsWorkspaceName string
param appInsightsName string
param actionGroupName string
param actionGroupEmailReceivers array

var dailyQuotaGb = environment == 'prod' ? '50' : environment == 'staging' ? '10' : '5'
var retentionInDays = environment == 'prod' ? 90 : environment == 'staging' ? 60 : 31

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
  name: appInsightsName
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

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  tags: tags
  properties: {
    enabled: true
    groupShortName: take(replace(actionGroupName, '-', ''), 12)
    emailReceivers: [for (receiver, index) in actionGroupEmailReceivers: {
      name: '${receiver.name}-${index + 1}'
      emailAddress: receiver.emailAddress
      useCommonAlertSchema: true
    }]
  }
}

output logAnalyticsWorkspaceId string = logAnalytics.outputs.resourceId
output logAnalyticsWorkspaceName string = logAnalytics.outputs.name
output appInsightsId string = appInsights.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output actionGroupId string = actionGroup.id
