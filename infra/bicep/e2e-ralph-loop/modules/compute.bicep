targetScope = 'resourceGroup'

@description('Application Insights resource name.')
param appInsightsName string

@description('App Service resource name.')
param appServiceName string

@description('App Service Plan resource name.')
param appServicePlanName string

@description('App Service Plan SKU configuration.')
param appServicePlanSku object

@allowed([
  'dev'
  'prod'
])
@description('Deployment environment.')
param environment string

@description('Key Vault resource name.')
param keyVaultName string

@description('Azure region.')
param location string

@description('Log Analytics workspace name used for diagnostic settings.')
param logAnalyticsWorkspaceName string

@description('SQL Database name exposed to the application as configuration.')
param sqlDatabaseName string

@description('SQL Server name exposed to the application as configuration.')
param sqlServerName string

@description('Storage Account resource name.')
param storageAccountName string

@description('Resource tags.')
param tags object

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsWorkspaceName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

var appInsightsConnectionString = appInsights.properties.ConnectionString
var keyVaultUri = 'https://${keyVaultName}.${az.environment().suffixes.keyvaultDns}'

module appServicePlan 'br/public:avm/res/web/serverfarm:0.7.0' = {
  params: {
    kind: 'Linux'
    location: location
    name: appServicePlanName
    reserved: true
    skuCapacity: appServicePlanSku.capacity
    skuName: appServicePlanSku.name
    tags: tags
  }
}

module appService 'br/public:avm/res/web/site:0.22.0' = {
  params: {
    diagnosticSettings: [
      {
        logCategoriesAndGroups: [
          {
            categoryGroup: 'allLogs'
            enabled: true
          }
        ]
        metricCategories: [
          {
            category: 'AllMetrics'
            enabled: true
          }
        ]
        workspaceResourceId: workspace.id
      }
    ]
    httpsOnly: true
    kind: 'app,linux'
    location: location
    managedIdentities: {
      systemAssigned: true
    }
    name: appServiceName
    serverFarmResourceId: appServicePlan.outputs.resourceId
    siteConfig: {
      alwaysOn: environment == 'prod'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'AZURE_KEY_VAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'AZURE_SQL_SERVER_NAME'
          value: sqlServerName
        }
        {
          name: 'AZURE_SQL_DATABASE_NAME'
          value: sqlDatabaseName
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
      ]
      ftpsState: 'Disabled'
      http20Enabled: true
      linuxFxVersion: 'NODE|20-lts'
      minTlsVersion: '1.2'
      vnetRouteAllEnabled: false
    }
    tags: tags
  }
}

resource keyVaultSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appServiceName, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: appService.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
  }
}

resource storageBlobContributorAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, appServiceName, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: appService.outputs.?systemAssignedMIPrincipalId ?? ''
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
  }
}

@description('App Service resource ID.')
output resourceId string = appService.outputs.resourceId

@description('App Service resource name.')
output resourceName string = appService.outputs.name

@description('App Service default hostname.')
output defaultHostname string = appService.outputs.defaultHostname

@description('App Service managed identity principal ID.')
output principalId string = appService.outputs.?systemAssignedMIPrincipalId ?? ''
